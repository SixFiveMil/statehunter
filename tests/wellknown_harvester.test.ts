import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, parseSecurityTxt } from '../src/modules/wellknown_harvester';

describe('parseRobotsTxt', () => {
  it('extracts Disallow directives and ignores comments & empty lines', () => {
    const raw = `
      # Notice to crawlers
      User-agent: *
      Disallow: /admin
      Disallow: /private/api/
      Disallow: /checkout/payment # inline comment
      Disallow: 
      Allow: /public
    `;

    const paths = parseRobotsTxt(raw);
    expect(paths).toContain('/admin');
    expect(paths).toContain('/private/api/');
    expect(paths).toContain('/checkout/payment');
    expect(paths).not.toContain('/public');
    expect(paths.length).toBe(3);
  });

  it('handles empty or malformed robots.txt gracefully', () => {
    expect(parseRobotsTxt('')).toEqual([]);
    expect(parseRobotsTxt('# only comments\n# nothing else')).toEqual([]);
  });
});

describe('parseSecurityTxt', () => {
  it('parses RFC 9116 security.txt directives', () => {
    const raw = `
      Contact: mailto:security@corp.internal
      Contact: https://bounty.corp.internal/report
      Policy: https://bounty.corp.internal/policy
      Acknowledgments: https://corp.internal/hall-of-fame
      Canonical: https://corp.internal/.well-known/security.txt
      Preferred-Languages: en, es
      Expires: 2028-12-31T23:59:59.000Z
    `;

    const sec = parseSecurityTxt(raw);
    expect(sec.contacts).toContain('mailto:security@corp.internal');
    expect(sec.contacts).toContain('https://bounty.corp.internal/report');
    expect(sec.policyUrl).toBe('https://bounty.corp.internal/policy');
    expect(sec.acknowledgmentsUrl).toBe('https://corp.internal/hall-of-fame');
    expect(sec.canonical).toBe('https://corp.internal/.well-known/security.txt');
    expect(sec.preferredLanguages).toBe('en, es');
  });

  it('handles empty security.txt input', () => {
    const sec = parseSecurityTxt('');
    expect(sec.contacts).toEqual([]);
    expect(sec.policyUrl).toBeUndefined();
  });
});
