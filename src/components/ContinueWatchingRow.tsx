import React, { useRef, useMemo, memo } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { WatchProgress, MediaItem } from '../types';
import { formatTime } from '../utils/mediaUtils';
import { MEDIA_CATALOG } from '../data/mediaData';
import { useImagePreloader } from '../utils/imagePreloader';
import { getOptimizedCardImageUrl } from '../utils/imageOptimizer';
import { useTranslation } from '../i18n/LanguageContext';

interface ContinueWatchingRowProps {
  history: WatchProgress[];
  onPlay: (item: MediaItem, episodeId?: string) => void;
  onOpenDetail: (item: MediaItem) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = memo(({
  history,
  onPlay,
  onOpenDetail,
}) => {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const activeHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return history.filter((h) => !h.completed && h.duration > 0);
  }, [history]);

  // Preload images for continue watching cards
  const thumbnails = useMemo(() => {
    return activeHistory.map((h) => h.mediaThumbnail).filter(Boolean);
  }, [activeHistory]);
  useImagePreloader(thumbnails);

  if (activeHistory.length === 0) return null;

  return (
    <div className="py-4 select-none relative -mt-4 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-black tracking-wider text-[#e2b14c] uppercase font-mono flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e2b14c] animate-pulse" />
            {t('home.continueWatching')}
          </h2>
          <span className="text-[10px] text-[var(--text-muted)] font-bold font-mono">({activeHistory.length})</span>
        </div>

        {activeHistory.length > 3 && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-1 rounded-full bg-[var(--bg-main)]/60 hover:bg-[var(--bg-main)]/90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1 rounded-full bg-[var(--bg-main)]/60 hover:bg-[var(--bg-main)]/90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/10 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={rowRef}
        className="flex items-stretch gap-3 overflow-x-auto scrollbar-none px-4 sm:px-6 py-1 scroll-smooth"
      >
        {activeHistory.map((h, idx) => {
          const progressPct = Math.min(100, Math.max(5, (h.currentTime / h.duration) * 100));
          const mediaItem = MEDIA_CATALOG.find((m) => m.id === h.mediaId);

          return (
            <div
              key={idx}
              className="w-[200px] sm:w-[240px] flex-shrink-0 group rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-white/5 hover:border-[#e2b14c]/40 transition duration-300 flex flex-col justify-between shadow-lg cursor-pointer"
              onClick={() => {
                if (mediaItem) {
                  onOpenDetail(mediaItem);
                }
              }}
            >
              {/* Media Card Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-zinc-950">
                <img
                  src={getOptimizedCardImageUrl(h.mediaThumbnail, 400)}
                  alt={h.mediaTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Hover Play Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-main)]/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mediaItem) {
                        onPlay(mediaItem, h.episodeId);
                      }
                    }}
                    className="w-9 h-9 rounded-full bg-[#e2b14c] text-black flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-lg shadow-[#e2b14c]/20"
                  >
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  </button>
                </div>

                {/* Duration Tag */}
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[var(--bg-main)]/85 text-[9px] text-[#bbb] font-mono">
                  {formatTime(h.duration - h.currentTime)} left
                </div>
              </div>

              {/* Title Description Info */}
              <div className="p-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11px] sm:text-xs font-black text-[var(--text-primary)] truncate group-hover:text-[#e2b14c] transition-colors">
                    {h.mediaTitle}
                  </h4>
                  {h.episodeTitle ? (
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 font-medium">
                      {h.episodeTitle}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 uppercase font-mono tracking-wider font-bold">
                      Feature Film
                    </p>
                  )}
                </div>

                {/* Progress bar and play button */}
                <div className="mt-2.5">
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-gold)] rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
