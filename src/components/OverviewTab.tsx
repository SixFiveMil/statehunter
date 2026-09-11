import React from 'react';
import { TabState } from '../types';
import { AlertTriangle, ShieldCheck, Zap, Globe, Key, MessageSquare } from 'lucide-react';

interface OverviewTabProps {
  state: TabState;
  onNavigateTab: (tabId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ state, onNavigateTab }) => {
  const secrets = state.secrets || [];
  const messages = state.messages || [];
  const routes = state.routes || [];
  const prototypeEvents = state.prototypeEvents || [];
  const storage = state.storage || { localStorage: {}, sessionStorage: {}, decodedJwts: {} };

  const criticalCount =
    secrets.filter(s => s.severity === 'CRITICAL').length +
    messages.filter(m => m.risk === 'CRITICAL').length +
    prototypeEvents.length;

  const highCount =
    secrets.filter(s => s.severity === 'HIGH').length +
    messages.filter(m => m.risk === 'HIGH').length;

  const medCount =
    secrets.filter(s => s.severity === 'MEDIUM').length +
    messages.filter(m => m.risk === 'MEDIUM').length;

  const riskyMessages = messages.filter(m => m.risk === 'CRITICAL' || m.risk === 'HIGH');

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-3">
        <div
          onClick={() => onNavigateTab('secrets')}
          className="bg-slate-800 border border-slate-700 hover:border-rose-500/50 p-3 rounded-lg cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Critical Risks</span>
            <AlertTriangle className={`w-4 h-4 ${criticalCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="mt-1 text-2xl font-bold text-white font-mono">{criticalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Zero-origin checks & secrets</div>
        </div>

        <div
          onClick={() => onNavigateTab('secrets')}
          className="bg-slate-800 border border-slate-700 hover:border-amber-500/50 p-3 rounded-lg cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">High Severity</span>
            <Key className={`w-4 h-4 ${highCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-1 text-2xl font-bold text-white font-mono">{highCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">JWTs & high entropy keys</div>
        </div>

        <div
          onClick={() => onNavigateTab('messages')}
          className="bg-slate-800 border border-slate-700 hover:border-sky-500/50 p-3 rounded-lg cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">postMessages</span>
            <MessageSquare className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-white font-mono">{messages.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">{riskyMessages.length} unvalidated handlers</div>
        </div>

        <div
          onClick={() => onNavigateTab('routes')}
          className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-3 rounded-lg cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">SPA Routes</span>
            <Globe className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-white font-mono">{routes.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {routes.filter(r => r.type === 'admin').length} internal/admin paths
          </div>
        </div>
      </div>

      {/* Prototype Pollution Warning Banner */}
      {prototypeEvents.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-600/50 p-3 rounded-lg flex items-start space-x-3">
          <Zap className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold text-rose-300">Client-Side Prototype Pollution Detected!</h4>
            <p className="text-xs text-rose-200/80 mt-0.5">
              Properties have been written directly to <code className="bg-rose-900/60 px-1 py-0.5 rounded text-rose-200">Object.prototype</code>:{' '}
              {prototypeEvents.map(e => e.property).join(', ')}.
            </p>
          </div>
        </div>
      )}

      {/* Framework & Recon Summary */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: Top Risk Highlights */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Priority Security Action Items</span>
            </h3>
            <span className="text-[11px] text-slate-400">Total: {criticalCount + highCount}</span>
          </div>

          {criticalCount + highCount === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mb-1" />
              <span>No critical or high risk vulnerabilities detected on this page.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {secrets
                .filter(s => s.severity === 'CRITICAL' || s.severity === 'HIGH')
                .map(s => (
                  <div key={s.id} className="p-2 rounded bg-slate-900/60 border border-slate-700/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-rose-300 font-semibold">{s.keyName}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {s.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Found in: <span className="text-slate-300 font-mono">{s.location}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded mt-1 truncate">
                      {s.valueSnippet}
                    </div>
                  </div>
                ))}

              {riskyMessages.map(m => (
                <div key={m.id} className="p-2 rounded bg-slate-900/60 border border-slate-700/50 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-medium">postMessage ({m.direction})</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {m.risk}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">{m.riskReason}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">Origin: {m.origin}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: SPA Manifest & Hydration Status */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>SPA & Hydration Intelligence</span>
            </h3>
            <span className="text-[11px] text-slate-400">Routes: {routes.length}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 bg-slate-900/60 rounded border border-slate-700/50 flex items-center justify-between">
              <span className="text-slate-400">Detected Framework:</span>
              <span className="font-semibold text-slate-200">{state.frameworkDetected || 'Generic Web / SSR'}</span>
            </div>

            <div className="p-2 bg-slate-900/60 rounded border border-slate-700/50 flex items-center justify-between">
              <span className="text-slate-400">Stored JWTs:</span>
              <span className="font-mono text-slate-200">{Object.keys(storage.decodedJwts || {}).length} tokens</span>
            </div>

            <div className="p-2 bg-slate-900/60 rounded border border-slate-700/50 flex items-center justify-between">
              <span className="text-slate-400">localStorage Entries:</span>
              <span className="font-mono text-slate-200">{Object.keys(storage.localStorage || {}).length} items</span>
            </div>

            <div className="p-2 bg-slate-900/60 rounded border border-slate-700/50 flex items-center justify-between">
              <span className="text-slate-400">sessionStorage Entries:</span>
              <span className="font-mono text-slate-200">{Object.keys(storage.sessionStorage || {}).length} items</span>
            </div>

            {routes.filter(r => r.type === 'admin').length > 0 && (
              <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded text-amber-200 text-xs">
                ⚠️ Discovered {routes.filter(r => r.type === 'admin').length} administrative / internal routes in client bundle.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
