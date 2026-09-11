import { SecretFinding, Severity, DecodedJWT } from '../types';

export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(3));
}

export function isBase64OrHex(str: string): boolean {
  // Looks like base64 or hex token of at least 16 chars
  return /^[A-Za-z0-9+/=_-]{16,}$/.test(str);
}

export function decodeJWT(token: string): DecodedJWT | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64UrlDecode = (input: string) => {
      let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    };

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    let isExpired = false;
    let expiresAt: string | undefined;
    if (payload.exp && typeof payload.exp === 'number') {
      const expDate = new Date(payload.exp * 1000);
      isExpired = expDate.getTime() < Date.now();
      expiresAt = expDate.toISOString();
    }

    const sensitiveFieldNames = [
      'password', 'secret', 'role', 'roles', 'admin', 'is_admin',
      'email', 'phone', 'ssn', 'permissions', 'scope', 'apiKey', 'private_key'
    ];

    const sensitiveClaims: string[] = [];
    for (const key of Object.keys(payload)) {
      if (sensitiveFieldNames.includes(key.toLowerCase())) {
        sensitiveClaims.push(key);
      }
    }

    return {
      header,
      payload,
      isExpired,
      expiresAt,
      sensitiveClaims
    };
  } catch {
    return null;
  }
}

export interface SecretPattern {
  name: string;
  type: SecretFinding['type'];
  regex: RegExp;
  severity: Severity;
  description: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'AWS Access Key ID',
    type: 'aws_key',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    severity: 'CRITICAL',
    description: 'AWS programmatic access key id'
  },
  {
    name: 'Google API / Firebase Key',
    type: 'google_api',
    regex: /\b(AIza[0-9A-Za-z-_]{35})\b/,
    severity: 'MEDIUM',
    description: 'Google Cloud or Firebase Web API Key'
  },
  {
    name: 'Stripe Secret Key',
    type: 'stripe',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,34})\b/,
    severity: 'CRITICAL',
    description: 'Stripe live private/secret API key'
  },
  {
    name: 'Stripe Restricted Key',
    type: 'stripe',
    regex: /\b(rk_live_[0-9a-zA-Z]{24,34})\b/,
    severity: 'CRITICAL',
    description: 'Stripe live restricted API key'
  },
  {
    name: 'Slack Webhook URL',
    type: 'slack_webhook',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8}\/B[0-9A-Z]{8,12}\/[0-9a-zA-Z]{24}/,
    severity: 'HIGH',
    description: 'Slack incoming webhook endpoint'
  },
  {
    name: 'Generic Bearer / API Token in String',
    type: 'sensitive_key',
    regex: /(?:bearer|api[_-]?key|auth[_-]?token)[\s:=]+['"]?([a-zA-Z0-9_\-\.]{24,})['"]?/i,
    severity: 'HIGH',
    description: 'Bearer or authorization secret pattern'
  }
];

export function scanStringForSecrets(
  input: string,
  keyName: string,
  location: SecretFinding['location']
): SecretFinding[] {
  const findings: SecretFinding[] = [];
  if (!input || typeof input !== 'string') return findings;

  // 1. Check for JWT
  if (input.startsWith('ey') && input.includes('.')) {
    const jwt = decodeJWT(input);
    if (jwt) {
      findings.push({
        id: `jwt_${location}_${keyName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'jwt',
        location,
        keyName,
        valueSnippet: `${input.slice(0, 16)}...${input.slice(-8)}`,
        severity: jwt.sensitiveClaims.length > 0 ? 'HIGH' : 'MEDIUM',
        details: {
          expired: jwt.isExpired,
          expiresAt: jwt.expiresAt,
          sensitiveClaims: jwt.sensitiveClaims,
          header: jwt.header,
          claims: Object.keys(jwt.payload)
        },
        timestamp: Date.now()
      });
    }
  }

  // 2. Check predefined regex patterns
  for (const pattern of SECRET_PATTERNS) {
    const match = pattern.regex.exec(input);
    if (match) {
      findings.push({
        id: `${pattern.type}_${location}_${keyName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: pattern.type,
        location,
        keyName,
        valueSnippet: match[1] || match[0].slice(0, 24) + '...',
        severity: pattern.severity,
        details: { description: pattern.description },
        timestamp: Date.now()
      });
    }
  }

  // 3. Shannon Entropy Check for unknown high-entropy keys
  // Minimum length 24, Shannon entropy > 4.5
  if (input.length >= 24 && input.length <= 256 && !input.includes(' ') && !input.includes('\n')) {
    const entropy = calculateShannonEntropy(input);
    if (entropy >= 4.6 && isBase64OrHex(input) && !findings.some(f => f.type === 'jwt')) {
      const isSensitiveKeyName = /(key|token|secret|auth|pwd|pass|cred|signature|private)/i.test(keyName);
      findings.push({
        id: `entropy_${location}_${keyName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'high_entropy',
        location,
        keyName,
        valueSnippet: `${input.slice(0, 8)}...${input.slice(-6)}`,
        entropy,
        severity: isSensitiveKeyName ? 'HIGH' : 'MEDIUM',
        details: {
          entropy,
          length: input.length,
          note: isSensitiveKeyName ? 'Key name matches sensitive identifier & high entropy' : 'Unlabeled high entropy string'
        },
        timestamp: Date.now()
      });
    }
  }

  return findings;
}
