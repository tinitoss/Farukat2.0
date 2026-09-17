import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Tv,
  Users,
  MessageSquare,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SavedWatchPartyDoc, WatchPartyMessage, fetchReplayMessages } from '../utils/watchPartyManager';
import { MEDIA_CATALOG } from '../data/mediaData';
import { normalizeVideoUrl, DEMO_TRAILER_URLS } from '../utils/mediaUtils';

interface WatchPartyReplayPlayerModalProps {
  replay: SavedWatchPartyDoc;
  onClose: () => void;
}

export const WatchPartyReplayPlayerModal: React.FC<WatchPartyReplayPlayerModalProps> = ({
  replay,
  onClose,
}) => {
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(replay.duration || 600);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Find the media item from catalog
  const mediaItem = MEDIA_CATALOG.find((m) => m.id === replay.mediaId);
  const episode = replay.episodeId && mediaItem?.episodes
    ? mediaItem.episodes.find((e) => e.id === replay.episodeId)
    : undefined;

  const rawVideoUrl = episode?.videoUrl || mediaItem?.videoUrl || '';
  const normalizedVideoUrl = normalizeVideoUrl(rawVideoUrl);
  const isYoutube = rawVideoUrl.includes('youtube.com') || rawVideoUrl.includes('youtu.be');

  const posterUrl = replay.mediaThumbnail || episode?.thumbnail || mediaItem?.backdrop || mediaItem?.thumbnail || mediaItem?.poster || '';

  // Load chat messages on mount
  useEffect(() => {
    let active = true;
    fetchReplayMessages(replay.id).then((msgs) => {
      if (active) {
        setMessages(msgs);
      }
    });
    return () => {
      active = false;
    };
  }, [replay.id]);

  // Video Time Update Listener - strictly constrained to watched duration segment
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      if (videoRef.current.currentTime >= duration) {
        videoRef.current.pause();
        videoRef.current.currentTime = duration;
        setIsPlaying(false);
        setCurrentTime(duration);
        return;
      }
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Video Loaded Metadata Listener - retain strictly the watched replay duration
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (videoRef.current.currentTime >= duration) {
          videoRef.current.currentTime = 0;
          setCurrentTime(0);
        }
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(duration, Math.max(0, parseFloat(e.target.value)));
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  // Filter messages that have been posted up to the current playback head
  const visibleMessages = messages.filter((msg) => (msg.videoTimestamp ?? 0) <= currentTime);

  // Auto-scroll chat to bottom when visible messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  return (
    <div className="fixed inset-0 z-[99999] bg-black text-white flex flex-col select-none overflow-hidden font-sans">
      {/* Top Header Row */}
      <div className="bg-[var(--bg-main)] border-b border-white/10 p-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#e2b14c]/20 text-[#e2b14c] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-[#e2b14c] uppercase tracking-wider block font-mono">
              PARTY REPLAY
            </span>
            <h1 className="text-sm font-black text-white leading-tight tracking-wide truncate">
              {replay.mediaTitle}
            </h1>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-all text-white shrink-0 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
        {/* Video Column */}
        <div className="w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden shrink-0 border-b border-white/10">
          {isYoutube ? (
            <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center p-6 text-center gap-2">
              <Tv className="w-8 h-8 text-[#e2b14c] animate-pulse" />
              <p className="text-xs font-bold text-white">YouTube Replay Synchronization</p>
              <p className="text-[10px] text-[var(--text-muted)] max-w-xs leading-relaxed">
                For YouTube-hosted titles, synchronous audio replay commentary plays alongside live chat simulations.
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={normalizedVideoUrl || DEMO_TRAILER_URLS.action}
              autoPlay
              playsInline
              preload="auto"
              onError={() => {
                if (videoRef.current) {
                  videoRef.current.src = DEMO_TRAILER_URLS.action;
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-full object-contain pointer-events-auto"
            />
          )}

          {/* Simple minimal overlay player controls (HTML5 only) */}
          {!isYoutube && (
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col gap-2 z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTogglePlay}
                  className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:bg-[#e2b14c] transition cursor-pointer shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-black fill-black" /> : <Play className="w-4 h-4 text-black fill-black ml-0.5" />}
                </button>

                <button
                  onClick={handleToggleMute}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white transition shrink-0 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>

                {/* Scrubber bar */}
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-[#e2b14c] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />

                <span className="text-[10px] font-mono font-bold text-white shrink-0">
                  {Math.floor(currentTime / 60)}:{( '0' + Math.floor(currentTime % 60) ).slice(-2)} / {Math.floor(duration / 60)}:{( '0' + Math.floor(duration % 60) ).slice(-2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Log Panel */}
        <div className="flex-1 bg-[var(--bg-card)] flex flex-col min-h-0 border-l border-white/10">
          <div className="p-3 bg-white/5 border-b border-white/10 flex items-center gap-2 shrink-0">
            <MessageSquare className="w-4 h-4 text-[#e2b14c]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Replay Chatsimulation
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 p-4">
                <Users className="w-8 h-8 text-[var(--text-muted)] opacity-45" />
                <p className="text-xs text-[var(--text-muted)]">No recorded comments yet.</p>
                <p className="text-[9px] text-[var(--text-muted)] opacity-60">
                  Comments will populate as the video playhead moves forward.
                </p>
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const timestampMin = Math.floor((msg.videoTimestamp ?? 0) / 60);
                const timestampSec = ('0' + Math.floor((msg.videoTimestamp ?? 0) % 60)).slice(-2);

                return (
                  <div key={msg.id} className="flex gap-2.5 items-start text-xs animate-fadeIn">
                    <img
                      src={msg.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt={msg.senderName}
                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white truncate">{msg.senderName}</span>
                        <span className="text-[9px] font-mono font-bold bg-[#e2b14c]/10 text-[#e2b14c] border border-[#e2b14c]/20 px-1 rounded">
                          {timestampMin}:{timestampSec}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-0.5 whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
