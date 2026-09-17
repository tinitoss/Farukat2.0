import React, { useState, useEffect } from 'react';
import { Play, Users, X, Radio } from 'lucide-react';
import {
  WatchPartyDoc,
  getLocalJoinedPartyIds,
  removeLocalJoinedPartyId,
  rejoinWatchPartyDirect,
} from '../utils/watchPartyManager';

interface PreviouslyJoinedPartiesBannerProps {
  onRejoinParty: (party: WatchPartyDoc) => void;
  livePublicParties: WatchPartyDoc[];
}

export const PreviouslyJoinedPartiesBanner: React.FC<PreviouslyJoinedPartiesBannerProps> = ({
  onRejoinParty,
  livePublicParties,
}) => {
  const [joinedParties, setJoinedParties] = useState<WatchPartyDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshJoinedParties = async () => {
    const ids = getLocalJoinedPartyIds();
    if (ids.length === 0) {
      setJoinedParties([]);
      return;
    }

    // Check if any match the active live public parties first
    const activeFromPublic = livePublicParties.filter((p) => ids.includes(p.partyId));
    
    // Also query any private parties that user previously joined
    const remainingIds = ids.filter((id) => !activeFromPublic.some((p) => p.partyId === id));
    const directParties: WatchPartyDoc[] = [];

    for (const id of remainingIds) {
      try {
        const res = await rejoinWatchPartyDirect(id);
        if (res.success && res.partyData) {
          directParties.push(res.partyData);
        } else {
          removeLocalJoinedPartyId(id);
        }
      } catch {
        removeLocalJoinedPartyId(id);
      }
    }

    setJoinedParties([...activeFromPublic, ...directParties]);
  };

  useEffect(() => {
    refreshJoinedParties();
  }, [livePublicParties]);

  const handleDismiss = (partyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeLocalJoinedPartyId(partyId);
    setJoinedParties((prev) => prev.filter((p) => p.partyId !== partyId));
  };

  const handleRejoin = async (partyId: string) => {
    setLoading(true);
    try {
      const res = await rejoinWatchPartyDirect(partyId);
      if (res.success && res.partyData) {
        onRejoinParty(res.partyData);
      } else {
        (window as any).__showFcmToast?.(res.message || 'Party is no longer active.', 'error');
        removeLocalJoinedPartyId(partyId);
        setJoinedParties((prev) => prev.filter((p) => p.partyId !== partyId));
      }
    } finally {
      setLoading(false);
    }
  };

  if (joinedParties.length === 0) {
    return null;
  }

  return (
    <div className="px-4 sm:px-6 py-2">
      <div className="space-y-2">
        {joinedParties.map((party) => (
          <div
            key={party.partyId}
            className="bg-gradient-to-r from-red-950/40 via-[var(--bg-card)] to-[var(--bg-card)] border border-red-500/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-lg hover:border-[#e2b14c]/40 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                <img
                  src={party.mediaThumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=200'}
                  alt={party.mediaTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    <span>Active Party</span>
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">·</span>
                  <span className="text-[9px] text-[var(--text-muted)] font-mono truncate">
                    Hosted by {party.hostName}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white truncate leading-snug">
                  {party.mediaTitle}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[var(--text-muted)] font-mono">
                  <span className="flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-[#e2b14c]" />
                    <span>{party.viewers?.length || 1} watching</span>
                  </span>
                  <span>· No code needed</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleRejoin(party.partyId)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-[10px] uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all shadow cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-black" />
                <span>Rejoin</span>
              </button>

              <button
                onClick={(e) => handleDismiss(party.partyId, e)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Dismiss from top list"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
