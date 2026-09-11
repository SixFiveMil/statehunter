import { describe, it, expect } from 'vitest';
import { extractNextJsRoutes, classifyRoute, extractRoutesFromScriptText, extractDomRoutes, normalizeRoutePath } from '../src/modules/route_extractor';

describe('classifyRoute', () => {
  it('correctly classifies admin routes', () => {
    expect(classifyRoute('/admin/users')).toBe('admin');
    expect(classifyRoute('/internal/settings')).toBe('admin');
    expect(classifyRoute('/dashboard/stats')).toBe('admin');
  });

  it('correctly classifies API endpoints', () => {
    expect(classifyRoute('/api/v1/checkout')).toBe('api');
    expect(classifyRoute('/graphql')).toBe('api');
  });

  it('correctly classifies dynamic routes', () => {
    expect(classifyRoute('/users/[id]')).toBe('dynamic');
    expect(classifyRoute('/posts/:slug')).toBe('dynamic');
  });

  it('correctly classifies standard routes', () => {
    expect(classifyRoute('/about')).toBe('standard');
    expect(classifyRoute('/pricing')).toBe('standard');
  });
});

describe('extractNextJsRoutes', () => {
  it('parses Next.js __BUILD_MANIFEST sortedPages and rewrites', () => {
    const mockManifest = {
      sortedPages: [
        '/_app',
        '/',
        '/admin/super-secret-panel',
        '/api/auth/[...nextauth]',
        '/profile/[username]',
        '/_error'
      ],
      __rewrites: {
        beforeFiles: [
          { source: '/legacy-admin', destination: '/admin/super-secret-panel' }
        ]
      }
    };

    const routes = extractNextJsRoutes(mockManifest);
    const paths = routes.map(r => r.path);

    // Framework internals like /_app and /_error should be filtered out
    expect(paths).not.toContain('/_app');
    expect(paths).not.toContain('/_error');

    expect(paths).toContain('/');
    expect(paths).toContain('/admin/super-secret-panel');
    expect(paths).toContain('/api/auth/[...nextauth]');
    expect(paths).toContain('/legacy-admin');

    const adminRoute = routes.find(r => r.path === '/admin/super-secret-panel');
    expect(adminRoute?.type).toBe('admin');

    const apiRoute = routes.find(r => r.path === '/api/auth/[...nextauth]');
    expect(apiRoute?.type).toBe('api');
  });
});

describe('extractRoutesFromScriptText', () => {
  it('extracts route paths from raw JavaScript script bundles', () => {
    const script = `
      const config = {
        path: "/admin/console",
        route: "/api/v2/telemetry",
        icon: "dashboard.png"
      };
    `;

    const routes = extractRoutesFromScriptText(script);
    const paths = routes.map(r => r.path);

    expect(paths).toContain('/admin/console');
    expect(paths).toContain('/api/v2/telemetry');
    expect(paths).not.toContain('dashboard.png');
  });

  it('extracts Angular routes with backticks, no leading slashes, and routerLink', () => {
    const angularBundle = `
      var routes = [
        { path: \`score-board\`, component: ScoreBoardComponent },
        { path: \`administration\`, component: AdminComponent },
        { path: 'address/edit/:addressId', component: AddressEditComponent },
        { path: "rest/user/login", component: LoginComponent },
        { path: \`photo-wall\`, component: PhotoWallComponent },
        { path: '**', redirectTo: 'score-board' }
      ];
      var links = [\`mat-list-item\`,\`\`,\`routerLink\`,\`/privacy-security\`];
    `;

    const routes = extractRoutesFromScriptText(angularBundle);
    const paths = routes.map(r => r.path);

    expect(paths).toContain('/score-board');
    expect(paths).toContain('/administration');
    expect(paths).toContain('/address/edit/:addressId');
    expect(paths).toContain('/rest/user/login');
    expect(paths).toContain('/photo-wall');
    expect(paths).toContain('/privacy-security');
    expect(paths).not.toContain('/**');

    const admin = routes.find(r => r.path === '/score-board');
    expect(admin?.type).toBe('admin');

    const restApi = routes.find(r => r.path === '/rest/user/login');
    expect(restApi?.type).toBe('api');

    const dynamic = routes.find(r => r.path === '/address/edit/:addressId');
    expect(dynamic?.type).toBe('dynamic');
  });
});

describe('extractDomRoutes', () => {
  it('extracts routes from hash, anchor tags, and routerLink attributes', () => {
    const mockDoc = {
      querySelectorAll: (selector: string) => {
        if (selector === 'a[href]') {
          return [
            { getAttribute: () => '#/score-board' },
            { getAttribute: () => '/#/administration' },
            { getAttribute: () => '/about' },
            { getAttribute: () => 'https://external.com/faq' }
          ];
        }
        if (selector === '[routerLink], [ng-reflect-router-link]') {
          return [
            { getAttribute: (attr: string) => attr === 'routerLink' ? 'photo-wall' : null },
            { getAttribute: (attr: string) => attr === 'ng-reflect-router-link' ? '/tokens' : null }
          ];
        }
        return [];
      }
    } as any;

    const mockWin = {
      location: {
        hash: '#/profile'
      }
    } as any;

    const routes = extractDomRoutes(mockDoc, mockWin);
    const paths = routes.map(r => r.path);

    expect(paths).toContain('/profile');
    expect(paths).toContain('/score-board');
    expect(paths).toContain('/administration');
    expect(paths).toContain('/about');
    expect(paths).toContain('/photo-wall');
    expect(paths).toContain('/tokens');
    expect(paths).not.toContain('https://external.com/faq');
  });
});

describe('ReDoS resilience & performance benchmarks', () => {
  it('safely handles adversarial strings without catastrophic backtracking', () => {
    const maliciousInput = '/' + 'a'.repeat(60) + '!';
    const start = performance.now();
    const result = normalizeRoutePath(maliciousInput);
    const duration = performance.now() - start;

    expect(result).toBeNull();
    expect(duration).toBeLessThan(15);
  });

  it('safely handles long script fragments with nested path characters', () => {
    const adversarialScript = `
      const a = { path: "/` + 'segment/'.repeat(50) + `invalid_end!" };
      const b = { route: "/api/` + 'nested/'.repeat(40) + `test" };
    `;
    const start = performance.now();
    const routes = extractRoutesFromScriptText(adversarialScript);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(25);
    expect(routes.some(r => r.path.startsWith('/api/nested'))).toBe(true);
  });
});
