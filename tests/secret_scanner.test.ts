import { describe, it, expect } from 'vitest';
import { calculateShannonEntropy, decodeJWT, scanStringForSecrets } from '../src/modules/secret_scanner';

describe('calculateShannonEntropy', () => {
  it('returns 0 for empty string', () => {
    expect(calculateShannonEntropy('')).toBe(0);
  });

  it('calculates higher entropy for random alphanumeric strings', () => {
    const lowEntropy = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const highEntropy = 'd9F8xK2qL4vB0mZ7wP1eR3tY5uI6oA8s';
    expect(calculateShannonEntropy(lowEntropy)).toBe(0);
    expect(calculateShannonEntropy(highEntropy)).toBeGreaterThan(4.5);
  });
});

describe('decodeJWT', () => {
  it('decodes standard JWT parts and identifies sensitive claims', () => {
    // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
    // Payload: {"sub":"1234567890","name":"John Doe","role":"admin","email":"admin@corp.internal","exp":1767225600}
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBjb3JwLmludGVybmFsIiwiZXhwIjoxNzY3MjI1NjAwfQ.signature';

    const decoded = decodeJWT(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.payload.sub).toBe('1234567890');
    expect(decoded?.payload.role).toBe('admin');
    expect(decoded?.sensitiveClaims).toContain('role');
    expect(decoded?.sensitiveClaims).toContain('email');
  });

  it('returns null for non-JWT strings', () => {
    expect(decodeJWT('not-a-token')).toBeNull();
  });
});

describe('scanStringForSecrets', () => {
  it('detects AWS Access Key ID', () => {
    const text = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE';
    const findings = scanStringForSecrets(text, 'AWS_KEY', 'localStorage');
    expect(findings.some(f => f.type === 'aws_key' && f.severity === 'CRITICAL')).toBe(true);
  });

  it('detects Stripe Secret Key', () => {
    const text = 'sk_live_' + '51ABC1234567890DEF1234567890XYZ';
    const findings = scanStringForSecrets(text, 'stripe_key', 'sessionStorage');
    expect(findings.some(f => f.type === 'stripe' && f.severity === 'CRITICAL')).toBe(true);
  });

  it('detects Slack Webhook URL', () => {
    const text = 'https://hooks.slack.com/' + 'services/T12345678/B12345678/123456789012345678901234';
    const findings = scanStringForSecrets(text, 'slack_url', 'window_global');
    expect(findings.some(f => f.type === 'slack_webhook')).toBe(true);
  });
});
