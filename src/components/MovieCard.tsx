import React, { useState, useEffect, memo } from 'react';
import { Play, Plus, Check, Star, Tv, Film } from 'lucide-react';
import { MediaItem } from '../types';
import { useYouTubeTitle, getYouTubeThumbnail16x9 } from '../utils/youtubeUtils';
import { useVerifiedDuration } from '../utils/durationStore';
import { syncItemYouTubeDuration } from '../utils/youtubeDurationService';
import { CinematicPoster } from './CinematicPoster';
import { useTranslation } from '../i18n/LanguageContext';
import { getLocalizedTitle, getLocalizedDescription } from '../utils/mediaUtils';

interface MovieCardProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  inWatchlist: boolean;
  onToggleWatchlist: (id: string) => void;
  variant?: 'portrait' | 'landscape';
}

export const MovieCard: React.FC<MovieCardProps> = memo(({
  item,
  onPlay,
  onOpenDetail,
  inWatchlist,
  onToggleWatchlist,
  variant = 'portrait',
}) => {
  const { t, language } = useTranslation();
  const [imgError, setImgError] = useState(false);
  
  // Only query YouTube API if item does NOT have a pre-defined title
  const isYoutube = !item.title && (item.videoUrl?.includes('youtube.com') || item.videoUrl?.includes('youtu.be'));
  const fetchedTitle = useYouTubeTitle(isYoutube ? item.videoUrl : undefined);
  const displayTitle = getLocalizedTitle(item, language) || fetchedTitle || 'FPX Media';

  const isLandscape =
    variant === 'landscape' ||
    item.category === 'movie' ||
    item.category === 'horror' ||
    item.category === 'skits' ||
    item.category === 'deleted' ||
    item.category === 'behind' ||
    item.category === 'scifi';
  const displayDuration = useVerifiedDuration(item.id, item.duration);

  useEffect(() => {
    if (item.videoUrl && (item.videoUrl.includes('youtube.com') || item.videoUrl.includes('youtu.be'))) {
      syncItemYouTubeDuration(item);
    }
  }, [item.id, item.videoUrl]);

  return (
    <div
      onClick={() => onOpenDetail(item)}
      className={`group relative flex-shrink-0 cursor-pointer select-none rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] transition-all duration-200 hover:scale-[1.02] hover:border-[var(--border-elevated)] hover:shadow-2xl hover:shadow-black active:scale-[0.96] will-change-transform ${
        isLandscape ? 'w-60 sm:w-72' : 'w-36 sm:w-44'
      }`}
    >
      {/* Poster / Thumbnail Image */}
      <div className={`relative w-full overflow-hidden bg-[var(--bg-surface)] ${isLandscape ? 'aspect-video' : 'aspect-[2/3]'}`}>
        <CinematicPoster
          src={isLandscape ? getYouTubeThumbnail16x9(item) : (item.thumbnail || item.poster)}
          alt={displayTitle}
          aspectRatioClass="w-full h-full"
          fadeHeightPercent={5}
          objectFit={isLandscape ? 'cover' : 'contain'}
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-30">
          <div className="flex items-center gap-1">
            {item.isNew && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider shadow flex items-center gap-0.5">
                NEW
              </span>
            )}
            {item.isSeries ? (
              <span className="px-1.5 py-0.5 rounded bg-[#e50914] text-[var(--text-primary)] text-[9px] font-extrabold uppercase tracking-wider shadow">
                {t('common.series')}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)]/90 backdrop-blur-sm border border-[var(--border-subtle)] text-[#bbb] text-[9px] font-semibold shadow">
                {item.category === 'horror' ? 'Horror' : item.category === 'scifi' ? 'Sci-Fi' : item.category === 'skits' ? 'Skit' : t('common.movies')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-white/10 text-amber-400 text-[10px] font-bold shadow">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            <span>{item.rating}</span>
          </div>
        </div>

        {/* Hover/Touch Quick Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[var(--bg-main)]/45 backdrop-blur-[2px] z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(item);
            }}
            className="w-11 h-11 rounded-full bg-[#e50914] hover:bg-[#f40612] text-[var(--text-primary)] flex items-center justify-center shadow-xl shadow-[#e50914]/50 transition transform hover:scale-110 active:scale-95 cursor-pointer"
            title={`${t('common.play')} ${item.title}`}
          >
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </button>
        </div>

        {/* Quick Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(item.id);
          }}
          className={`absolute bottom-2 right-2 p-1.5 rounded-full border transition active:scale-90 z-20 cursor-pointer ${
            inWatchlist
              ? 'bg-[var(--bg-card)] text-[#e50914] border-[#e50914]/50 shadow-md'
              : 'bg-[var(--bg-main)]/70 text-[#bbb] border-[var(--border-elevated)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-main)]/90'
          }`}
          title={inWatchlist ? t('movies.removeFromList') : t('movies.addToMyList')}
        >
          {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Info Content */}
      <div className="p-2.5 flex flex-col justify-between">
        <h3 className="font-bold text-[var(--text-primary)] text-xs sm:text-sm tracking-tight line-clamp-1 group-hover:text-[var(--text-primary)] transition-colors">
          {displayTitle}
        </h3>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1">
          <span>{item.year}</span>
          <span className="font-medium text-[#a3a3a3]">{displayDuration}</span>
        </div>

        {isLandscape && item.description && (
          <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-1 leading-normal font-normal">
            {getLocalizedDescription(item, language)}
          </p>
        )}
      </div>
    </div>
  );
});

