import { ScopeCheckResult } from '../types';

function escapeRegex(str: string): string {
  return str.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether a given path or subpath matches any excluded path rule.
 * Supports exact match, subpath prefix matching (e.g. /logout matches /logout/confirm),
 * and wildcard matching (e.g. /admin/* or *delete*).
 */
export function isPathExcluded(
  targetPath: string,
  exclusions: string[] = []
): { excluded: boolean; matchedRule?: string } {
  if (!targetPath || typeof targetPath !== 'string' || !exclusions || exclusions.length === 0) {
    return { excluded: false };
  }

  // Normalize targetPath: ensure leading slash, isolate path from query/hash
  let normalizedPath = targetPath.trim();
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  const pathWithoutQuery = normalizedPath.split('?')[0].split('#')[0];
  const cleanPath = (pathWithoutQuery.length > 1 && pathWithoutQuery.endsWith('/'))
    ? pathWithoutQuery.slice(0, -1)
    : pathWithoutQuery;

  for (const rawRule of exclusions) {
    const rule = rawRule.trim();
    if (!rule) continue;

    // 1. Wildcard rule (contains *)
    if (rule.includes('*')) {
      let wildcardRule = rule;
      if (!wildcardRule.startsWith('/') && !wildcardRule.startsWith('*')) {
        wildcardRule = '/' + wildcardRule;
      }
      const pattern = '^' + wildcardRule.split('*').map(escapeRegex).join('.*') + '$';
      const regex = new RegExp(pattern, 'i');
      if (regex.test(normalizedPath) || regex.test(pathWithoutQuery) || regex.test(cleanPath)) {
        return { excluded: true, matchedRule: rule };
      }
      continue;
    }

    // Normalize rule path
    let normRule = rule;
    if (!normRule.startsWith('/')) {
      normRule = '/' + normRule;
    }
    // Remove trailing slash if not root
    if (normRule.length > 1 && normRule.endsWith('/')) {
      normRule = normRule.slice(0, -1);
    }

    const lowerPath = pathWithoutQuery.toLowerCase();
    const lowerCleanPath = cleanPath.toLowerCase();
    const lowerRule = normRule.toLowerCase();

    // 2. Exact match (e.g. /billing or /billing/)
    if (lowerPath === lowerRule || lowerCleanPath === lowerRule) {
      return { excluded: true, matchedRule: rule };
    }

    // 3. Subpath prefix match: e.g. rule /logout matches /logout/confirm or /logout?return=1
    if (
      lowerPath.startsWith(lowerRule + '/') ||
      normalizedPath.toLowerCase().startsWith(lowerRule + '?') ||
      normalizedPath.toLowerCase().startsWith(lowerRule + '#')
    ) {
      return { excluded: true, matchedRule: rule };
    }
  }

  return { excluded: false };
}

/**
 * Checks whether a given target URL matches any authorized in-scope rule.
 * Supports exact origins, wildcards (e.g. *.example.com), and path-scoped origins.
 */
export function isTargetInScope(
  targetUrl: string,
  inScopeRules: string[] = []
): { inScope: boolean; matchedRule?: string } {
  // If no in-scope rules defined, default to allowing
  if (!inScopeRules || inScopeRules.length === 0) {
    return { inScope: true };
  }
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { inScope: false };
  }

  let urlObj: URL;
  try {
    urlObj = new URL(targetUrl);
  } catch {
    return { inScope: false };
  }

  const targetOrigin = urlObj.origin.toLowerCase();
  const targetHost = urlObj.hostname.toLowerCase();
  const targetPath = urlObj.pathname.toLowerCase();

  for (const rawRule of inScopeRules) {
    const rule = rawRule.trim();
    if (!rule) continue;

    // Rule is wildcard hostname (e.g. *.example.com or *.example.com:8080)
    if (rule.startsWith('*.')) {
      const baseDomain = rule.slice(2).toLowerCase().split(':')[0];
      if (targetHost === baseDomain || targetHost.endsWith('.' + baseDomain)) {
        return { inScope: true, matchedRule: rule };
      }
      continue;
    }

    // Rule contains wildcard *
    if (rule.includes('*')) {
      const pattern = '^' + rule.split('*').map(escapeRegex).join('.*') + '$';
      const regex = new RegExp(pattern, 'i');
      if (
        regex.test(targetOrigin) ||
        regex.test(targetHost) ||
        regex.test(targetUrl) ||
        regex.test(targetPath)
      ) {
        return { inScope: true, matchedRule: rule };
      }
      continue;
    }

    // Rule is path prefix (e.g. /internal or /api)
    if (rule.startsWith('/')) {
      if (targetPath === rule.toLowerCase() || targetPath.startsWith(rule.toLowerCase() + '/')) {
        return { inScope: true, matchedRule: rule };
      }
      continue;
    }

    // Rule looks like an absolute URL / origin (http:// or https://)
    if (rule.startsWith('http://') || rule.startsWith('https://')) {
      try {
        const ruleObj = new URL(rule);
        // Check origin match
        if (ruleObj.origin.toLowerCase() === targetOrigin) {
          // If rule has specific path (e.g. https://example.com/api), check prefix
          if (ruleObj.pathname && ruleObj.pathname !== '/') {
            if (targetPath.startsWith(ruleObj.pathname.toLowerCase())) {
              return { inScope: true, matchedRule: rule };
            }
          } else {
            return { inScope: true, matchedRule: rule };
          }
        }
      } catch {
        // Fallback to string prefix
        if (targetUrl.toLowerCase().startsWith(rule.toLowerCase())) {
          return { inScope: true, matchedRule: rule };
        }
      }
      continue;
    }

    // Rule is plain hostname or IP (e.g. api.example.com or localhost)
    if (targetHost === rule.toLowerCase() || targetHost.endsWith('.' + rule.toLowerCase())) {
      return { inScope: true, matchedRule: rule };
    }
  }

  return { inScope: false };
}

/**
 * Combined Scope and Exclusion Gatekeeper.
 * Evaluates both in-scope targets and excluded paths.
 */
export function checkScope(
  targetUrlOrPath: string,
  baseUrl: string,
  inScopeRules: string[] = [],
  exclusions: string[] = []
): ScopeCheckResult {
  if (!targetUrlOrPath || !baseUrl || typeof targetUrlOrPath !== 'string' || typeof baseUrl !== 'string') {
    return {
      allowed: false,
      inScope: false,
      excluded: false,
      reason: 'Missing or invalid target URL or base URL'
    };
  }

  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(targetUrlOrPath, baseUrl);
  } catch {
    return {
      allowed: false,
      inScope: false,
      excluded: false,
      reason: 'Invalid URL format'
    };
  }

  // 1. Check Excluded Paths First (Safety Barrier)
  const pathWithSearch = resolvedUrl.pathname + resolvedUrl.search;
  const exclusionCheck = isPathExcluded(pathWithSearch, exclusions);
  if (exclusionCheck.excluded) {
    return {
      allowed: false,
      inScope: true,
      excluded: true,
      matchedRule: exclusionCheck.matchedRule,
      reason: `Blocked: Matches excluded_paths policy '${exclusionCheck.matchedRule}'`
    };
  }

  // 2. Check In-Scope Targets
  // If inScopeRules is provided, verify resolvedUrl matches in-scope rules
  if (inScopeRules && inScopeRules.length > 0) {
    const inScopeCheck = isTargetInScope(resolvedUrl.toString(), inScopeRules);
    if (!inScopeCheck.inScope) {
      return {
        allowed: false,
        inScope: false,
        excluded: false,
        reason: `Blocked: Target '${resolvedUrl.origin}' is outside authorized in-scope rules`
      };
    }
    return {
      allowed: true,
      inScope: true,
      excluded: false,
      matchedRule: inScopeCheck.matchedRule
    };
  }

  return {
    allowed: true,
    inScope: true,
    excluded: false
  };
}
