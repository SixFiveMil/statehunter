import { describe, it, expect } from 'vitest';
import { isPathExcluded, isTargetInScope, checkScope } from '../src/utils/scope_enforcer';

describe('isPathExcluded', () => {
  const exclusions = ['/logout', '/delete', '/billing', '/admin/*'];

  it('matches exact paths', () => {
    expect(isPathExcluded('/logout', exclusions).excluded).toBe(true);
    expect(isPathExcluded('/delete', exclusions).excluded).toBe(true);
    expect(isPathExcluded('/billing', exclusions).excluded).toBe(true);
  });

  it('matches subpaths and query parameters', () => {
    expect(isPathExcluded('/logout/confirm', exclusions).excluded).toBe(true);
    expect(isPathExcluded('/billing/invoices/2026', exclusions).excluded).toBe(true);
    expect(isPathExcluded('/delete?user_id=123', exclusions).excluded).toBe(true);
  });

  it('matches wildcard exclusions', () => {
    expect(isPathExcluded('/admin/users', exclusions).excluded).toBe(true);
    expect(isPathExcluded('/admin/settings/security', exclusions).excluded).toBe(true);
  });

  it('does not match nested path segments for literal path rules', () => {
    // Literal '/billing', '/logout', '/delete' only match exact routes and direct subpaths rooted there
    expect(isPathExcluded('/api/v1/billing/stripe-webhook', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/api/v2/users/delete/profile', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/auth/api/logout', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/api/v1/billing', exclusions).excluded).toBe(false);
  });

  it('matches nested path segments when explicit wildcards are used', () => {
    const wildcardExclusions = ['*/billing/*', '*delete*', '*/logout', '/api/*/stripe/*'];
    expect(isPathExcluded('/api/v1/billing/stripe-webhook', wildcardExclusions).excluded).toBe(true);
    expect(isPathExcluded('/api/v2/users/delete/profile', wildcardExclusions).excluded).toBe(true);
    expect(isPathExcluded('/auth/api/logout', wildcardExclusions).excluded).toBe(true);
    expect(isPathExcluded('/api/v1/billing/stripe-webhook', ['*billing*']).excluded).toBe(true);
    expect(isPathExcluded('/api/v1/stripe/charge', wildcardExclusions).excluded).toBe(true);
  });

  it('permits authorized paths not in exclusions and avoids partial word false positives', () => {
    expect(isPathExcluded('/dashboard', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/api/v1/profile', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/users', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/billing-settings', exclusions).excluded).toBe(false);
    expect(isPathExcluded('/users/billing-history', exclusions).excluded).toBe(false);
  });
});

describe('isTargetInScope', () => {
  const inScopeRules = [
    'https://example.com',
    'https://api.example.com',
    '*.target.org'
  ];

  it('allows exact authorized origins', () => {
    expect(isTargetInScope('https://example.com/login', inScopeRules).inScope).toBe(true);
    expect(isTargetInScope('https://api.example.com/v1/data', inScopeRules).inScope).toBe(true);
  });

  it('allows wildcard domain subdomains', () => {
    expect(isTargetInScope('https://sub.target.org/dashboard', inScopeRules).inScope).toBe(true);
    expect(isTargetInScope('https://auth.api.target.org/callback', inScopeRules).inScope).toBe(true);
  });

  it('allows path-scoped in-scope rules like /internal/*', () => {
    const rules = ['/internal/*', '/api/v1/*'];
    expect(isTargetInScope('http://localhost:8080/internal/feature-flags', rules).inScope).toBe(true);
    expect(isTargetInScope('http://localhost:8080/api/v1/users', rules).inScope).toBe(true);
    expect(isTargetInScope('http://localhost:8080/public/landing', rules).inScope).toBe(false);
  });

  it('blocks out-of-scope targets', () => {
    expect(isTargetInScope('https://malicious.com/pwn', inScopeRules).inScope).toBe(false);
    expect(isTargetInScope('https://example.org/api', inScopeRules).inScope).toBe(false);
    expect(isTargetInScope('https://faketarget.org.evil.com', inScopeRules).inScope).toBe(false);
  });
});

describe('checkScope Gatekeeper', () => {
  const inScope = ['https://example.com', 'https://api.example.com'];
  const exclusions = ['/logout', '/delete', '/billing'];

  it('permits valid in-scope path that is not excluded', () => {
    const result = checkScope('/api/v1/metrics', 'https://example.com', inScope, exclusions);
    expect(result.allowed).toBe(true);
    expect(result.excluded).toBe(false);
    expect(result.inScope).toBe(true);
  });

  it('blocks path matching exclusions even if on in-scope host', () => {
    const result = checkScope('/delete/account', 'https://example.com', inScope, exclusions);
    expect(result.allowed).toBe(false);
    expect(result.excluded).toBe(true);
    expect(result.reason).toContain('excluded_paths');
  });

  it('blocks target that is out-of-scope even if path is innocent', () => {
    const result = checkScope('https://unauthorized-domain.com/public', 'https://example.com', inScope, exclusions);
    expect(result.allowed).toBe(false);
    expect(result.inScope).toBe(false);
    expect(result.reason).toContain('outside authorized in-scope');
  });

  it('safely handles undefined/empty inputs without throwing', () => {
    expect(isPathExcluded('' as any, exclusions).excluded).toBe(false);
    expect(isPathExcluded(undefined as any, exclusions).excluded).toBe(false);
    expect(isTargetInScope('' as any, inScope).inScope).toBe(false);
    expect(isTargetInScope(undefined as any, inScope).inScope).toBe(false);
    const res = checkScope('' as any, '' as any, inScope, exclusions);
    expect(res.allowed).toBe(false);
  });
});
