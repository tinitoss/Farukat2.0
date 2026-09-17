import React, { useRef, useMemo, memo } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { WatchProgress, MediaItem } from '../types';
import { useImagePreloader } from '../utils/imagePreloader';
import { getOptimizedCardImageUrl } from '../utils/imageOptimizer';
import { useTranslation } from '../i18n/LanguageContext';

interface BecauseYouWatchedRowProps {
  history: WatchProgress[];
  catalog: MediaItem[];
  onPlay: (item: MediaItem, episodeId?: string) => void;
  onOpenDetail: (item: MediaItem) => void;
}

export const BecauseYouWatchedRow: React.FC<BecauseYouWatchedRowProps> = memo(({
  history,
  catalog,
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

  const { title, recommendations } = useMemo(() => {
    if (!history.length || !catalog.length) return { title: '', recommendations: [] };

    // Sort history by most recently watched
    const sortedHistory = [...history].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
    
    // Find the latest watched item that we can base recommendations on
    for (const h of sortedHistory) {
      const media = catalog.find(m => m.id === h.mediaId);
      if (!media) continue;

      const recs: { media: MediaItem, epId?: string, label: string }[] = [];

      // If it's a series, check for next episode
      if (media.isSeries && media.episodes) {
        if (h.episodeId) {
          const currentEpIndex = media.episodes.findIndex(e => e.id === h.episodeId);
          if (currentEpIndex !== -1 && currentEpIndex < media.episodes.length - 1) {
            // Next episode is available!
            const nextEp = media.episodes[currentEpIndex + 1];
            const nextEpHistory = history.find(x => x.mediaId === media.id && x.episodeId === nextEp.id);
            if (!nextEpHistory || (nextEpHistory && !nextEpHistory.completed)) {
                recs.push({
                    media,
                    epId: nextEp.id,
                    label: `Next: ${nextEp.title}`
                });
            }
          }
        }
      }

      // Add related media from the same category
      const related = catalog.filter(m => m.category === media.category && m.id !== media.id);
      const shuffledRelated = related.sort(() => 0.5 - Math.random()).slice(0, 5);
      
      for (const rel of shuffledRelated) {
        recs.push({
            media: rel,
            label: t('home.recommended', undefined, 'Recommended')
        });
      }

      if (recs.length > 0) {
        const itemTitle = h.mediaTitle || media.title;
        return {
            title: t('home.becauseYouWatched', { title: itemTitle }, `Because you watched ${itemTitle}`),
            recommendations: recs
        };
      }
    }

    return { title: '', recommendations: [] };
  }, [history, catalog, t]);

  const thumbnails = useMemo(() => recommendations.map(r => r.media.thumbnail).filter(Boolean), [recommendations]);
  useImagePreloader(thumbnails);

  if (recommendations.length === 0) return null;

  return (
    <div className="py-4 select-none relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-bold tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            {title}
          </h2>
        </div>

        {recommendations.length > 3 && (
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

      <div className="relative max-w-7xl mx-auto">
        <div 
          ref={rowRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto hide-scrollbar px-4 sm:px-6 pb-4 snap-x snap-mandatory"
        >
          {recommendations.map((rec, idx) => {
            const { media, epId, label } = rec;
            const episode = epId && media.episodes ? media.episodes.find(e => e.id === epId) : undefined;
            const thumbUrl = episode?.thumbnail || media.thumbnail;
            const displayTitle = episode ? episode.title : media.title;

            return (
              <div 
                key={`${media.id}-${epId || 'base'}-${idx}`}
                className="relative flex-none w-[200px] sm:w-[240px] snap-start group cursor-pointer"
              >
                <div 
                  className="aspect-video rounded-xl overflow-hidden relative border border-white/10 group-hover:border-[#e2b14c]/50 transition-colors bg-[var(--bg-card)]"
                  onClick={() => onOpenDetail(media)}
                >
                  <img
                    src={getOptimizedCardImageUrl(thumbUrl, 400)}
                    alt={displayTitle}
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="absolute top-2 left-2 bg-[#e2b14c] text-black text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    {label}
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(media, epId);
                      }}
                      className="w-10 h-10 rounded-full bg-[var(--accent-gold)] text-black flex items-center justify-center transform scale-90 group-hover:scale-100 transition shadow-[0_0_20px_rgba(226,177,76,0.3)] hover:brightness-110"
                    >
                      <Play className="w-5 h-5 ml-1" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 px-1">
                  <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
                    {displayTitle}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                      {media.title} {episode ? `• EP ${media.episodes?.findIndex(e => e.id === epId)! + 1}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
