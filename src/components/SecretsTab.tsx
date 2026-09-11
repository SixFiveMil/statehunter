import React, { useState } from 'react';
import { TabState } from '../types';
import { Key, Database, FileCode, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SecretsTabProps {
  state: TabState;
}

export const SecretsTab: React.FC<SecretsTabProps> = ({ state }) => {
  const [subTab, setSubTab] = useState<'secrets' | 'jwts' | 'storage'>('secrets');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const secrets = state.secrets || [];
  const storage = state.storage || { localStorage: {}, sessionStorage: {}, decodedJwts: {} };

  const filteredSecrets = secrets.filter(s =>
    (s.keyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.valueSnippet || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const jwtsList = Object.entries(storage.decodedJwts || {});

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Sub Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSubTab('secrets')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              subTab === 'secrets'
                ? 'bg-rose-600 text-white font-medium shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Discovered Secrets ({secrets.length})</span>
          </button>

          <button
            onClick={() => setSubTab('jwts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              subTab === 'jwts'
                ? 'bg-amber-600 text-white font-medium shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Decoded JWTs ({jwtsList.length})</span>
          </button>

          <button
            onClick={() => setSubTab('storage')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              subTab === 'storage'
                ? 'bg-sky-600 text-white font-medium shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>
              Raw Storage (
              {Object.keys(storage.localStorage || {}).length + Object.keys(storage.sessionStorage || {}).length})
            </span>
          </button>
        </div>

        <input
          type="text"
          placeholder="Filter items..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* SubTab 1: Discovered Secrets */}
      {subTab === 'secrets' && (
        <div className="space-y-3">
          {filteredSecrets.length === 0 ? (
            <div className="p-8 text-center bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <span>No exposed API tokens or high-entropy credentials identified.</span>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-700 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Key Identifier</th>
                    <th className="py-2.5 px-3">Value Preview</th>
                    <th className="py-2.5 px-3">Entropy</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 font-mono">
                  {filteredSecrets.map(sec => (
                    <tr key={sec.id} className="hover:bg-slate-700/30 transition">
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans font-semibold border ${
                            sec.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : sec.severity === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {sec.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 font-sans">{sec.type}</td>
                      <td className="py-2 px-3 text-slate-400 text-[11px]">{sec.location}</td>
                      <td className="py-2 px-3 text-rose-300 font-semibold">{sec.keyName}</td>
                      <td className="py-2 px-3 text-slate-200">{sec.valueSnippet}</td>
                      <td className="py-2 px-3 text-slate-400">{sec.entropy ? `${sec.entropy} bits` : '-'}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap font-sans">
                        <button
                          onClick={() => handleCopy(sec.valueSnippet, sec.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                          title="Copy snippet"
                        >
                          {copiedKey === sec.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SubTab 2: Decoded JWTs */}
      {subTab === 'jwts' && (
        <div className="space-y-3">
          {jwtsList.length === 0 ? (
            <div className="p-8 text-center bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs">
              No JSON Web Tokens (JWT) found in client storage.
            </div>
          ) : (
            jwtsList.map(([keyName, jwt]) => (
              <div key={keyName} className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="font-mono text-slate-200 font-bold">{keyName}</span>
                    {jwt.isExpired ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] uppercase border border-rose-500/30">
                        Expired ({jwt.expiresAt ? new Date(jwt.expiresAt).toLocaleDateString() : 'N/A'})
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] uppercase border border-emerald-500/30">
                        Active Token
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(JSON.stringify(jwt.payload, null, 2), keyName)}
                    className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    {copiedKey === keyName ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Claims</span>
                  </button>
                </div>

                {jwt.sensitiveClaims.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-500/30 p-2 rounded flex items-center space-x-2 text-amber-300 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Sensitive claims exposed in client token: {jwt.sensitiveClaims.join(', ')}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <div className="text-slate-400 mb-1 text-[10px] uppercase font-sans">Token Header</div>
                    <pre className="bg-slate-900 p-2 rounded border border-slate-700/60 text-slate-300 overflow-x-auto">
                      {JSON.stringify(jwt.header, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1 text-[10px] uppercase font-sans">Payload Claims</div>
                    <pre className="bg-slate-900 p-2 rounded border border-slate-700/60 text-emerald-300/90 overflow-x-auto">
                      {JSON.stringify(jwt.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SubTab 3: Raw Storage Explorer */}
      {subTab === 'storage' && (
        <div className="space-y-4">
          {/* localStorage */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>localStorage ({Object.keys(storage.localStorage || {}).length} keys)</span>
            </h3>
            <div className="divide-y divide-slate-700/50 max-h-60 overflow-y-auto font-mono text-xs">
              {Object.entries(storage.localStorage || {}).map(([k, v]) => (
                <div key={k} className="py-2 flex items-start justify-between">
                  <div className="max-w-xs font-semibold text-sky-300 truncate mr-3">{k}</div>
                  <div className="flex-1 text-slate-400 truncate mr-3">{v}</div>
                  <button
                    onClick={() => handleCopy(v, `local_${k}`)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 shrink-0"
                    title="Copy Value"
                  >
                    {copiedKey === `local_${k}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* sessionStorage */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>sessionStorage ({Object.keys(storage.sessionStorage || {}).length} keys)</span>
            </h3>
            <div className="divide-y divide-slate-700/50 max-h-60 overflow-y-auto font-mono text-xs">
              {Object.entries(storage.sessionStorage || {}).map(([k, v]) => (
                <div key={k} className="py-2 flex items-start justify-between">
                  <div className="max-w-xs font-semibold text-emerald-300 truncate mr-3">{k}</div>
                  <div className="flex-1 text-slate-400 truncate mr-3">{v}</div>
                  <button
                    onClick={() => handleCopy(v, `session_${k}`)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 shrink-0"
                    title="Copy Value"
                  >
                    {copiedKey === `session_${k}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
