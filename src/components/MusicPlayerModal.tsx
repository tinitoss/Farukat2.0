import React, { useState, useEffect } from 'react';
import { X, Play, Pause, SkipForward, SkipBack, Music, Disc, Film } from 'lucide-react';
import { SoundtrackItem } from '../types';
import { SOUNDTRACKS_DATA } from '../data/soundtracksData';

interface MusicPlayerModalProps {
  onClose: () => void;
  onWatchVideo?: (track: SoundtrackItem) => void;
}

export const MusicPlayerModal: React.FC<MusicPlayerModalProps> = ({
  onClose,
  onWatchVideo,
}) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(15);
  const [duration, setDuration] = useState(180);

  const track: SoundtrackItem = SOUNDTRACKS_DATA[currentTrackIndex] || SOUNDTRACKS_DATA[0];

  // Track audio engagement for legitimate audio_aficionado achievement
  useEffect(() => {
    try {
      localStorage.setItem('farukat_has_listened_audio', 'true');
    } catch {}
  }, []);

  // Simulated track progress
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            handleNext();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration, currentTrackIndex]);

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % SOUNDTRACKS_DATA.length);
    setCurrentTime(0);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + SOUNDTRACKS_DATA.length) % SOUNDTRACKS_DATA.length);
    setCurrentTime(0);
  };

  const formatAudioTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-md p-3 sm:p-6 animate-fadeIn select-none">
      <div className="relative w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#e50914]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#e50914]/20 border border-[#e50914]/40 flex items-center justify-center">
              <Music className="w-4 h-4 text-[#e50914]" />
            </div>
            <div>
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">FPX Studio Soundtracks</h3>
              <span className="text-[10px] text-[var(--text-muted)]">Original music from films and series</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Track Card Hero */}
        <div className="flex flex-col items-center text-center my-2 z-10">
          <div className="relative w-36 sm:w-44 aspect-square rounded-2xl overflow-hidden bg-[var(--bg-main)] shadow-2xl border border-[var(--border-subtle)] mb-4 group">
            <img
              src={track.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=400'}
              alt={track.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105 rotate-1' : ''}`}
              referrerPolicy="no-referrer"
            />
            {/* Spinning Disc Effect Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center">
              <Disc className={`w-12 h-12 text-[#e50914]/40 ${isPlaying ? 'animate-spin' : ''}`} />
            </div>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">{track.title}</h3>
          <p className="text-xs text-[#a3a3a3] font-medium mt-0.5">{track.artist}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]">
              OST • {track.associatedMovie}
            </span>
            {track.videoUrl && onWatchVideo && (
              <button
                onClick={() => onWatchVideo(track)}
                className="px-2 py-0.5 rounded-full bg-[#e50914]/20 hover:bg-[#e50914]/30 border border-[#e50914]/40 text-[#fca5a5] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Film className="w-3 h-3" />
                <span>Watch Studio Video</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrubber */}
        <div className="my-3 z-10">
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="w-full h-1.5 bg-[var(--bg-card-elevated)] rounded-lg appearance-none cursor-pointer accent-[#e50914]"
          />
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono mt-1">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-5 my-2 z-10">
          <button
            onClick={handlePrev}
            className="p-2.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] text-[#bbb] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition active:scale-90 cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-4 rounded-full bg-[#e50914] hover:bg-[#f40612] text-[var(--text-primary)] shadow-xl shadow-[#e50914]/40 transition transform active:scale-95 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>

          <button
            onClick={handleNext}
            className="p-2.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] text-[#bbb] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition active:scale-90 cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Tracklist Drawer */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
            Tracks in Soundtrack Playlist:
          </span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-none pr-1">
            {SOUNDTRACKS_DATA.map((t, idx) => (
              <div
                key={t.id}
                onClick={() => {
                  setCurrentTrackIndex(idx);
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                  idx === currentTrackIndex
                    ? 'bg-[#e50914]/15 border border-[#e50914]/30 text-[var(--text-primary)] font-bold'
                    : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] text-[var(--text-secondary)] hover:text-[#bbb] border border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] w-4">{idx + 1}</span>
                  <span className="truncate">{t.title}</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono flex-shrink-0">{t.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
