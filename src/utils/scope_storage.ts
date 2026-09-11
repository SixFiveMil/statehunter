export const DEFAULT_EXCLUDED_PATHS = ['/logout', '/delete', '/billing'];

export async function loadCustomExclusions(hostname: string): Promise<string[]> {
  const key = `statehunter_exclusions_${hostname}`;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key);
      if (Array.isArray(result[key])) {
        return result[key];
      }
    } else if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    }
  } catch (err) {
    console.warn('[StateHunter] Failed loading exclusions from storage:', err);
  }

  return [...DEFAULT_EXCLUDED_PATHS];
}

export async function saveCustomExclusions(hostname: string, paths: string[]): Promise<void> {
  const key = `statehunter_exclusions_${hostname}`;
  // Deduplicate and clean paths
  const cleanPaths = Array.from(new Set(paths.map(p => p.trim()).filter(Boolean)));

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: cleanPaths });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(cleanPaths));
    }
  } catch (err) {
    console.warn('[StateHunter] Failed saving exclusions to storage:', err);
  }
}

export async function loadCustomInScope(hostname: string, defaultOrigin?: string): Promise<string[]> {
  const key = `statehunter_inscope_${hostname}`;
  const defaultTargets = defaultOrigin ? [defaultOrigin] : (hostname ? [`https://${hostname}`] : []);

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key);
      if (Array.isArray(result[key]) && result[key].length > 0) {
        return result[key];
      }
    } else if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[StateHunter] Failed loading in-scope targets from storage:', err);
  }

  return defaultTargets;
}

export async function saveCustomInScope(hostname: string, targets: string[]): Promise<void> {
  const key = `statehunter_inscope_${hostname}`;
  const cleanTargets = Array.from(new Set(targets.map(t => t.trim()).filter(Boolean)));

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: cleanTargets });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(cleanTargets));
    }
  } catch (err) {
    console.warn('[StateHunter] Failed saving in-scope targets to storage:', err);
  }
}
