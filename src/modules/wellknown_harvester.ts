import { SecurityPolicyInfo, WellKnownRecon } from '../types';

export function parseRobotsTxt(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return [];

  const disallowPaths = new Set<string>();
  const lines = raw.split('\n');

  for (let line of lines) {
    // Strip comments
    const commentIndex = line.indexOf('#');
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    line = line.trim();
    if (!line) continue;

    // Match Disallow: <path>
    const match = /^Disallow:\s*(.+)$/i.exec(line);
    if (match) {
      let path = match[1].trim();
      // Ignore trailing wildcards if any or normalize
      if (path && path !== '') {
        // Strip query string anchors if plain path
        disallowPaths.add(path);
        if (disallowPaths.size >= 300) break; // Cap to 300 rules max to protect memory/rendering
      }
    }
  }

  return Array.from(disallowPaths);
}

export function parseSecurityTxt(raw: string): SecurityPolicyInfo {
  const info: SecurityPolicyInfo = {
    contacts: [],
    rawText: raw
  };

  if (!raw || typeof raw !== 'string') return info;

  const lines = raw.split('\n');
  for (let line of lines) {
    const commentIndex = line.indexOf('#');
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    line = line.trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const field = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    switch (field) {
      case 'contact':
        info.contacts.push(value);
        break;
      case 'policy':
        info.policyUrl = value;
        break;
      case 'acknowledgments':
      case 'acknowledgements':
        info.acknowledgmentsUrl = value;
        break;
      case 'canonical':
        info.canonical = value;
        break;
      case 'preferred-languages':
        info.preferredLanguages = value;
        break;
      case 'expires':
        info.expires = value;
        break;
    }
  }

  return info;
}

async function fetchWithTimeout(url: string, timeoutMs = 2500): Promise<string | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const text = await res.text();
    // Safety check: HTML responses for 404 pages (some servers return 200 with HTML error)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      return null;
    }
    return text;
  } catch {
    clearTimeout(id);
    return null;
  }
}

export async function harvestWellKnown(origin: string): Promise<WellKnownRecon> {
  const result: WellKnownRecon = {
    robotsDisallow: [],
    fetchedAt: Date.now()
  };

  if (!origin || origin === 'null' || origin.startsWith('chrome') || origin.startsWith('about:')) {
    return result;
  }

  // 1. Fetch robots.txt
  try {
    const robotsUrl = new URL('/robots.txt', origin).toString();
    const robotsText = await fetchWithTimeout(robotsUrl);
    if (robotsText) {
      result.robotsRaw = robotsText;
      result.robotsDisallow = parseRobotsTxt(robotsText);
    }
  } catch (err) {
    console.debug('[StateHunter] Error fetching robots.txt:', err);
  }

  // 2. Fetch security.txt (Try .well-known/security.txt first, then /security.txt)
  try {
    const primaryUrl = new URL('/.well-known/security.txt', origin).toString();
    let secText = await fetchWithTimeout(primaryUrl);

    if (!secText) {
      const fallbackUrl = new URL('/security.txt', origin).toString();
      secText = await fetchWithTimeout(fallbackUrl);
    }

    if (secText) {
      result.securityTxt = parseSecurityTxt(secText);
    }
  } catch (err) {
    console.debug('[StateHunter] Error fetching security.txt:', err);
  }

  return result;
}
