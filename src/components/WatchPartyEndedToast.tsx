import React, { useEffect, useState } from 'react';
import { Film, BookmarkCheck, X, Sparkles, Loader2, Check } from 'lucide-react';
import {
  WatchPartyDoc,
  checkEndedJoinedParties,
  dismissEndedPartyPrompt,
  savePartyReplay,
} from '../utils/watchPartyManager';
import { notifyWatchPartyEnded } from '../utils/inAppNotificationSystem';

interface WatchPartyEndedToastProps {
  onReplaySaved?: (replayId: string) => void;
}

export const WatchPartyEndedToast: React.FC<WatchPartyEndedToastProps> = ({ onReplaySaved }) => {
  const [endedParties, setEndedParties] = useState<WatchPartyDoc[]>([]);
  const [processingPartyId, setProcessingPartyId] = useState<string | null>(null);

  const checkParties = async () => {
    try {
      const parties = await checkEndedJoinedParties();
      setEndedParties(parties);

      // Create in-app notification for each party that ended
      for (const party of parties) {
        notifyWatchPartyEnded({
          partyId: party.partyId,
          mediaTitle: party.mediaTitle,
          hostName: party.hostName,
          mediaId: party.mediaId,
          poster: party.mediaThumbnail
        });
      }
    } catch (err) {
      console.warn('Error checking ended watch parties:', err);
    }
  };

  useEffect(() => {
    // Initial check
    checkParties();

    // Check periodically in background
    const interval = setInterval(checkParties, 8000);

    // Also check immediately when user switches back to this tab / app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkParties();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  if (endedParties.length === 0) return null;

  const currentParty = endedParties[0];

  const handleSave = async () => {
    if (!currentParty || processingPartyId) return;
    setProcessingPartyId(currentParty.partyId);

    try {
      const duration = currentParty.playerState?.currentTime || currentParty.durationSeconds || 60;
      const res = await savePartyReplay(currentParty, duration);

      if (res.success) {
        dismissEndedPartyPrompt(currentParty.partyId);
        setEndedParties((prev) => prev.filter((p) => p.partyId !== currentParty.partyId));
        (window as any).__showFcmToast?.(
          `Watch party replay saved for "${currentParty.mediaTitle}".`,
          'success'
        );
        if (res.replayId && onReplaySaved) {
          onReplaySaved(res.replayId);
        }
      } else {
        (window as any).__showFcmToast?.(
          res.message || 'Failed to save replay.',
          'error'
        );
      }
    } catch (err) {
      console.error('Failed to save ended party replay:', err);
      (window as any).__showFcmToast?.('Failed to save replay.', 'error');
    } finally {
      setProcessingPartyId(null);
    }
  };

  const handleDismiss = () => {
    if (!currentParty) return;
    dismissEndedPartyPrompt(currentParty.partyId);
    setEndedParties((prev) => prev.filter((p) => p.partyId !== currentParty.partyId));
  };

  return (
    <div className="fixed top-4 left-3 right-3 z-[99999] pointer-events-auto max-w-md mx-auto animate-fadeIn">
      <div className="bg-[var(--bg-main)]/95 backdrop-blur-xl border border-[#e2b14c]/50 rounded-2xl p-4 shadow-2xl shadow-black/90 text-[var(--text-primary)] relative overflow-hidden flex flex-col gap-3">
        {/* Accent highlight strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e2b14c] via-amber-300 to-[#e2b14c]" />

        <div className="flex items-start gap-3">
          {/* Media thumbnail */}
          <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-black/50 shrink-0 border border-white/10">
            {currentParty.mediaThumbnail && currentParty.mediaThumbnail.trim() ? (
              <img
                src={currentParty.mediaThumbnail}
                alt={currentParty.mediaTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 text-[#e2b14c]">
                <Film className="w-5 h-5" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#e2b14c] text-black flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#e2b14c] font-bold">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Watch Party Ended</span>
            </div>

            <h4 className="text-xs font-bold text-white truncate mt-0.5 leading-snug">
              {currentParty.mediaTitle}
            </h4>

            <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
              Video has finished playing. Would you like to save this replay and chat log to your library?
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            disabled={processingPartyId === currentParty.partyId}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons with Mobile-Compliant min-height (>=44px touch target) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
          <button
            onClick={handleDismiss}
            disabled={processingPartyId === currentParty.partyId}
            className="min-h-[44px] px-3 rounded-xl border border-white/10 hover:bg-white/5 active:scale-95 text-white/80 hover:text-white font-mono font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            <span>Dismiss</span>
          </button>

          <button
            onClick={handleSave}
            disabled={processingPartyId === currentParty.partyId}
            className="min-h-[44px] px-3 rounded-xl bg-[#e2b14c] hover:brightness-110 active:scale-95 text-black font-mono font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#e2b14c]/20 cursor-pointer disabled:opacity-50"
          >
            {processingPartyId === currentParty.partyId ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Save Replay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
