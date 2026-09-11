import { TabState, DiscoveredRoute, SecretFinding, PostMessageAudit, PrototypePollutionEvent } from '../types';

const tabStates = new Map<number, TabState>();
const devtoolsPorts = new Map<number, chrome.runtime.Port[]>();

function getOrCreateTabState(tabId: number, url = '', title = ''): TabState {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      tabId,
      url,
      title,
      routes: [],
      messages: [],
      secrets: [],
      prototypeEvents: [],
      storage: {
        localStorage: {},
        sessionStorage: {},
        decodedJwts: {}
      },
      lastScanned: Date.now()
    });
  }
  const state = tabStates.get(tabId)!;
  if (url) state.url = url;
  if (title) state.title = title;
  return state;
}

function updateBadge(tabId: number, state: TabState) {
  try {
    const criticalCount =
      state.secrets.filter(s => s.severity === 'CRITICAL').length +
      state.messages.filter(m => m.risk === 'CRITICAL').length +
      state.prototypeEvents.length;

    const highCount =
      state.secrets.filter(s => s.severity === 'HIGH').length +
      state.messages.filter(m => m.risk === 'HIGH').length;

    const totalIssues = criticalCount + highCount;

    if (totalIssues > 0) {
      chrome.action.setBadgeText({ tabId, text: String(totalIssues) });
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: criticalCount > 0 ? '#ef4444' : '#f59e0b'
      });
    } else {
      const infoCount = state.routes.length + state.messages.length;
      if (infoCount > 0) {
        chrome.action.setBadgeText({ tabId, text: `${infoCount}` });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#38bdf8' });
      } else {
        chrome.action.setBadgeText({ tabId, text: '' });
      }
    }
  } catch {
    // Tab might be closing
  }
}

function notifyDevTools(tabId: number, state: TabState) {
  const ports = devtoolsPorts.get(tabId);
  if (ports && ports.length > 0) {
    for (const port of ports) {
      try {
        port.postMessage({ type: 'STATE_UPDATE', state });
      } catch (err) {
        console.debug('[StateHunter SW] Port send failed:', err);
      }
    }
  }
}

// 1. Listen for telemetry messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'STATEHUNTER_TELEMETRY' && sender.tab?.id) {
    const tabId = sender.tab.id;
    const state = getOrCreateTabState(tabId, message.url, message.title);
    const { telemetryType, data } = message;

    if (telemetryType === 'POST_MESSAGE') {
      const audit = data as PostMessageAudit;
      // Avoid exact duplicates
      if (!state.messages.some(m => m.id === audit.id || (m.timestamp === audit.timestamp && m.payloadSnippet === audit.payloadSnippet))) {
        state.messages.unshift(audit);
        // Keep last 200 messages
        if (state.messages.length > 200) state.messages.pop();
      }
    } else if (telemetryType === 'PROTOTYPE_POLLUTION') {
      const ppEvent = data as PrototypePollutionEvent;
      state.prototypeEvents.unshift(ppEvent);
    } else if (telemetryType === 'FULL_SCAN_RESULT') {
      if (data.framework) state.frameworkDetected = data.framework;

      // Merge unique routes
      const existingPaths = new Set(state.routes.map(r => r.path));
      for (const route of data.routes || []) {
        if (!existingPaths.has(route.path)) {
          state.routes.push(route);
          existingPaths.add(route.path);
        }
      }

      // Merge unique secrets
      const existingSecretKeys = new Set(state.secrets.map(s => `${s.location}:${s.keyName}:${s.valueSnippet}`));
      for (const sec of data.secrets || []) {
        const sig = `${sec.location}:${sec.keyName}:${sec.valueSnippet}`;
        if (!existingSecretKeys.has(sig)) {
          state.secrets.push(sec);
          existingSecretKeys.add(sig);
        }
      }

      // Merge storage
      if (data.storage) {
        state.storage = {
          localStorage: { ...state.storage.localStorage, ...data.storage.localStorage },
          sessionStorage: { ...state.storage.sessionStorage, ...data.storage.sessionStorage },
          decodedJwts: { ...state.storage.decodedJwts, ...data.storage.decodedJwts }
        };
      }

      state.lastScanned = Date.now();
    }

    updateBadge(tabId, state);
    notifyDevTools(tabId, state);
    sendResponse({ received: true });
  }
  return true;
});

async function injectProbesIntoTab(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about:') || tab.url.startsWith('edge:')) {
      return;
    }

    // 1. Inject main_probe into MAIN world (top frame only to avoid ad/tracking iframe overhead)
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['main_probe.js'],
      world: 'MAIN'
    });

    // 2. Inject isolated_bridge into ISOLATED world (top frame only)
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['isolated_bridge.js'],
      world: 'ISOLATED'
    });

    console.debug(`[StateHunter SW] Dynamically injected probes into top frame of tab ${tabId}`);
  } catch (err) {
    console.debug('[StateHunter SW] Probe injection error for tab', tabId, err);
  }
}

// 2. Manage DevTools Panel connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('statehunter-devtools-')) {
    const tabId = parseInt(port.name.replace('statehunter-devtools-', ''), 10);
    if (!isNaN(tabId)) {
      if (!devtoolsPorts.has(tabId)) {
        devtoolsPorts.set(tabId, []);
      }
      devtoolsPorts.get(tabId)!.push(port);

      // DevTools panel opened: inject probes dynamically
      injectProbesIntoTab(tabId);

      // Send initial state immediately
      const state = getOrCreateTabState(tabId);
      port.postMessage({ type: 'STATE_UPDATE', state });

      // Handle DevTools port messages (e.g. rescan request)
      port.onMessage.addListener((msg) => {
        if (msg.type === 'REQUEST_RESCAN') {
          injectProbesIntoTab(tabId).then(() => {
            chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_RESCAN' }).catch(() => {});
          });
        } else if (msg.type === 'DISPATCH_POST_MESSAGE') {
          chrome.tabs.sendMessage(tabId, {
            type: 'DISPATCH_POST_MESSAGE',
            params: msg.params
          }).catch(() => {});
        } else if (msg.type === 'MERGE_RESOURCES' && msg.data) {
          const s = getOrCreateTabState(tabId);
          if (msg.data.routes) {
            const existingPaths = new Set(s.routes.map(r => r.path));
            for (const route of msg.data.routes) {
              if (!existingPaths.has(route.path)) {
                s.routes.push(route);
                existingPaths.add(route.path);
              }
            }
          }
          if (msg.data.secrets) {
            const existingSecretKeys = new Set(s.secrets.map(sec => `${sec.location}:${sec.keyName}:${sec.valueSnippet}`));
            for (const sec of msg.data.secrets) {
              const sig = `${sec.location}:${sec.keyName}:${sec.valueSnippet}`;
              if (!existingSecretKeys.has(sig)) {
                s.secrets.push(sec);
                existingSecretKeys.add(sig);
              }
            }
          }
          updateBadge(tabId, s);
          notifyDevTools(tabId, s);
        } else if (msg.type === 'CLEAR_STATE') {
          tabStates.delete(tabId);
          const newState = getOrCreateTabState(tabId);
          updateBadge(tabId, newState);
          port.postMessage({ type: 'STATE_UPDATE', state: newState });
        }
      });

      // Cleanup on disconnect
      port.onDisconnect.addListener(() => {
        const currentPorts = devtoolsPorts.get(tabId) || [];
        const index = currentPorts.indexOf(port);
        if (index !== -1) {
          currentPorts.splice(index, 1);
        }
        if (currentPorts.length === 0) {
          devtoolsPorts.delete(tabId);
          try {
            chrome.action.setBadgeText({ tabId, text: '' });
          } catch {}
        }
      });
    }
  }
});

// 3. Tab lifecycle cleanup & reset on navigation (only active when DevTools is connected)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (devtoolsPorts.has(tabId) && changeInfo.status === 'loading') {
    // Reset state for top-level navigation / reload while DevTools is open
    const state = getOrCreateTabState(tabId, changeInfo.url || '');
    state.routes = [];
    state.messages = [];
    state.secrets = [];
    state.prototypeEvents = [];
    state.lastScanned = Date.now();
    updateBadge(tabId, state);
    notifyDevTools(tabId, state);

    // Re-inject for the newly loading page
    injectProbesIntoTab(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  devtoolsPorts.delete(tabId);
});
