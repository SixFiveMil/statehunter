import React, { useState } from 'react';
import { PostMessageAudit, PostMessageDispatchPayload } from '../types';
import { ShieldAlert, ShieldCheck, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Copy, Check, Send, Play, X, Sparkles } from 'lucide-react';

interface MessagesTabProps {
  messages?: PostMessageAudit[];
  onDispatch?: (params: PostMessageDispatchPayload) => void;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ messages = [], onDispatch }) => {
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [riskyOnly, setRiskyOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dispatcher Console State
  const [isDispatcherOpen, setIsDispatcherOpen] = useState(false);
  const [dispatchOrigin, setDispatchOrigin] = useState('*');
  const [dispatchPayloadStr, setDispatchPayloadStr] = useState('{\n  "action": "TEST_PROBE",\n  "timestamp": 123456\n}');
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleCopyPayload = (payload: any, id: string) => {
    navigator.clipboard.writeText(typeof payload === 'object' ? JSON.stringify(payload, null, 2) : String(payload));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleOpenReplay = (msg: PostMessageAudit) => {
    setDispatchOrigin(msg.targetOrigin || msg.origin || '*');
    setDispatchPayloadStr(
      typeof msg.fullPayload === 'object'
        ? JSON.stringify(msg.fullPayload, null, 2)
        : String(msg.fullPayload || '{}')
    );
    setPayloadError(null);
    setIsDispatcherOpen(true);
  };

  const handleSendDispatch = () => {
    try {
      const parsed = JSON.parse(dispatchPayloadStr);
      setPayloadError(null);
      if (onDispatch) {
        onDispatch({
          targetOrigin: dispatchOrigin.trim() || '*',
          payload: parsed
        });
        setDispatchSuccessMsg('Message dispatched successfully into page runtime!');
        setTimeout(() => setDispatchSuccessMsg(null), 3000);
      }
    } catch (e: any) {
      setPayloadError(`Invalid JSON: ${e.message}`);
    }
  };

  const applyTemplate = (templateObj: any, origin = '*') => {
    setDispatchOrigin(origin);
    setDispatchPayloadStr(JSON.stringify(templateObj, null, 2));
    setPayloadError(null);
  };

  const safeMessages = messages || [];
  const filtered = safeMessages.filter(m => {
    if (directionFilter !== 'all' && m.direction !== directionFilter) return false;
    if (riskyOnly && m.risk !== 'CRITICAL' && m.risk !== 'HIGH' && m.risk !== 'MEDIUM') return false;
    return true;
  });

  const getRiskBadge = (risk: PostMessageAudit['risk']) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="p-4 space-y-3 max-w-6xl mx-auto relative">
      {/* Control Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {(['all', 'incoming', 'outgoing'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDirectionFilter(d)}
              className={`px-3 py-1 rounded text-xs capitalize transition ${
                directionFilter === d
                  ? 'bg-sky-600 text-white font-medium'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {d} ({safeMessages.filter(m => d === 'all' || m.direction === d).length})
            </button>
          ))}

          <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer pl-3">
            <input
              type="checkbox"
              checked={riskyOnly}
              onChange={e => setRiskyOnly(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-0"
            />
            <span>Show Risky Only</span>
          </label>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDispatcherOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded text-xs font-semibold shadow transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Active Dispatcher Console</span>
          </button>

          <span className="text-xs text-slate-400">
            Total Captured: <span className="font-mono text-slate-200">{filtered.length}</span>
          </span>
        </div>
      </div>

      {/* Dispatcher Modal / Console Drawer */}
      {isDispatcherOpen && (
        <div className="bg-slate-800 border-2 border-indigo-500/60 rounded-xl p-4 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center space-x-2">
              <Send className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Interactive postMessage Dispatcher & Replayer
              </h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Active Probing
              </span>
            </div>
            <button
              onClick={() => setIsDispatcherOpen(false)}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Templates */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-amber-400" /> Quick Presets:
            </span>
            <button
              onClick={() => applyTemplate({ type: 'STATUS_PING', timestamp: Date.now() }, '*')}
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[11px] text-slate-300 transition"
            >
              Diagnostic Ping
            </button>
            <button
              onClick={() => applyTemplate({ htmlContent: '<strong>Active Probe Verification</strong>' }, '*')}
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[11px] text-slate-300 transition"
            >
              HTML Sink Test
            </button>
            <button
              onClick={() => applyTemplate({ action: 'OAUTH_CALLBACK', token: 'mock-auth-token-12345' }, '*')}
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[11px] text-slate-300 transition"
            >
              Auth Callback Mock
            </button>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="col-span-1 space-y-1">
              <label className="block text-slate-300 font-medium">Target Origin:</label>
              <input
                type="text"
                value={dispatchOrigin}
                onChange={e => setDispatchOrigin(e.target.value)}
                placeholder="* or https://domain.com"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500">
                Use <code className="text-amber-400">*</code> to broadcast or specify exact protocol+origin.
              </p>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="block text-slate-300 font-medium">JSON Message Payload:</label>
              <textarea
                value={dispatchPayloadStr}
                onChange={e => setDispatchPayloadStr(e.target.value)}
                rows={5}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded font-mono text-emerald-300 text-xs focus:outline-none focus:border-indigo-500 resize-none"
              />
              {payloadError && (
                <p className="text-[11px] text-rose-400 font-semibold">{payloadError}</p>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
            <div>
              {dispatchSuccessMsg && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center">
                  <Check className="w-3.5 h-3.5 mr-1" /> {dispatchSuccessMsg}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsDispatcherOpen(false)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition"
              >
                Close
              </button>
              <button
                onClick={handleSendDispatch}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs shadow transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Dispatch into Page</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs">
            No postMessage events observed matching filter.
          </div>
        ) : (
          filtered.map(msg => {
            const isExpanded = expandedIds.has(msg.id);
            return (
              <div
                key={msg.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-sm hover:border-slate-600 transition"
              >
                {/* Message Header Row */}
                <div
                  onClick={() => toggleExpand(msg.id)}
                  className="p-3 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-2.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}

                    <div className="flex items-center space-x-1 font-mono text-xs">
                      {msg.direction === 'incoming' ? (
                        <span className="flex items-center text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          <ArrowDownLeft className="w-3 h-3 mr-0.5" /> INCOMING
                        </span>
                      ) : (
                        <span className="flex items-center text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                          <ArrowUpRight className="w-3 h-3 mr-0.5" /> OUTGOING
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${getRiskBadge(msg.risk)}`}>
                      {msg.risk}
                    </span>

                    <span className="text-xs font-mono text-slate-300">
                      Origin: <span className="text-slate-100">{msg.origin}</span>
                    </span>

                    {msg.targetOrigin && (
                      <span className="text-xs font-mono text-slate-400">
                        &rarr; Target: <span className={msg.targetOrigin === '*' ? 'text-rose-400 font-bold' : 'text-slate-200'}>{msg.targetOrigin}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    {msg.hasOriginCheck ? (
                      <span className="flex items-center text-emerald-400 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Origin Checked
                      </span>
                    ) : (
                      <span className="flex items-center text-rose-400 text-[11px] font-medium">
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" /> No Origin Check
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReplay(msg);
                      }}
                      className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 rounded text-[11px] transition"
                      title="Replay / Edit and re-send this message"
                    >
                      <Play className="w-3 h-3" />
                      <span>Replay</span>
                    </button>

                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Risk Explanation Line */}
                <div className="px-3 pb-2 text-xs text-slate-300 border-t border-slate-700/40 pt-1.5 bg-slate-800/60">
                  <span className="font-semibold text-slate-400">Analysis: </span>
                  {msg.riskReason}
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-3 bg-slate-900 border-t border-slate-700 space-y-3 text-xs font-mono">
                    {/* Payload Box */}
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                        <span>Payload Data:</span>
                        <button
                          onClick={() => handleCopyPayload(msg.fullPayload, msg.id)}
                          className="flex items-center space-x-1 hover:text-slate-200 text-slate-400"
                        >
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Copy Payload</span>
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200 overflow-x-auto text-[11px] max-h-48">
                        {typeof msg.fullPayload === 'object'
                          ? JSON.stringify(msg.fullPayload, null, 2)
                          : String(msg.fullPayload)}
                      </pre>
                    </div>

                    {/* Listener Source Box */}
                    {msg.listenerSource && (
                      <div>
                        <div className="text-slate-400 mb-1 text-[11px]">
                          Target Event Listener Source Code:
                        </div>
                        <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-amber-300/90 overflow-x-auto text-[11px] max-h-48">
                          {msg.listenerSource}
                        </pre>
                      </div>
                    )}

                    {/* Stack Trace */}
                    {msg.stackTrace && (
                      <div>
                        <div className="text-slate-400 mb-1 text-[11px]">Stack Trace:</div>
                        <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-400 overflow-x-auto text-[10px] max-h-32">
                          {msg.stackTrace}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
