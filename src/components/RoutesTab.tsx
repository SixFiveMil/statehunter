import React, { useState, useMemo, useRef } from 'react';
import { DiscoveredRoute, RouteProbeResult } from '../types';
import { Search, Copy, Check, ExternalLink, Play, Square, Loader2, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { probeRoutesBatch } from '../modules/route_prober';
import { isPathExcluded } from '../utils/scope_enforcer';

interface RoutesTabProps {
  routes?: DiscoveredRoute[];
  targetUrl?: string;
  customExclusions?: string[];
  customInScope?: string[];
}

export const RoutesTab: React.FC<RoutesTabProps> = ({
  routes = [],
  targetUrl = '',
  customExclusions = [],
  customInScope = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'admin' | 'api' | 'dynamic' | 'standard'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | '200' | 'auth' | '404' | 'blocked'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Active Probing States
  const [isProbing, setIsProbing] = useState(false);
  const [probeResults, setProbeResults] = useState<Record<string, RouteProbeResult>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartProbe = async () => {
    if (!targetUrl) return;
    setIsProbing(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const pathsToProbe = (routes || []).map(r => r.path).filter(Boolean);

    await probeRoutesBatch(
      targetUrl,
      pathsToProbe,
      {
        concurrency: 3,
        signal: controller.signal,
        exclusions: customExclusions,
        inScope: customInScope
      },
      (path, result) => {
        setProbeResults(prev => ({
          ...prev,
          [path]: result
        }));
      }
    );

    setIsProbing(false);
    abortControllerRef.current = null;
  };

  const handleStopProbe = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProbing(false);
      abortControllerRef.current = null;
    }
  };

  const safeRoutes = routes || [];

  const filteredRoutes = useMemo(() => {
    return safeRoutes.filter(r => {
      const safePath = r.path || '';
      const matchesSearch = safePath.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || r.type === typeFilter;

      const probe = probeResults[safePath];
      let matchesStatus = true;
      if (statusFilter === '200') {
        matchesStatus = probe?.status === 200;
      } else if (statusFilter === 'auth') {
        matchesStatus = probe?.status === 401 || probe?.status === 403;
      } else if (statusFilter === '404') {
        matchesStatus = probe?.status === 404;
      } else if (statusFilter === 'blocked') {
        matchesStatus = probe?.blocked === true || probe?.statusText === 'BLOCKED';
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [safeRoutes, searchTerm, typeFilter, statusFilter, probeResults]);

  const handleCopy = (path: string, id: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = () => {
    const text = filteredRoutes.map(r => r.path).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const handleOpenPath = (path: string) => {
    try {
      const url = new URL(path, targetUrl).toString();
      chrome.tabs.create({ url });
    } catch {
      window.open(path, '_blank');
    }
  };

  const getTypeBadge = (type: DiscoveredRoute['type']) => {
    switch (type) {
      case 'admin':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'api':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'dynamic':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getStatusBadge = (path: string, probe?: RouteProbeResult) => {
    const safePath = path || '';
    const exclCheck = isPathExcluded(safePath, customExclusions);

    if (probe?.blocked || probe?.statusText === 'BLOCKED') {
      return (
        <span
          className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-bold flex items-center w-fit"
          title={probe.blockReason || probe.error || 'Blocked: Matches Scope Exclusion Policy'}
        >
          <ShieldAlert className="w-3 h-3 mr-1 text-rose-400" />
          BLOCKED (Scope)
        </span>
      );
    }

    if (!probe) {
      if (exclCheck.excluded) {
        return (
          <span
            className="text-rose-400/90 text-[11px] font-sans flex items-center"
            title={`Protected: Rule '${exclCheck.matchedRule}' will block active probes`}
          >
            <ShieldAlert className="w-3 h-3 mr-1 text-rose-400" />
            Protected
          </span>
        );
      }
      return <span className="text-slate-500 text-[11px] font-sans">Unchecked</span>;
    }
    if (probe.probing) {
      return (
        <span className="flex items-center text-sky-400 text-[11px] font-sans">
          <Loader2 className="w-3 h-3 animate-spin mr-1" /> Probing...
        </span>
      );
    }
    if (probe.error) {
      return (
        <span className="text-slate-400 text-[11px] font-sans" title={probe.error}>
          {probe.error.slice(0, 15)}
        </span>
      );
    }

    const s = probe.status;
    if (s === 200) {
      return (
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
          200 OK {probe.latencyMs ? `(${probe.latencyMs}ms)` : ''}
        </span>
      );
    }
    if (s === 401 || s === 403) {
      return (
        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold" title="Protected Auth Endpoint">
          {s} {s === 401 ? 'Unauthorized' : 'Forbidden'}
        </span>
      );
    }
    if (s === 404) {
      return (
        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
          404 Not Found
        </span>
      );
    }

    return (
      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
        {s} {probe.statusText}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-3 max-w-6xl mx-auto">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search routes (e.g. /admin, /api/user)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Active Prober Control */}
        <div className="flex items-center space-x-2">
          {isProbing ? (
            <button
              onClick={handleStopProbe}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow transition animate-pulse"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Probing</span>
            </button>
          ) : (
            <button
              onClick={handleStartProbe}
              disabled={routes.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded text-xs font-semibold shadow transition"
              title="Batch check HTTP live status for all discovered routes"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Probe Live Status</span>
            </button>
          )}

          <button
            onClick={handleCopyAll}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 transition"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy ({filteredRoutes.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1">
          {(['all', 'admin', 'api', 'dynamic', 'standard'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded capitalize transition ${
                typeFilter === t
                  ? 'bg-sky-600 text-white font-medium'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {t} {t !== 'all' && `(${routes.filter(r => r.type === t).length})`}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1 text-xs">
          <span className="text-slate-400 text-[11px] mr-1">Status:</span>
          {(['all', '200', 'auth', '404', 'blocked'] as const).map(sf => (
            <button
              key={sf}
              onClick={() => setStatusFilter(sf)}
              className={`px-2 py-0.5 rounded text-[11px] uppercase transition ${
                statusFilter === sf
                  ? 'bg-slate-700 text-slate-100 font-bold border border-slate-500'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              {sf === 'auth' ? '401/403' : sf === 'blocked' ? 'Blocked' : sf}
            </button>
          ))}
        </div>
      </div>

      {/* Routes Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/80 sticky top-0 border-b border-slate-700 text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Path</th>
                <th className="py-2 px-3">Live Status</th>
                <th className="py-2 px-3">Source</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 font-mono">
              {filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                    No routes found matching filter.
                  </td>
                </tr>
              ) : (
                <>
                  {filteredRoutes.slice(0, 200).map(r => {
                    const safePath = r.path || '';
                    const isExcl = isPathExcluded(safePath, customExclusions).excluded;
                    return (
                      <tr key={r.id} className="hover:bg-slate-700/30 transition">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans border ${getTypeBadge(r.type)}`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-200 font-semibold">
                          <div className="flex items-center space-x-2">
                            <span>{safePath}</span>
                            {isExcl && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30 font-sans uppercase font-medium"
                                title="Designated as excluded in Scope Rules"
                              >
                                Excluded
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {getStatusBadge(safePath, probeResults[safePath])}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-[11px] font-sans">
                          {r.source === 'nextjs_manifest' ? 'Next.js Manifest' : r.source}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap font-sans">
                          <button
                            onClick={() => handleCopy(r.path, r.id)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 mr-1"
                            title="Copy Path"
                          >
                            {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleOpenPath(r.path)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRoutes.length > 200 && (
                    <tr>
                      <td colSpan={5} className="py-2.5 text-center text-slate-400 font-sans text-xs bg-slate-900/60">
                        Showing first 200 of {filteredRoutes.length} discovered routes. Use search or category filters to narrow results.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
