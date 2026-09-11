import React, { useState } from 'react';
import { TabState } from '../types';
import { RefreshCw, Download, Trash2, ShieldAlert, FileText, Check } from 'lucide-react';
import { generateMarkdownReport } from '../utils/export_markdown';
import { exportAuditGuardScope } from '../utils/auditguard_bridge';

interface HeaderProps {
  state: TabState;
  customExclusions?: string[];
  customInScope?: string[];
  onRescan: () => void;
  onClear: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  customExclusions,
  customInScope,
  onRescan,
  onClear
}) => {
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedScope, setCopiedScope] = useState(false);

  const handleDownloadMarkdown = () => {
    const reportState = {
      ...state,
      customExclusions: customExclusions || state.customExclusions,
      customInScope: customInScope || state.customInScope
    };
    const md = generateMarkdownReport(reportState);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statehunter_report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleDownloadScope = () => {
    const yaml = exportAuditGuardScope(state, customExclusions, customInScope);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditguard_scope_${Date.now()}.yaml`;
    a.click();
    URL.revokeObjectURL(url);

    setCopiedScope(true);
    setTimeout(() => setCopiedScope(false), 2000);
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5">
          <ShieldAlert className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-sm tracking-wide text-white">STATEHUNTER</span>
          <span className="text-[10px] bg-sky-500/20 text-sky-300 font-mono px-1.5 py-0.5 rounded border border-sky-500/30">
            v0.1.0
          </span>
        </div>

        <div className="h-4 w-[1px] bg-slate-700" />

        <div className="flex items-center space-x-2 text-xs text-slate-300">
          <span className="text-slate-400">Target:</span>
          <span className="font-mono text-slate-200 truncate max-w-xs" title={state.url}>
            {state.url || 'No active tab'}
          </span>
          {state.frameworkDetected && (
            <span className="bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full text-[11px] border border-emerald-500/30">
              {state.frameworkDetected}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onRescan}
          className="flex items-center space-x-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition border border-slate-600"
          title="Trigger full DOM & Storage rescan"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Rescan</span>
        </button>

        <button
          onClick={handleDownloadMarkdown}
          className="flex items-center space-x-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded transition shadow-sm"
          title="Export Markdown Bug Bounty Report"
        >
          {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Download className="w-3.5 h-3.5" />}
          <span>Export Report</span>
        </button>

        <button
          onClick={handleDownloadScope}
          className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition shadow-sm"
          title="Export AuditGuard Scope YAML"
        >
          {copiedScope ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <FileText className="w-3.5 h-3.5" />}
          <span>AuditGuard Scope</span>
        </button>

        <button
          onClick={onClear}
          className="p-1 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded transition"
          title="Clear tab state"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
