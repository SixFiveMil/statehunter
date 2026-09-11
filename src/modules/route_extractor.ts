import { DiscoveredRoute } from '../types';

export function classifyRoute(path: string): DiscoveredRoute['type'] {
  const lower = path.toLowerCase();
  if (
    lower.includes('admin') ||
    lower.includes('internal') ||
    lower.includes('debug') ||
    lower.includes('dashboard') ||
    lower.includes('manage') ||
    lower.includes('score-board') ||
    lower.includes('accounting') ||
    lower.includes('secret')
  ) {
    return 'admin';
  }
  if (
    lower.startsWith('/api') ||
    lower.includes('/v1/') ||
    lower.includes('/v2/') ||
    lower.includes('/graphql') ||
    lower.startsWith('/rest/') ||
    lower.includes('/rest/')
  ) {
    return 'api';
  }
  if (path.includes('[') || path.includes(':') || path.includes('*')) {
    return 'dynamic';
  }
  return 'standard';
}

export function normalizeRoutePath(raw: string): string | null {
  let p = raw.trim();
  if (!p || p.length > 500) return null;
  if (p === '*' || p === '**' || p === '/**' || p === '/*') return null;
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('//') || p.startsWith('data:') || p.startsWith('blob:') || p.startsWith('javascript:')) return null;
  if (/\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|html|json|map)$/i.test(p)) return null;
  if (/[\s\r\n\t]/.test(p)) return null;
  if (!p.startsWith('/')) p = '/' + p;
  if (p === '/') return '/';
  // Route paths should generally be alphanumeric with /, -, _, :, [, ], ., etc.
  // Linear-time O(N) validation - no nested quantifiers to avoid catastrophic backtracking (ReDoS)
  if (!/^\/[a-zA-Z0-9_\-\[\]:\.\/]*$/.test(p)) return null;
  return p;
}

export function extractNextJsRoutes(manifest: any): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  if (!manifest || typeof manifest !== 'object') return routes;

  let pageList: string[] = [];

  // Next.js __BUILD_MANIFEST usually has `sortedPages` or keys corresponding to routes
  if (Array.isArray(manifest.sortedPages)) {
    pageList.push(...manifest.sortedPages);
  }
  if (Array.isArray(manifest.__rewrites?.beforeFiles)) {
    for (const rw of manifest.__rewrites.beforeFiles) {
      if (rw.source) pageList.push(rw.source);
    }
  }

  // Also collect keys that start with '/'
  for (const key of Object.keys(manifest)) {
    if (key.startsWith('/') && !pageList.includes(key)) {
      pageList.push(key);
    }
  }

  const seen = new Set<string>();
  for (const rawPath of pageList) {
    // Filter out framework internal routes like /_app, /_error, /_document
    if (rawPath === '/_app' || rawPath === '/_document' || rawPath === '/_error') {
      continue;
    }
    const norm = normalizeRoutePath(rawPath);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);

    routes.push({
      id: `route_next_${norm}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      path: norm,
      source: 'nextjs_manifest',
      type: classifyRoute(norm),
      timestamp: Date.now()
    });
  }

  return routes;
}

export function extractRoutesFromScriptText(content: string, sourceLabel: DiscoveredRoute['source'] = 'static_script'): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  if (!content) return routes;

  const seen = new Set<string>();

  const addRoute = (rawPath: string) => {
    const norm = normalizeRoutePath(rawPath);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      routes.push({
        id: `route_regex_${norm}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        path: norm,
        source: sourceLabel,
        type: classifyRoute(norm),
        timestamp: Date.now()
      });
    }
  };

  // 1. Angular / SPA route definitions: path: '...' or path: "..." or path: `...`
  const pathRegex = /path\s*:\s*[`'"]([^`'"\s\?#]+)[`'"]/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(content)) !== null) {
    addRoute(match[1]);
  }

  // 2. Angular / SPA routerLink: routerLink="...", routerLink, `/...`, ['routerLink', '/...']
  const linkRegex = /routerLink[`'"]?\s*(?:=|:|,)\s*[`'"]?\s*[`'"]\/?([^`'"\s\?#]+)[`'"]/g;
  while ((match = linkRegex.exec(content)) !== null) {
    addRoute(match[1]);
  }

  // 3. Hash routing patterns: e.g. "#/admin" or `#/score-board`
  const hashRegex = /["'`]#\/([a-zA-Z0-9_\-\/:]+)["'`]/g;
  while ((match = hashRegex.exec(content)) !== null) {
    addRoute(match[1]);
  }

  // 4. Standard path/route/url prefixes (linear O(N) regex, no nested quantifiers)
  const routeRegex = /(?:path|route|url)\s*[:=]\s*[`'"](\/[a-zA-Z0-9_\-\[\]:\/]+)[`'"]/g;
  while ((match = routeRegex.exec(content)) !== null) {
    addRoute(match[1]);
  }

  // 5. React Route components: <Route path="..."
  const reactRouteRegex = /<Route[^>]*\spath=[`'"]([^`'"\s\?#]+)[`'"]/g;
  while ((match = reactRouteRegex.exec(content)) !== null) {
    addRoute(match[1]);
  }

  return routes;
}

export function extractDomRoutes(doc: Document = document, win: Window = window): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  const seen = new Set<string>();

  const addRoute = (rawPath: string, source: DiscoveredRoute['source'] = 'runtime_router') => {
    if (!rawPath || rawPath.length > 200) return;
    const norm = normalizeRoutePath(rawPath);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      routes.push({
        id: `route_dom_${norm}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        path: norm,
        source,
        type: classifyRoute(norm),
        timestamp: Date.now()
      });
    }
  };

  // 1. Current hash route
  if (win.location?.hash && win.location.hash.startsWith('#/')) {
    addRoute(win.location.hash.slice(2));
  }

  // 2. Navigation anchor links (capped to max 250 links to avoid locking on enterprise sites)
  try {
    const links = doc.querySelectorAll('a[href]');
    const maxLinks = Math.min(links.length, 250);
    for (let i = 0; i < maxLinks; i++) {
      const href = links[i].getAttribute('href');
      if (!href || href.length > 200) continue;
      // Skip tracking parameters / ref links common on shopping & ad sites
      if (href.includes('ref=') || href.includes('utm_') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;

      if (href.startsWith('#/')) {
        addRoute(href.slice(2));
      } else if (href.startsWith('/#')) {
        addRoute(href.slice(3));
      } else if (href.startsWith('/') && !href.startsWith('//')) {
        addRoute(href.split('?')[0].split('#')[0]);
      }
    }
  } catch {}

  // 3. Angular routerLink attributes in DOM (capped to max 200)
  try {
    const routerElements = doc.querySelectorAll('[routerLink], [ng-reflect-router-link]');
    const maxRouter = Math.min(routerElements.length, 200);
    for (let i = 0; i < maxRouter; i++) {
      const el = routerElements[i];
      const linkAttr = el.getAttribute('routerLink') || el.getAttribute('ng-reflect-router-link');
      if (linkAttr && linkAttr.length < 200) {
        addRoute(linkAttr.trim().replace(/^['"`]|['"`]$/g, ''));
      }
    }
  } catch {}

  return routes;
}

