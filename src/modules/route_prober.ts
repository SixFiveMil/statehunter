import { RouteProbeResult } from '../types';
import { checkScope } from '../utils/scope_enforcer';

export interface ProbeRouteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  exclusions?: string[];
  inScope?: string[];
}

export interface ProbeBatchOptions {
  concurrency?: number;
  signal?: AbortSignal;
  exclusions?: string[];
  inScope?: string[];
}

export async function probeRoute(
  baseUrl: string,
  path: string,
  optionsOrTimeout: number | ProbeRouteOptions = 5000,
  signalParam?: AbortSignal,
  exclusionsParam: string[] = [],
  inScopeParam: string[] = []
): Promise<RouteProbeResult> {
  let timeoutMs = 5000;
  let signal: AbortSignal | undefined = signalParam;
  let exclusions: string[] = exclusionsParam;
  let inScope: string[] = inScopeParam;

  if (typeof optionsOrTimeout === 'object') {
    timeoutMs = optionsOrTimeout.timeoutMs ?? 5000;
    signal = optionsOrTimeout.signal ?? signalParam;
    exclusions = optionsOrTimeout.exclusions ?? exclusionsParam;
    inScope = optionsOrTimeout.inScope ?? inScopeParam;
  } else if (typeof optionsOrTimeout === 'number') {
    timeoutMs = optionsOrTimeout;
  }

  // 1. Enforce Scope & Exclusions Gatekeeper BEFORE ANY Network Request
  const scopeCheck = checkScope(path, baseUrl, inScope, exclusions);
  if (!scopeCheck.allowed) {
    return {
      status: 0,
      statusText: 'BLOCKED',
      blocked: true,
      blockReason: scopeCheck.reason,
      error: scopeCheck.reason || 'Blocked by scope policy',
      latencyMs: 0
    };
  }

  let targetUrl: string;
  try {
    targetUrl = new URL(path, baseUrl).toString();
  } catch {
    return { error: 'Invalid URL formation' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link external signal to controller if provided
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const start = performance.now();

  try {
    // Attempt HEAD request first
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      // If server rejects HEAD with 405 Method Not Allowed, fallback to GET
      if (response.status === 405) {
        response = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal
        });
      }
    } catch (e: any) {
      if (controller.signal.aborted && signal?.aborted) {
        return { error: 'Probing aborted by operator' };
      }
      // Retry once with GET in case HEAD is blocked by server/WAF
      response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    return {
      status: response.status,
      statusText: response.statusText || String(response.status),
      latencyMs
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (controller.signal.aborted) {
      return { error: signal?.aborted ? 'Aborted by user' : 'Timeout (>5s)' };
    }

    return {
      error: err.name === 'TypeError' ? 'CORS / Network Error' : err.message || 'Request failed',
      latencyMs
    };
  }
}

export async function probeRoutesBatch(
  baseUrl: string,
  paths: string[],
  optionsOrConcurrency: number | ProbeBatchOptions = 3,
  onResult: (path: string, result: RouteProbeResult) => void,
  signalParam?: AbortSignal,
  exclusionsParam: string[] = [],
  inScopeParam: string[] = []
): Promise<void> {
  let concurrency = 3;
  let signal: AbortSignal | undefined = signalParam;
  let exclusions: string[] = exclusionsParam;
  let inScope: string[] = inScopeParam;

  if (typeof optionsOrConcurrency === 'object') {
    concurrency = optionsOrConcurrency.concurrency ?? 3;
    signal = optionsOrConcurrency.signal ?? signalParam;
    exclusions = optionsOrConcurrency.exclusions ?? exclusionsParam;
    inScope = optionsOrConcurrency.inScope ?? inScopeParam;
  } else if (typeof optionsOrConcurrency === 'number') {
    concurrency = optionsOrConcurrency;
  }

  const queue = [...paths];

  async function worker() {
    while (queue.length > 0) {
      if (signal?.aborted) break;
      const path = queue.shift();
      if (!path) break;

      onResult(path, { probing: true });
      const result = await probeRoute(baseUrl, path, {
        timeoutMs: 5000,
        signal,
        exclusions,
        inScope
      });
      onResult(path, { ...result, probing: false });
    }
  }

  const poolSize = Math.min(concurrency, paths.length);
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);
}
