import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { TabState, WellKnownRecon, DiscoveredRoute, SecretFinding } from '../types';
import { extractRoutesFromScriptText } from '../modules/route_extractor';
import { scanStringForSecrets } from '../modules/secret_scanner';
import { Header } from '../components/Header';
import { OverviewTab } from '../components/OverviewTab';
import { RoutesTab } from '../components/RoutesTab';
import { MessagesTab } from '../components/MessagesTab';
import { SecretsTab } from '../components/SecretsTab';
import { ScopeConfigTab } from '../components/ScopeConfigTab';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LayoutDashboard, Globe, MessageSquare, Key, Shield } from 'lucide-react';
import { harvestWellKnown } from '../modules/wellknown_harvester';
import {
  loadCustomExclusions,
  saveCustomExclusions,
  loadCustomInScope,
  saveCustomInScope,
  DEFAULT_EXCLUDED_PATHS
} from '../utils/scope_storage';

const initialTabState: TabState = {
  tabId: 0,
  url: '',
  title: '',
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
};

function getApexDomain(hostname: string): string {
  if (!hostname) return '';
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const secondToLast = parts[parts.length - 2];
  if (secondToLast.length <= 3 && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function isScriptInScope(scriptUrl: string, inspectedOrigin: string): boolean {
  try {
    const sUrl = new URL(scriptUrl);
    if (!inspectedOrigin) return true;
    const targetUrl = new URL(inspectedOrigin);

    // Always match same origin
    if (sUrl.origin === targetUrl.origin) return true;

    // Filter out common third-party ad, analytics, metric, and telemetry domains
    const thirdPartyNoise = [
      'google-analytics', 'googletagmanager', 'doubleclick', 'adsystem',
      'criteo', 'scorecardresearch', 'hotjar', 'facebook.net', 'segment.io',
      'clarity.ms', 'newrelic', 'datadoghq', 'sentry.io', 'cloudflareinsights'
    ];
    if (thirdPartyNoise.some(noise => sUrl.hostname.includes(noise))) {
      return false;
    }

    // Match same apex domain (e.g. static.example.com vs example.com)
    const targetApex = getApexDomain(targetUrl.hostname);
    const scriptApex = getApexDomain(sUrl.hostname);
    if (targetApex && scriptApex && targetApex === scriptApex) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function scanDevToolsResources(activePort: chrome.runtime.Port | null, targetOrigin?: string) {
  if (typeof chrome === 'undefined' || !chrome.devtools?.inspectedWindow?.getResources) {
    return;
  }

  const runScan = (origin: string) => {
    chrome.devtools.inspectedWindow.getResources((resources) => {
      const allScriptResources = (resources || []).filter(
        r => r.url && /\.(js|mjs|jsx|tsx|ts)($|\?)/i.test(r.url) &&
             !r.url.startsWith('chrome-extension://')
      );

      // Filter to in-scope / first-party scripts only
      const inScopeScripts = allScriptResources.filter(r => isScriptInScope(r.url, origin));

      // Limit initial automatic scan to max 12 in-scope scripts, max 350KB each
      const scriptsToScan = inScopeScripts.slice(0, 12);
      if (scriptsToScan.length === 0) return;

      const discoveredRoutes: DiscoveredRoute[] = [];
      const discoveredSecrets: SecretFinding[] = [];

      let index = 0;
      function processNextScript() {
        if (index >= scriptsToScan.length) {
          if ((discoveredRoutes.length > 0 || discoveredSecrets.length > 0) && activePort) {
            activePort.postMessage({
              type: 'MERGE_RESOURCES',
              data: { routes: discoveredRoutes, secrets: discoveredSecrets }
            });
          }
          return;
        }

        const res = scriptsToScan[index++];
        try {
          res.getContent((content) => {
            try {
              if (content && content.length > 50 && content.length <= 358400) {
                const routes = extractRoutesFromScriptText(content, 'static_script');
                const secrets = scanStringForSecrets(content, res.url, 'script');
                discoveredRoutes.push(...routes);
                discoveredSecrets.push(...secrets);
              }
            } catch (e) {
              console.debug('[StateHunter] Error scanning resource:', res.url, e);
            }
            // Yield 15ms to the browser event loop before analyzing the next script
            setTimeout(processNextScript, 15);
          });
        } catch {
          setTimeout(processNextScript, 15);
        }
      }

      processNextScript();
    });
  };

  if (targetOrigin) {
    runScan(targetOrigin);
  } else {
    try {
      chrome.devtools.inspectedWindow.eval('window.location.origin', (res, err) => {
        const origin = (typeof res === 'string' && res !== 'null') ? res : '';
        runScan(origin);
      });
    } catch {
      runScan('');
    }
  }
}

const PanelApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'routes' | 'messages' | 'secrets' | 'scope'>('overview');
  const [tabState, setTabState] = useState<TabState>(initialTabState);
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  // Scope & Well-Known States
  const [customExclusions, setCustomExclusions] = useState<string[]>([...DEFAULT_EXCLUDED_PATHS]);
  const [customInScope, setCustomInScope] = useState<string[]>([]);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const lastHarvestedOriginRef = useRef<string>('');

  useEffect(() => {
    // Determine inspected tab ID
    let currentTabId = 0;
    try {
      if (typeof chrome !== 'undefined' && chrome.devtools?.inspectedWindow) {
        currentTabId = chrome.devtools.inspectedWindow.tabId;
      }
    } catch {
      // debug mode
    }

    if (!currentTabId) {
      console.debug('[StateHunter DevTools] Running in preview / detached mode');
      return;
    }

    // Connect to background service worker
    try {
      const p = chrome.runtime.connect({ name: `statehunter-devtools-${currentTabId}` });
      setPort(p);

      // Scan cached scripts from DevTools without duplicate network requests
      scanDevToolsResources(p);

      p.onMessage.addListener((msg) => {
        if (msg.type === 'STATE_UPDATE' && msg.state) {
          const s = msg.state;
          setTabState(prev => ({
            ...s,
            routes: s.routes || [],
            messages: s.messages || [],
            secrets: s.secrets || [],
            prototypeEvents: s.prototypeEvents || [],
            storage: {
              localStorage: s.storage?.localStorage || {},
              sessionStorage: s.storage?.sessionStorage || {},
              decodedJwts: s.storage?.decodedJwts || {}
            },
            wellKnown: prev.wellKnown || s.wellKnown
          }));
        }
      });

      return () => {
        p.disconnect();
      };
    } catch (err) {
      console.error('[StateHunter DevTools] Connection error:', err);
    }
  }, []);

  // Trigger well-known metadata harvesting and load stored exclusions when URL changes
  useEffect(() => {
    if (!tabState.url) return;

    try {
      const urlObj = new URL(tabState.url);
      const origin = urlObj.origin;
      const hostname = urlObj.hostname;

      if (!origin || origin === 'null' || origin.startsWith('chrome')) return;

      // 1. Load saved exclusions and in-scope targets for this host
      loadCustomExclusions(hostname).then(paths => {
        setCustomExclusions(paths);
      });
      loadCustomInScope(hostname, origin).then(targets => {
        setCustomInScope(targets);
      });

      // 2. Harvest well-known metadata if origin changed
      if (origin !== lastHarvestedOriginRef.current) {
        lastHarvestedOriginRef.current = origin;
        setIsHarvesting(true);

        harvestWellKnown(origin)
          .then(wk => {
            setTabState(prev => ({
              ...prev,
              wellKnown: wk
            }));
          })
          .finally(() => {
            setIsHarvesting(false);
          });
      }
    } catch {
      // Invalid URL format
    }
  }, [tabState.url]);

  const handleRefreshWellKnown = () => {
    if (!tabState.url) return;
    try {
      const origin = new URL(tabState.url).origin;
      setIsHarvesting(true);
      harvestWellKnown(origin)
        .then(wk => {
          setTabState(prev => ({ ...prev, wellKnown: wk }));
        })
        .finally(() => setIsHarvesting(false));
    } catch {}
  };

  const handleUpdateExclusions = (paths: string[]) => {
    setCustomExclusions(paths);
    try {
      const hostname = new URL(tabState.url).hostname;
      saveCustomExclusions(hostname, paths);
    } catch {}
  };

  const handleUpdateInScope = (targets: string[]) => {
    setCustomInScope(targets);
    try {
      const hostname = new URL(tabState.url).hostname;
      saveCustomInScope(hostname, targets);
    } catch {}
  };

  const handleRescan = () => {
    if (port) {
      port.postMessage({ type: 'REQUEST_RESCAN' });
      try {
        const origin = tabState.url ? new URL(tabState.url).origin : undefined;
        scanDevToolsResources(port, origin);
      } catch {
        scanDevToolsResources(port);
      }
    }
  };

  const handleClear = () => {
    if (port) {
      port.postMessage({ type: 'CLEAR_STATE' });
    } else {
      setTabState(initialTabState);
    }
  };

  const secrets = tabState.secrets || [];
  const messages = tabState.messages || [];
  const prototypeEvents = tabState.prototypeEvents || [];
  const criticalAndHigh =
    secrets.filter(s => s.severity === 'CRITICAL' || s.severity === 'HIGH').length +
    messages.filter(m => m.risk === 'CRITICAL' || m.risk === 'HIGH').length +
    prototypeEvents.length;

  const handleDispatchPostMessage = (params: any) => {
    if (port) {
      port.postMessage({
        type: 'DISPATCH_POST_MESSAGE',
        params
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 select-text overflow-hidden">
      {/* Top Header */}
      <Header
        state={tabState}
        customExclusions={customExclusions}
        customInScope={customInScope}
        onRescan={handleRescan}
        onClear={handleClear}
      />

      {/* DevTools Active Guidance Banner */}
      {tabState.routes.length === 0 && tabState.messages.length === 0 && tabState.secrets.length === 0 && (
        <div className="bg-sky-950/40 border-b border-sky-800/40 px-4 py-1.5 flex items-center justify-between text-xs text-sky-300">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sky-400">⚡ StateHunter Active:</span>
            <span>Reload page (<kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-200 border border-slate-700 font-mono">F5</kbd> / <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-200 border border-slate-700 font-mono">Ctrl+R</kbd>) with DevTools open to capture early bootstrap scripts, postMessage handshakes, and prototype hooks.</span>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <nav className="bg-slate-800/80 border-b border-slate-700/80 px-4 flex items-center space-x-1 shrink-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Overview</span>
          {criticalAndHigh > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold">
              {criticalAndHigh}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'routes'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>SPA Routes</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-300">
            {tabState.routes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'messages'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>postMessage</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-300">
            {tabState.messages.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('secrets')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'secrets'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Secrets & Storage</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-300">
            {tabState.secrets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scope')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'scope'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Scope & Rules</span>
          {tabState.wellKnown?.securityTxt?.policyUrl && (
            <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 inline-block" title="RFC 9116 Policy Detected" />
          )}
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <OverviewTab state={tabState} onNavigateTab={(t) => setActiveTab(t as any)} />
        )}
        {activeTab === 'routes' && (
          <RoutesTab
            routes={tabState.routes}
            targetUrl={tabState.url}
            customExclusions={customExclusions}
            customInScope={customInScope}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesTab messages={tabState.messages} onDispatch={handleDispatchPostMessage} />
        )}
        {activeTab === 'secrets' && <SecretsTab state={tabState} />}
        {activeTab === 'scope' && (
          <ScopeConfigTab
            state={tabState}
            customExclusions={customExclusions}
            customInScope={customInScope}
            onUpdateExclusions={handleUpdateExclusions}
            onUpdateInScope={handleUpdateInScope}
            onRefreshWellKnown={handleRefreshWellKnown}
            isHarvesting={isHarvesting}
          />
        )}
      </main>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <PanelApp />
    </ErrorBoundary>
  );
}
