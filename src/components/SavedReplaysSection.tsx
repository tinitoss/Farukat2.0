import React, { useState, useEffect, useRef } from 'react';
import { Play, Tv, Trash2, Users, MessageSquare, Clock, MoreVertical, X, Check } from 'lucide-react';
import {
  SavedWatchPartyDoc,
  fetchSavedReplaysOnce,
  deleteSavedPartyReplay,
} from '../utils/watchPartyManager';

interface SavedReplaysSectionProps {
  onPlayReplay: (replay: SavedWatchPartyDoc) => void;
  currentUserId: string;
}

export const SavedReplaysSection: React.FC<SavedReplaysSectionProps> = ({
  onPlayReplay,
  currentUserId,
}) => {
  const [replays, setReplays] = useState<SavedWatchPartyDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReplayForMenu, setSelectedReplayForMenu] = useState<SavedWatchPartyDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const longPressTimerRef = useRef<any>(null);

  // Load replays once on mount (quota optimized, avoiding continuous real-time read billing)
  const loadReplays = async () => {
    setLoading(true);
    try {
      const data = await fetchSavedReplaysOnce();
      setReplays(data);
    } catch (err) {
      console.warn('Failed to load replays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplays();

    // Listen to custom event when a party replay is saved locally to refresh instantly
    const handleReplaySaved = () => {
      loadReplays();
    };
    window.addEventListener('farukat_replay_saved', handleReplaySaved);
    return () => window.removeEventListener('farukat_replay_saved', handleReplaySaved);
  }, []);

  const handleTouchStart = (replay: SavedWatchPartyDoc) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedReplayForMenu(replay);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleDelete = async (replayId: string) => {
    setIsDeleting(true);
    try {
      const ok = await deleteSavedPartyReplay(replayId);
      if (ok) {
        setReplays((prev) => prev.filter((r) => r.id !== replayId));
        setSelectedReplayForMenu(null);
        (window as any).__showFcmToast?.('Replay deleted successfully.', 'info');
      } else {
        (window as any).__showFcmToast?.('Failed to delete replay.', 'error');
      }
    } catch (err) {
      console.warn('Error deleting replay:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (replays.length === 0 && !loading) {
    return null;
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '10m';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="px-4 sm:px-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-black text-white tracking-tight uppercase font-mono flex items-center gap-1.5">
            <Tv className="w-4 h-4 text-[#e2b14c]" />
            <span>Party Replays</span>
          </h2>
          <p className="text-[10px] text-[var(--text-secondary)] font-mono">
            Watch solo with live chat commentary simulation · Press & hold card for options
          </p>
        </div>

        <button
          onClick={loadReplays}
          disabled={loading}
          className="text-[10px] text-[var(--text-muted)] hover:text-[#e2b14c] font-mono px-2 py-1 rounded bg-white/5 border border-white/10 transition-colors"
          title="Refresh Replays"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
        {replays.map((r) => (
          <div
            key={r.id}
            onContextMenu={(e) => {
              e.preventDefault();
              setSelectedReplayForMenu(r);
            }}
            onTouchStart={() => handleTouchStart(r)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="bg-[var(--bg-card)] border border-white/10 p-3.5 rounded-xl w-64 shrink-0 snap-start flex flex-col gap-3 hover:border-[#e2b14c]/30 transition-all select-none relative group"
          >
            {/* Header info */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={r.hostAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={r.hostName}
                  className="w-5 h-5 rounded-full object-cover border border-[#e2b14c]/30 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[9px] text-[var(--text-secondary)] truncate">
                  Saved by {r.hostName}
                </span>
              </div>

              {/* Three dots button for quick access without long press */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReplayForMenu(r);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Replay Options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Thumbnail */}
            <div className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black">
              <img
                src={r.mediaThumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                alt={r.mediaTitle}
                className="w-full h-full object-cover"
              />
              
              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-mono text-white flex items-center gap-1 border border-white/10">
                <Clock className="w-2.5 h-2.5 text-[#e2b14c]" />
                <span>{formatDuration(r.duration)}</span>
              </div>

              {/* Recorded stats badge */}
              <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-mono text-[#e2b14c] flex items-center gap-1 border border-[#e2b14c]/20">
                <MessageSquare className="w-2.5 h-2.5" />
                <span>{r.messagesCount || 0} msgs</span>
              </div>
            </div>

            {/* Meta info & Action */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white line-clamp-1 leading-tight font-sans">
                {r.mediaTitle}
              </h3>

              <div className="flex items-center justify-between text-[9px] font-mono text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Users className="w-2.5 h-2.5 text-white/50" />
                  <span>{r.participantCount || 1} viewers</span>
                </span>
                <span>{formatDate(r.savedAt)}</span>
              </div>

              <button
                onClick={() => onPlayReplay(r)}
                className="w-full min-h-[36px] bg-white/10 hover:bg-[#e2b14c] hover:text-black text-white font-mono font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Play Replay</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Replay Management Action Sheet / Modal */}
      {selectedReplayForMenu && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedReplayForMenu(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <img
                src={selectedReplayForMenu.mediaThumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                alt={selectedReplayForMenu.mediaTitle}
                className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white line-clamp-1">
                  {selectedReplayForMenu.mediaTitle}
                </h4>
                <p className="text-[10px] font-mono text-[var(--text-muted)]">
                  Saved by {selectedReplayForMenu.hostName}
                </p>
                <p className="text-[10px] font-mono text-[#e2b14c]">
                  Recorded on {formatDate(selectedReplayForMenu.savedAt)}
                </p>
              </div>
            </div>

            {/* Replay Details */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[9px] text-[var(--text-muted)] uppercase">Participants</span>
                <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3 text-[#e2b14c]" />
                  {selectedReplayForMenu.participantCount || 1} viewers
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-[var(--text-muted)] uppercase">Comments</span>
                <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <MessageSquare className="w-3 h-3 text-[#e2b14c]" />
                  {selectedReplayForMenu.messagesCount || 0} chat messages
                </span>
              </div>
              <div className="flex flex-col col-span-2 pt-2 border-t border-white/5">
                <span className="text-[9px] text-[var(--text-muted)] uppercase">Session Length</span>
                <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-[#e2b14c]" />
                  {formatDuration(selectedReplayForMenu.duration)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  const replayToPlay = selectedReplayForMenu;
                  setSelectedReplayForMenu(null);
                  onPlayReplay(replayToPlay);
                }}
                className="w-full py-3 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Play Replay</span>
              </button>

              <button
                onClick={() => handleDelete(selectedReplayForMenu.id)}
                disabled={isDeleting}
                className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-red-500/20 cursor-pointer transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting Replay...' : 'Delete Replay'}</span>
              </button>

              <button
                onClick={() => setSelectedReplayForMenu(null)}
                className="w-full py-2.5 text-xs text-[var(--text-muted)] hover:text-white font-mono uppercase tracking-wider transition-colors"
              >
                Keep Replay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
