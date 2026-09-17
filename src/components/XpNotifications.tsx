import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, X, Flame, Shield, Award, ChevronRight } from 'lucide-react';
import { subscribeToToasts, XpToastData } from '../utils/xpSystem';
import { CelebrationModal } from './CelebrationModal';

interface XpNotificationsProps {
  onOpenMembership: () => void;
}

export const XpNotifications: React.FC<XpNotificationsProps> = ({ onOpenMembership }) => {
  const [activeToast, setActiveToast] = useState<XpToastData | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((data) => {
      if (data.type === 'levelup' && data.level) {
        setLevelUpData({ level: data.level });
      } else {
        setActiveToast(data);
        const timer = setTimeout(() => {
          setActiveToast(null);
        }, 3500);
        return () => clearTimeout(timer);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {/* Toast Notification */}
      {activeToast && (
        <div className="fixed top-4 right-4 sm:right-6 z-[9999] animate-slideInRight max-w-sm pointer-events-none">
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--accent-gold)]/40 text-[var(--text-primary)] shadow-2xl backdrop-blur-xl flex items-center gap-3 pointer-events-auto">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md bg-[var(--accent-gold)] text-black">
              {activeToast.icon === 'flame' || activeToast.title.includes('Streak') ? (
                <Flame className="w-5 h-5 fill-black text-black" />
              ) : (
                <Zap className="w-5 h-5 fill-black" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-black text-[var(--accent-gold)] block tracking-wide">
                {activeToast.title}
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">{activeToast.description}</p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-[var(--text-disabled)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Level-Up Modal */}
      {levelUpData && (
        <CelebrationModal
          isOpen={!!levelUpData}
          onClose={() => setLevelUpData(null)}
          icon={<Zap className="w-10 h-10 text-[#E2B14C]" />}
          headline={`You Reached Level ${levelUpData.level}`}
          subline="Your FARUKAT 3D Digital Pass has upgraded with enhanced privileges, holographic sheen, and bonus cinema features."
          infoRow={[
            { label: 'New Rank', value: `Level ${levelUpData.level} Member` },
            { label: '3D Card Style', value: 'Enhanced Luster' }
          ]}
          primaryAction={{
            label: 'Inspect My 3D Card',
            onClick: () => {
              setLevelUpData(null);
              onOpenMembership();
            },
            icon: <Sparkles className="w-4 h-4" />
          }}
          secondaryAction={{
            label: 'Continue Streaming',
            onClick: () => setLevelUpData(null)
          }}
        />
      )}
    </>
  );
};
