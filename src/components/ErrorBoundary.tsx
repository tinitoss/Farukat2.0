import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI Exception caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isSq = localStorage.getItem('farukat_lang') === 'sq';
      const title = isSq ? "Motori i Leximit u Ndërpre" : "Playback Engine Interrupted";
      const desc = isSq 
        ? "Ndodhi një gabim i përkohshëm në shfaqjen e pamjes. Shtypni më poshtë për të rifreskuar dhe rikthyer seancën tuaj të kinemasë." 
        : "A temporary display rendering error occurred. Tap below to refresh and restore your cinema session.";
      const errorDetailsTitle = isSq ? "Detajet e Gabimit:" : "Error Details:";
      const reloadBtnText = isSq ? "Rifresko Aplikacionin" : "Reload Application";

      return (
        <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-4 animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white mb-2">
            {title}
          </h1>

          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mb-6 leading-relaxed">
            {desc}
          </p>

          {this.state.error && (
            <div className="w-full max-w-md p-3 rounded-xl bg-[#141414] border border-[#262626] text-[11px] font-mono text-neutral-400 text-left overflow-x-auto mb-6">
              <span className="text-red-400 font-bold block mb-1">{errorDetailsTitle}</span>
              {this.state.error.toString()}
            </div>
          )}

          <button
            onClick={this.handleReload}
            className="px-6 py-3 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg cursor-pointer min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{reloadBtnText}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
