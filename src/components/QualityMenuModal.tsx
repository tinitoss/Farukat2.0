import React from 'react';
import { Settings, Check, X, ShieldAlert, Wifi, Sparkles, Gauge } from 'lucide-react';
import { QualityOption, VideoSourceCapability } from '../utils/mediaQualityManager';

interface QualityMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  capability: VideoSourceCapability;
  selectedQuality: string; // 'auto' | '1080p' | '720p' | etc.
  activeEffectiveQuality: string; // Current actual playing resolution e.g. '1080p' or '720p'
  onSelectQuality: (qualityId: string) => void;
  networkQuality?: 'excellent' | 'good' | 'constrained';
}

export const QualityMenuModal: React.FC<QualityMenuModalProps> = ({
  isOpen,
  onClose,
  capability,
  selectedQuality,
  activeEffectiveQuality,
  onSelectQuality,
  networkQuality = 'excellent',
}) => {
  if (!isOpen) return null;

  const isYoutube = capability.provider === 'youtube';
  const showManualDisabled = isYoutube && !capability.manualQualitySupported;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md transition-opacity animate-fadeIn">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet / Modal Container */}
      <div className="relative w-full max-w-sm bg-[#0f0f11] border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl z-10 flex flex-col gap-4 text-white overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#e2b14c]/10 border border-[#e2b14c]/30 flex items-center justify-center text-[#e2b14c]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Quality</h3>
              <p className="text-[10px] text-white/50 font-medium">
                {isYoutube
                  ? 'YouTube Adaptive Stream'
                  : `Source Maximum: ${capability.maxResolution}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition cursor-pointer"
            aria-label="Close quality menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network & Adaptability Status Banner */}
        <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Wifi className={`w-3.5 h-3.5 ${networkQuality === 'constrained' ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="text-[11px] font-medium text-white/80">
              {networkQuality === 'constrained' ? 'Network constrained' : 'Connection stable'}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#e2b14c] uppercase">
            {activeEffectiveQuality ? `Active: ${activeEffectiveQuality}` : capability.maxResolution}
          </span>
        </div>

        {/* Quality Options List */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[280px] pr-0.5 custom-scrollbar">
          {capability.availableQualities.map((opt) => {
            const isSelected = selectedQuality === opt.id;
            const isAuto = opt.id === 'auto';

            let displaySubtitle = opt.subtitle;
            if (isAuto && !isYoutube) {
              if (networkQuality === 'constrained') {
                displaySubtitle = `Auto (Adapted for stability - ${activeEffectiveQuality || '480p'})`;
              } else {
                displaySubtitle = `Best available (${capability.maxResolution})`;
              }
            } else if (isAuto && isYoutube) {
              displaySubtitle = 'YouTube adaptive quality';
            }

            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelectQuality(opt.id);
                  onClose();
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition cursor-pointer min-h-[48px] ${
                  isSelected
                    ? 'bg-[#e2b14c]/15 border-[#e2b14c] text-white shadow-md'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-white/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[#e2b14c] bg-[#e2b14c]' : 'border-white/30'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs font-bold tracking-wide flex items-center gap-1.5">
                      <span>{opt.label}</span>
                      {isSelected && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-[#e2b14c] text-black">
                          Active
                        </span>
                      )}
                    </span>
                    {displaySubtitle && (
                      <span className="text-[10px] text-white/50 font-medium leading-tight">
                        {displaySubtitle}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-[#e2b14c] shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Provider Notice Footer */}
        {showManualDisabled && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Quality controlled by YouTube adaptive streaming.</span>
          </div>
        )}

        {/* Non-invented max quality clarification */}
        <div className="text-[10px] text-white/40 text-center font-mono">
          Highest available source resolution for this video is {capability.maxResolution}.
        </div>
      </div>
    </div>
  );
};
