import React, { useEffect, useState } from 'react';
import { Users, Check, X, Tv, Sparkles, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import { getCurrentUserPublicProfile } from '../utils/memberSystem';
import {
  WatchInviteDoc,
  subscribeToPendingInvites,
  respondToWatchInvite,
  WatchPartyDoc,
} from '../utils/watchPartyManager';

interface WatchPartyInviteToastProps {
  onJoinParty: (partyData: WatchPartyDoc) => void;
}

export const WatchPartyInviteToast: React.FC<WatchPartyInviteToastProps> = ({ onJoinParty }) => {
  const [invites, setInvites] = useState<WatchInviteDoc[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const profile = getCurrentUserPublicProfile();
  const currentUid = auth.currentUser?.uid || profile.cardNumber;

  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = subscribeToPendingInvites(currentUid, (incomingInvites) => {
      // Filter out local dismissed ones
      setInvites(incomingInvites.filter((inv) => !dismissedIds.has(inv.id)));
    });

    return () => unsubscribe();
  }, [currentUid, dismissedIds]);

  if (invites.length === 0) return null;

  // Show the latest pending invite
  const activeInvite = invites[0];

  const handleAction = async (accept: boolean) => {
    setProcessingId(activeInvite.id);
    try {
      const res = await respondToWatchInvite(activeInvite, accept);
      setDismissedIds((prev) => new Set([...prev, activeInvite.id]));
      
      if (accept && res.success && res.partyData) {
        onJoinParty(res.partyData);
      }
    } catch (err) {
      console.error('Error handling watch invite action:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed top-4 left-3 right-3 z-[9999] pointer-events-auto max-w-md mx-auto animate-fadeIn">
      <div className="bg-[var(--bg-main)]/95 backdrop-blur-xl border border-[#e2b14c]/40 rounded-xl p-3.5 shadow-2xl shadow-black/80 text-[var(--text-primary)] relative overflow-hidden">
        {/* Subtle accent highlight line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#e2b14c] via-amber-400 to-[#e2b14c]" />

        <div className="flex items-start gap-3">
          {/* Host Avatar or Poster */}
          <div className="relative shrink-0 mt-0.5">
            <img
              src={activeInvite.hostAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
              alt={activeInvite.hostName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#e2b14c]/50"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#e2b14c] text-black rounded-full flex items-center justify-center">
              <Tv className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#e2b14c]">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Watch Together Invite</span>
            </div>
            
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate mt-0.5">
              <span className="text-[#e2b14c] font-bold">{activeInvite.hostName}</span> invited you to watch
            </p>
            
            <p className="text-xs text-[var(--text-muted)] truncate font-medium">
              "{activeInvite.mediaTitle}"
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => handleAction(false)}
            disabled={processingId === activeInvite.id}
            className="text-[var(--text-muted)] hover:text-white p-1 rounded-lg transition-colors shrink-0"
            title="Decline"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/10">
          <button
            onClick={() => handleAction(false)}
            disabled={processingId === activeInvite.id}
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-[var(--text-muted)] hover:text-white transition-all flex items-center justify-center gap-1.5 border border-white/10"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>

          <button
            onClick={() => handleAction(true)}
            disabled={processingId === activeInvite.id}
            className="w-full py-2 px-3 rounded-lg bg-[#e2b14c] hover:brightness-110 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#e2b14c]/20"
          >
            {processingId === activeInvite.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Accept & Watch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
