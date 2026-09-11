import React, { useState, useMemo } from 'react';
import { TabState } from '../types';
import { Shield, FileCode, Sliders, ExternalLink, Plus, Trash2, Check, Copy, AlertCircle, Sparkles, RefreshCw, Globe, Lock } from 'lucide-react';
import { exportAuditGuardScope } from '../utils/auditguard_bridge';
import { DEFAULT_EXCLUDED_PATHS } from '../utils/scope_storage';

interface ScopeConfigTabProps {
  state: TabState;
  customExclusions: string[];
  customInScope: string[];
  onUpdateExclusions: (paths: string[]) => void;
  onUpdateInScope: (targets: string[]) => void;
  onRefreshWellKnown: () => void;
  isHarvesting?: boolean;
}

export const ScopeConfigTab: React.FC<ScopeConfigTabProps> = ({
  state,
  customExclusions = [],
  customInScope = [],
  onUpdateExclusions,
  onUpdateInScope,
  onRefreshWellKnown,
  isHarvesting
}) => {
  const [newInScopeInput, setNewInScopeInput] = useState('');
  const [newPathInput, setNewPathInput] = useState('');
  const [robotsSearch, setRobotsSearch] = useState('');
  const [copiedYaml, setCopiedYaml] = useState(false);

  let hostname = 'unknown_host';
  let origin = '';
  try {
    const urlObj = new URL(state.url);
    hostname = urlObj.hostname;
    origin = urlObj.origin;
  } catch {}

  const handleAddInScope = () => {
    let s = newInScopeInput.trim();
    if (!s) return;
    if (!customInScope.includes(s)) {
      onUpdateInScope([...customInScope, s]);
    }
    setNewInScopeInput('');
  };

  const handleRemoveInScope = (targetToRemove: string) => {
    const next = customInScope.filter(t => t !== targetToRemove);
    onUpdateInScope(next);
  };

  const handleResetInScopeDefaults = () => {
    const defaultOrigin = origin || (hostname ? `https://${hostname}` : '');
    onUpdateInScope(defaultOrigin ? [defaultOrigin] : []);
  };

  const handleAddPath = () => {
    let p = newPathInput.trim();
    if (!p) return;
    if (!p.startsWith('/') && !p.startsWith('*')) p = '/' + p;
    if (!customExclusions.includes(p)) {
      const next = [...customExclusions, p];
      onUpdateExclusions(next);
    }
    setNewPathInput('');
  };

  const handleRemovePath = (pathToRemove: string) => {
    const next = customExclusions.filter(p => p !== pathToRemove);
    onUpdateExclusions(next);
  };

  const handleResetDefaults = () => {
    onUpdateExclusions([...DEFAULT_EXCLUDED_PATHS]);
  };

  const handleImportRobotsPath = (path: string) => {
    if (!customExclusions.includes(path)) {
      onUpdateExclusions([...customExclusions, path]);
    }
  };

  const handleImportAllRobots = () => {
    const robots = state.wellKnown?.robotsDisallow || [];
    const merged = Array.from(new Set([...customExclusions, ...robots]));
    onUpdateExclusions(merged);
  };

  const filteredRobots = useMemo(() => {
    const all = state.wellKnown?.robotsDisallow || [];
    return all.filter(r => r.toLowerCase().includes(robotsSearch.toLowerCase()));
  }, [state.wellKnown?.robotsDisallow, robotsSearch]);

  const previewYaml = useMemo(() => {
    return exportAuditGuardScope(state, customExclusions, customInScope);
  }, [state, customExclusions, customInScope]);

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(previewYaml);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const sec = state.wellKnown?.securityTxt;

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto text-xs">
      {/* Top Banner: VDP & Host Overview */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Target Engagement Rules & Scope Configuration
              </h2>
              <p className="text-slate-400 text-[11px]">
                Configured for <code className="text-sky-300 font-mono">{hostname}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onRefreshWellKnown}
            disabled={isHarvesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded transition border border-slate-600 shadow-sm"
            title="Re-harvest /robots.txt and /.well-known/security.txt"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isHarvesting ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isHarvesting ? 'Harvesting...' : 'Re-harvest Metadata'}</span>
          </button>
        </div>

        {/* RFC 9116 security.txt Card */}
        {sec ? (
          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center text-indigo-300 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                Vulnerability Disclosure Policy (RFC 9116 Discovered)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Safe Harbor Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              {sec.policyUrl && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Policy URL:</span>
                  <a
                    href={sec.policyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline flex items-center font-mono text-[11px] truncate"
                  >
                    <span>{sec.policyUrl}</span>
                    <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                  </a>
                </div>
              )}

              {sec.contacts.length > 0 && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Security Contact:</span>
                  <span className="font-mono text-slate-200 text-[11px]">{sec.contacts.join(', ')}</span>
                </div>
              )}

              {sec.canonical && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Canonical Policy:</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate block">{sec.canonical}</span>
                </div>
              )}

              {sec.acknowledgmentsUrl && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Hall of Fame:</span>
                  <a
                    href={sec.acknowledgmentsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline flex items-center font-mono text-[11px] truncate"
                  >
                    <span>{sec.acknowledgmentsUrl}</span>
                    <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-700 p-2.5 rounded text-xs text-slate-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>No RFC 9116 <code>/.well-known/security.txt</code> file was published by this domain.</span>
          </div>
        )}
      </div>

      {/* Primary 2-Column Grid: In-Scope Targets & Excluded Paths */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: Authorized In-Scope Targets */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Authorized In-Scope Targets ({customInScope.length})
              </h3>
            </div>
            <button
              onClick={handleResetInScopeDefaults}
              className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
              title="Reset to target origin"
            >
              Reset to Origin
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Origins and patterns authorized by program Rules of Engagement. Active network route probing is strictly restricted to targets matching this list. Passive client-side inspection is always enabled.
          </p>

          {/* Add Target Input */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Add domain/origin (e.g. https://api.domain.com, *.domain.com)..."
              value={newInScopeInput}
              onChange={e => setNewInScopeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddInScope()}
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              onClick={handleAddInScope}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Tag List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {(customInScope || []).map(t => {
              if (!t) return null;
              const isOrigin = t === origin || t === `https://${hostname}` || t === `http://${hostname}`;
              return (
                <div
                  key={t}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900 rounded border border-slate-700/80 font-mono text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-300 font-medium">{t}</span>
                    {isOrigin && (
                      <span className="text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded uppercase font-sans">
                        Primary Origin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveInScope(t)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition"
                    title="Remove in-scope target"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Configurable Excluded Paths */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Configured Excluded Paths ({customExclusions.length})
              </h3>
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
              title="Reset to baseline (/logout, /delete, /billing)"
            >
              Reset to Defaults
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Literal paths (e.g. <code className="text-slate-300 font-mono">/billing</code>) match exact routes and direct subpaths. Use wildcards (e.g. <code className="text-slate-300 font-mono">*/billing/*</code>, <code className="text-slate-300 font-mono">*delete*</code>) to match nested segments anywhere in the path. Requests matching these rules are blocked by StateHunter &amp; AuditGuard.
          </p>

          {/* Add Path Input */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Add path (e.g. /logout, */billing/*, *delete*, /admin/*)..."
              value={newPathInput}
              onChange={e => setNewPathInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPath()}
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
            />
            <button
              onClick={handleAddPath}
              className="flex items-center space-x-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Tag List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {(customExclusions || []).map(p => {
              if (!p) return null;
              const isDefault = DEFAULT_EXCLUDED_PATHS.includes(p);
              return (
                <div
                  key={p}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900 rounded border border-slate-700/80 font-mono text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-rose-300 font-medium">{p}</span>
                    {isDefault && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded uppercase font-sans">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemovePath(p)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition"
                    title="Remove exclusion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary 2-Column Grid: robots.txt Directives & Scope YAML Preview */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: Harvested robots.txt Disallow Directives */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Harvested robots.txt Directives ({state.wellKnown?.robotsDisallow?.length || 0})
              </h3>
            </div>
            {state.wellKnown?.robotsDisallow && state.wellKnown.robotsDisallow.length > 0 && (
              <button
                onClick={handleImportAllRobots}
                className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold transition"
                title="Add all robots.txt Disallow directives to Excluded Paths"
              >
                + Add All to Excluded Paths
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Discovered from <code className="text-slate-300">/robots.txt</code>. These endpoints are marked by the target as off-limits to crawlers. Add them to your <strong>Excluded Paths</strong> to ensure they remain out-of-scope during testing.
          </p>

          <input
            type="text"
            placeholder="Search robots directives..."
            value={robotsSearch}
            onChange={e => setRobotsSearch(e.target.value)}
            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {filteredRobots.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                {(state.wellKnown?.robotsDisallow?.length ?? 0) === 0
                  ? 'No robots.txt Disallow directives found on target.'
                  : 'No directives match search.'}
              </div>
            ) : (
              <>
                {filteredRobots.slice(0, 100).map(r => {
                  const isImported = customExclusions.includes(r);
                  return (
                    <div
                      key={r}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900 rounded border border-slate-700/80 font-mono text-xs"
                    >
                      <span className="text-amber-300/90 truncate mr-2">{r}</span>
                      {isImported ? (
                        <span className="flex items-center text-[10px] text-rose-300 font-sans font-medium">
                          <Check className="w-3 h-3 mr-1 text-rose-400" /> Excluded
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportRobotsPath(r)}
                          className="flex items-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-sans border border-slate-700 transition shrink-0"
                          title="Add to Excluded Paths"
                        >
                          <Plus className="w-3 h-3 text-rose-400" />
                          <span>Exclude</span>
                        </button>
                      )}
                    </div>
                  );
                })}
                {filteredRobots.length > 100 && (
                  <div className="text-[10px] text-center text-slate-500 py-1 font-sans">
                    Showing first 100 of {filteredRobots.length} directives. Use search above to find specific paths.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Live Scope YAML Preview Box */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live AuditGuard Scope Definition (Preview)
              </h3>
            </div>
            <button
              onClick={handleCopyYaml}
              className="flex items-center space-x-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition"
            >
              {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy YAML</span>
            </button>
          </div>

          <pre className="bg-slate-950 p-3 rounded border border-slate-900 text-emerald-300 font-mono text-[11px] max-h-56 overflow-y-auto leading-relaxed">
            {previewYaml}
          </pre>
        </div>
      </div>
    </div>
  );
};
