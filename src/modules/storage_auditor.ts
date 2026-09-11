import { SecretFinding, DecodedJWT } from '../types';
import { scanStringForSecrets, decodeJWT } from './secret_scanner';

export interface StorageAuditResult {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  findings: SecretFinding[];
  decodedJwts: Record<string, DecodedJWT>;
}

export function auditBrowserStorage(): StorageAuditResult {
  const result: StorageAuditResult = {
    localStorage: {},
    sessionStorage: {},
    findings: [],
    decodedJwts: {}
  };

  // 1. Audit localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || '';
      result.localStorage[key] = value;

      const secrets = scanStringForSecrets(value, key, 'localStorage');
      result.findings.push(...secrets);

      // Check if value is or contains JWT
      const jwt = decodeJWT(value);
      if (jwt) {
        result.decodedJwts[`local:${key}`] = jwt;
      }
    }
  } catch (err) {
    console.warn('[StateHunter] Could not access localStorage:', err);
  }

  // 2. Audit sessionStorage
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      const value = sessionStorage.getItem(key) || '';
      result.sessionStorage[key] = value;

      const secrets = scanStringForSecrets(value, key, 'sessionStorage');
      result.findings.push(...secrets);

      // Check if value is or contains JWT
      const jwt = decodeJWT(value);
      if (jwt) {
        result.decodedJwts[`session:${key}`] = jwt;
      }
    }
  } catch (err) {
    console.warn('[StateHunter] Could not access sessionStorage:', err);
  }

  return result;
}
