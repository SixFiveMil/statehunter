import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[StateHunter ErrorBoundary] Caught exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleCopy = () => {
    const { error, errorInfo } = this.state;
    const text = `StateHunter DevTools Error:\n${error?.toString()}\n\nComponent Stack:\n${errorInfo?.componentStack || 'N/A'}\n\nStack:\n${error?.stack || 'N/A'}`;
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex items-center justify-center">
          <div className="max-w-2xl w-full bg-slate-800 border-2 border-rose-500/60 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-700 pb-3">
              <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  StateHunter Panel Render Error
                </h2>
                <p className="text-xs text-slate-400">
                  An unexpected exception was caught by the DevTools Error Boundary.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Error Message:
              </span>
              <div className="p-3 bg-slate-950 rounded border border-rose-900/60 font-mono text-xs text-rose-300 overflow-x-auto">
                {this.state.error?.toString() || 'Unknown Error'}
              </div>
            </div>

            {this.state.errorInfo?.componentStack && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Component Stack:
                </span>
                <pre className="p-3 bg-slate-950 rounded border border-slate-700/60 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <button
                onClick={this.handleCopy}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Diagnostics</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Diagnostics</span>
                  </>
                )}
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded text-xs transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Panel</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
