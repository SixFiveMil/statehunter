import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probeRoute, probeRoutesBatch } from '../src/modules/route_prober';

describe('probeRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles invalid URL gracefully', async () => {
    const result = await probeRoute('invalid-url', '%%%');
    expect(result.error).toBeDefined();
  });

  it('probes a valid endpoint with HEAD and returns status code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK'
    } as Response);

    const result = await probeRoute('http://localhost:8080', '/api/v1/health');
    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.latencyMs).toBeDefined();
  });

  it('falls back to GET if HEAD returns 405 Method Not Allowed', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        status: 405,
        statusText: 'Method Not Allowed'
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK'
      } as Response);

    const result = await probeRoute('http://localhost:8080', '/api/users');
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('strictly blocks excluded paths and aborts before fetch is invoked', async () => {
    global.fetch = vi.fn();

    const result = await probeRoute('http://localhost:8080', '/logout', {
      exclusions: ['/logout', '/delete', '/billing']
    });

    expect(result.blocked).toBe(true);
    expect(result.statusText).toBe('BLOCKED');
    expect(result.error).toContain('excluded_paths');
    // Crucial: fetch must NEVER have been called!
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('strictly blocks targets outside authorized in-scope rules without network request', async () => {
    global.fetch = vi.fn();

    const result = await probeRoute('http://localhost:8080', 'https://unauthorized-domain.com/secret', {
      inScope: ['http://localhost:8080']
    });

    expect(result.blocked).toBe(true);
    expect(result.statusText).toBe('BLOCKED');
    expect(result.error).toContain('outside authorized in-scope');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('probeRoutesBatch', () => {
  it('probes multiple paths and calls onResult for each', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK'
    } as Response);

    const paths = ['/admin', '/dashboard', '/settings'];
    const results: Record<string, any> = {};

    await probeRoutesBatch('http://localhost:8080', paths, 2, (path, res) => {
      if (!res.probing) {
        results[path] = res;
      }
    });

    expect(Object.keys(results).length).toBe(3);
    expect(results['/admin']?.status).toBe(200);
    expect(results['/dashboard']?.status).toBe(200);
    expect(results['/settings']?.status).toBe(200);
  });

  it('correctly blocks excluded paths in batch while allowing safe endpoints', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK'
    } as Response);

    const paths = ['/dashboard', '/delete', '/settings'];
    const results: Record<string, any> = {};

    await probeRoutesBatch(
      'http://localhost:8080',
      paths,
      {
        concurrency: 2,
        exclusions: ['/delete']
      },
      (path, res) => {
        if (!res.probing) {
          results[path] = res;
        }
      }
    );

    expect(results['/dashboard']?.status).toBe(200);
    expect(results['/settings']?.status).toBe(200);
    expect(results['/delete']?.blocked).toBe(true);
    expect(results['/delete']?.statusText).toBe('BLOCKED');
    expect(global.fetch).toHaveBeenCalledTimes(2); // Only called for the two non-excluded endpoints!
  });
});
