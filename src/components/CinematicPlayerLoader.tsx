import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface CinematicPlayerLoaderProps {
  isLoading: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  errorMessage?: string;
}

export const CinematicPlayerLoader: React.FC<CinematicPlayerLoaderProps> = ({
  isLoading,
  hasError = false,
  onRetry,
  errorMessage = 'Unable to play video',
}) => {
  if (!isLoading && !hasError) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 bg-black flex items-center justify-center z-20 select-none transition-opacity duration-500 ease-out ${
        isLoading || hasError ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {hasError ? (
        <div className="flex flex-col items-center justify-center p-6 text-center gap-4 animate-fade-in max-w-sm">
          <div className="w-12 h-12 rounded-full border border-[#e2b14c]/30 bg-[#e2b14c]/10 text-[#e2b14c] flex items-center justify-center shadow-[0_0_25px_rgba(226,177,76,0.2)]">
            <AlertCircle className="w-5 h-5 stroke-[2]" />
          </div>
          <p className="text-sm font-medium tracking-wide text-white/90 font-sans">
            {errorMessage}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[40px] px-5 rounded-full bg-[#e2b14c] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg shadow-[#e2b14c]/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          {/* Subtle gold ambient glow ring */}
          <div className="absolute inset-0 rounded-full border border-[#e2b14c]/10 shadow-[0_0_30px_rgba(226,177,76,0.15)]" />

          {/* Smooth rotating gold ring with light sweep */}
          <svg className="w-full h-full animate-spin [animation-duration:2.8s]" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="gold-loader-sweep" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2b14c" stopOpacity="1" />
                <stop offset="50%" stopColor="#e2b14c" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#e2b14c" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Background track circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#e2b14c"
              strokeOpacity="0.1"
              strokeWidth="1.5"
            />
            {/* Light sweep rotating arc */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#gold-loader-sweep)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="160 100"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
