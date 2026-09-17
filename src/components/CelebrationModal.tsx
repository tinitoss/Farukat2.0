import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  headline: string;
  subline: string;
  infoRow?: { label: string; value: string }[];
  primaryAction: { label: string; onClick: () => void; icon?: React.ReactNode };
  secondaryAction?: { label: string; onClick: () => void };
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  icon,
  headline,
  subline,
  infoRow,
  primaryAction,
  secondaryAction,
}) => {
  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E2B14C', '#FFFFFF'],
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-sm bg-[#141416] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
        >
          {/* Hero Area */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full border border-[#E2B14C]/30 bg-[#E2B14C]/10 flex items-center justify-center shadow-[0_0_20px_rgba(226,177,76,0.2)]">
              {icon}
            </div>
          </div>

          {/* Text Hierarchy */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-white tracking-tight uppercase mb-2">
              {headline}
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed px-2">
              {subline}
            </p>
          </div>

          {/* Optional Info Row */}
          {infoRow && infoRow.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-6 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              {infoRow.map((item, idx) => (
                <div key={idx} className="text-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase block">{item.label}</span>
                  <span className="text-xs font-bold text-[#E2B14C]">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={primaryAction.onClick}
              className="w-full h-[52px] rounded-xl bg-[#E2B14C] hover:brightness-110 text-black font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="w-full h-[44px] rounded-xl text-xs text-neutral-500 hover:text-white font-semibold transition cursor-pointer"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
