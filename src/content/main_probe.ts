import { auditIncomingMessage, auditOutgoingMessage } from '../modules/postmessage_tracker';
import { extractNextJsRoutes, extractRoutesFromScriptText, extractDomRoutes } from '../modules/route_extractor';
import { scanStringForSecrets } from '../modules/secret_scanner';
import { auditBrowserStorage } from '../modules/storage_auditor';
import { checkPollutedProperties, setupPrototypeGuard } from '../modules/prototype_checker';
import { DiscoveredRoute, SecretFinding } from '../types';

(function initMainProbe() {
  // Prevent double injection
  if ((window as any).__STATEHUNTER_PROBE_INITIALIZED__) return;
  (window as any).__STATEHUNTER_PROBE_INITIALIZED__ = true;

  const SECURE_TELEMETRY_EVENT = '__STATEHUNTER_SECURE_TELEMETRY__';
  const SECURE_CONTROL_EVENT = '__STATEHUNTER_SECURE_CONTROL__';

  // Native references
  const rawPostMessage = window.postMessage.bind(window);
  const rawAddEventListener = window.addEventListener.bind(window);
  const rawDocAddEventListener = document.addEventListener.bind(document);
  const rawDispatchEvent = document.dispatchEvent.bind(document);

  // High-performance message rate-limiting & noise filtering
  let lastTelemetryTime = 0;
  let telemetryCountInSecond = 0;
  const MAX_POSTMESSAGE_PER_SEC = 20;

  function shouldAuditMessage(data: any): boolean {
    if (!data) return true;
    if (typeof data === 'string') {
      if (data.length > 50000) return false; // Skip massive serialized blocks in postMessage
      if (data.includes('webpack') || data.includes('heartbeat') || data.includes('ping') || data.includes('resize') || data.includes('metric')) {
        return false;
      }
    } else if (typeof data === 'object') {
      const type = (data.type || data.event || data.action || data.topic || '') + '';
      if (type.includes('webpack') || type.includes('heartbeat') || type.includes('ping') || type.includes('resize') || type.includes('metric') || type.includes('ad_')) {
        return false;
      }
    }
    return true;
  }

  function canEmitPostMessage(): boolean {
    const now = Date.now();
    if (now - lastTelemetryTime > 1000) {
      lastTelemetryTime = now;
      telemetryCountInSecond = 0;
    }
    if (telemetryCountInSecond >= MAX_POSTMESSAGE_PER_SEC) {
      return false;
    }
    telemetryCountInSecond++;
    return true;
  }

  function emitTelemetry(type: string, payload: any) {
    try {
      const event = new CustomEvent(SECURE_TELEMETRY_EVENT, {
        detail: { type, payload }
      });
      rawDispatchEvent(event);
    } catch (err) {
      console.debug('[StateHunter] Failed to emit telemetry:', err);
    }
  }

  // 1. Hook window.addEventListener for 'message' (optimized hot path, no expensive stack traces)
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function (type: string, listener: any, options?: any) {
    if (type === 'message' && typeof listener === 'function') {
      const listenerSource = listener.toString();
      const wrappedListener = function (this: any, event: any) {
        if (shouldAuditMessage(event.data) && canEmitPostMessage()) {
          try {
            const audit = auditIncomingMessage(
              event.origin,
              event.data,
              listenerSource
            );
            emitTelemetry('POST_MESSAGE', audit);
          } catch (e) {
            console.debug('[StateHunter] Error auditing message:', e);
          }
        }

        return listener.apply(this, arguments as any);
      };

      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.apply(this, arguments as any);
  };

  // 2. Hook window.postMessage for outgoing messages (rate-limited, no synchronous stack unwinding)
  const originalPostMessage = window.postMessage;
  window.postMessage = function (message: any, targetOriginOrOptions: any, transfer?: any) {
    if (shouldAuditMessage(message) && canEmitPostMessage()) {
      try {
        const targetOrigin = typeof targetOriginOrOptions === 'string' ? targetOriginOrOptions : '*';
        const audit = auditOutgoingMessage(targetOrigin, message);
        emitTelemetry('POST_MESSAGE', audit);
      } catch (e) {
        console.debug('[StateHunter] Error auditing outgoing postMessage:', e);
      }
    }

    return originalPostMessage.apply(this, arguments as any);
  };

  // 3. Setup prototype pollution guard
  setupPrototypeGuard((ppEvent) => {
    emitTelemetry('PROTOTYPE_POLLUTION', ppEvent);
  });

  function safeSerialize(val: any, maxLen = 32768): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.slice(0, maxLen);
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);

    try {
      const seen = new WeakSet();
      const json = JSON.stringify(val, function (key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
      return json ? json.slice(0, maxLen) : '';
    } catch {
      return '';
    }
  }

  // 4. Runtime state inspection scanner
  function runRuntimeScan() {
    // A. Framework Manifests (Next.js, Nuxt, Remix)
    let detectedFramework = '';
    const routes: DiscoveredRoute[] = [];
    const secrets: SecretFinding[] = [];

    // Check Next.js __BUILD_MANIFEST
    if ((window as any).__BUILD_MANIFEST) {
      detectedFramework = 'Next.js';
      const extracted = extractNextJsRoutes((window as any).__BUILD_MANIFEST);
      routes.push(...extracted);
    }

    // Check Next.js __NEXT_DATA__
    if ((window as any).__NEXT_DATA__) {
      if (!detectedFramework) detectedFramework = 'Next.js';
      const nextData = (window as any).__NEXT_DATA__;

      // Safe scan page props for secrets (capped to 64KB)
      try {
        const jsonStr = safeSerialize(nextData, 65536);
        if (jsonStr) {
          const found = scanStringForSecrets(jsonStr, '__NEXT_DATA__', 'next_data');
          secrets.push(...found);
        }

        if (nextData.page) {
          routes.push({
            id: `next_active_${Date.now()}`,
            path: nextData.page,
            source: 'nextjs_manifest',
            type: nextData.page.includes('admin') ? 'admin' : 'standard',
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.debug('[StateHunter] Failed scanning __NEXT_DATA__:', err);
      }
    }

    // Check Nuxt / Remix / Webpack / Angular / React / Vue
    if ((window as any).__NUXT__) detectedFramework = 'Nuxt';
    if ((window as any).__remixContext) detectedFramework = 'Remix';
    if (!detectedFramework) {
      if (document.querySelector('[ng-version], app-root, [ng-app]')) {
        const ngVer = document.querySelector('[ng-version]')?.getAttribute('ng-version');
        detectedFramework = ngVer ? `Angular (${ngVer})` : 'Angular';
      } else if (document.querySelector('[data-reactroot], #root') || (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        detectedFramework = 'React';
      } else if (document.querySelector('[data-v-app], #app') || (window as any).__VUE__) {
        detectedFramework = 'Vue';
      }
    }

    // Scan window global variables for sensitive names with strict depth/size limits
    const suspiciousGlobals = [
      'config', 'CONFIG', 'env', 'ENV', 'settings', 'SETTINGS',
      'user', 'USER', 'auth', 'AUTH', 'token', 'TOKEN', 'apiKey', 'api_key'
    ];

    for (const glob of suspiciousGlobals) {
      if (glob in window && (window as any)[glob]) {
        try {
          const val = (window as any)[glob];
          const str = safeSerialize(val, 32768);
          if (str) {
            const findings = scanStringForSecrets(str, `window.${glob}`, 'window_global');
            secrets.push(...findings);
          }
        } catch {
          // ignore non-stringifiable
        }
      }
    }

    // B. Browser Storage Audit
    const storageAudit = auditBrowserStorage();
    secrets.push(...storageAudit.findings);

    // C. Prototype pollution check
    const ppEvents = checkPollutedProperties();

    // D. Scan loaded script tags for route strings (capped to max 30 scripts, max 100KB each)
    const scriptTags = document.getElementsByTagName('script');
    const maxScripts = Math.min(scriptTags.length, 30);
    for (let i = 0; i < maxScripts; i++) {
      const script = scriptTags[i];
      if (script.textContent && script.textContent.length > 50 && script.textContent.length < 100000) {
        const extracted = extractRoutesFromScriptText(script.textContent);
        routes.push(...extracted);
      }
    }

    // E. Extract DOM navigation links, Angular routerLinks & hash routes
    const domRoutes = extractDomRoutes(document, window);
    routes.push(...domRoutes);

    // Emit consolidated results
    emitTelemetry('FULL_SCAN_RESULT', {
      framework: detectedFramework || undefined,
      routes,
      secrets,
      prototypeEvents: ppEvents,
      storage: {
        localStorage: storageAudit.localStorage,
        sessionStorage: storageAudit.sessionStorage,
        decodedJwts: storageAudit.decodedJwts
      }
    });
  }

  // Defer scans to idle times so UI, scrolling, and page render are never blocked
  function scheduleScan(delay = 100) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => runRuntimeScan(), { timeout: 2000 });
    } else {
      setTimeout(runRuntimeScan, delay);
    }
  }

  if (document.readyState === 'loading') {
    rawAddEventListener('DOMContentLoaded', () => scheduleScan(50));
    rawAddEventListener('load', () => scheduleScan(200));
  } else {
    scheduleScan(100);
  }

  // Listen for control messages from the bridge via private CustomEvent on document
  rawDocAddEventListener(SECURE_CONTROL_EVENT, ((event: CustomEvent) => {
    if (!event.detail) return;
    const { action, params } = event.detail;
    if (action === 'TRIGGER_RESCAN') {
      runRuntimeScan();
    } else if (action === 'DISPATCH_POST_MESSAGE') {
      const { targetOrigin, payload, targetFrameIndex } = params || {};
      try {
        let targetWin: Window = window;
        if (typeof targetFrameIndex === 'number' && targetFrameIndex >= 0 && window.frames[targetFrameIndex]) {
          targetWin = window.frames[targetFrameIndex];
        }
        // Dispatch native postMessage in the MAIN world
        targetWin.postMessage(payload, targetOrigin || '*');
        emitTelemetry('DISPATCH_STATUS', { success: true, timestamp: Date.now() });
      } catch (err: any) {
        emitTelemetry('DISPATCH_STATUS', { success: false, error: err.message, timestamp: Date.now() });
      }
    }
  }) as EventListener);
})();
