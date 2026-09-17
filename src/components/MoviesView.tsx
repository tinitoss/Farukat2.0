import React, { memo } from 'react';
import { Star, Clapperboard } from 'lucide-react';
import { MediaItem } from '../types';
import { CinematicPoster } from './CinematicPoster';
import { getYouTubeThumbnail16x9 } from '../utils/youtubeUtils';
import { useTranslation } from '../i18n/LanguageContext';

interface MoviesViewProps {
  scifiCollection: MediaItem[];
  horrorSpecials: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  compactCatalogView?: boolean;
}

const MovieGridCard: React.FC<{
  item: MediaItem;
  onOpenDetail: (item: MediaItem) => void;
  compact?: boolean;
}> = memo(({ item, onOpenDetail, compact }) => {
  const { t } = useTranslation();
  const posterSrc = getYouTubeThumbnail16x9(item);
  const genreLabel = (() => {
    if (item.category === 'horror') return 'Horror';
    if (item.category === 'scifi') return 'Sci-Fi';
    if (item.tags && item.tags.length > 0) return item.tags[0];
    return t('common.movies');
  })();

  return (
    <div
      onClick={() => onOpenDetail(item)}
      className="group flex flex-col cursor-pointer select-none active:scale-[0.97] transition-transform duration-150"
    >
      <div className={`relative w-full ${compact ? 'aspect-[2/3] rounded-xl' : 'aspect-[3/4] sm:aspect-[2/3] rounded-2xl'} overflow-hidden bg-zinc-950 shadow-[0_6px_24px_rgba(0,0,0,0.65)] transition-all duration-300 group-hover:scale-[1.02] border border-white/5`}>
        <CinematicPoster
          src={posterSrc}
          alt={item.title}
          aspectRatioClass="w-full h-full"
          fadeHeightPercent={8}
          objectFit="cover"
        />
      </div>
      <div className={`mt-${compact ? '1.5' : '3'} flex flex-col px-0.5`}>
        <h3 className={`font-bold ${compact ? 'text-xs sm:text-sm' : 'text-[15px] sm:text-base'} text-white tracking-tight leading-snug line-clamp-1 group-hover:text-[#e2b14c] transition-colors`}>
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] sm:text-xs text-zinc-400 font-medium">
          {item.rating && (
            <span className="flex items-center gap-0.5 text-[#e2b14c] font-semibold shrink-0">
              <Star className="w-3 h-3 fill-[#e2b14c] text-[#e2b14c]" />
              <span>{item.rating}</span>
            </span>
          )}
          {item.rating && <span className="text-zinc-600 font-bold">•</span>}
          <span className="truncate">{genreLabel}</span>
        </div>
      </div>
    </div>
  );
});

MovieGridCard.displayName = 'MovieGridCard';

export const MoviesView: React.FC<MoviesViewProps> = ({
  scifiCollection,
  horrorSpecials,
  onOpenDetail,
  compactCatalogView,
}) => {
  const { t } = useTranslation();
  const allMovies = [...horrorSpecials, ...scifiCollection];

  return (
    <div className={`w-full ${compactCatalogView ? 'max-w-7xl' : 'max-w-md'} mx-auto px-4 sm:px-5 py-6 pb-28 animate-fadeIn transition-all duration-300`}>
      <div className="mb-8 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[#e2b14c] text-[11px] font-semibold tracking-wider uppercase mb-1">
          <Clapperboard className="w-3.5 h-3.5" />
          <span>{t('movies.cinematicShowcase', undefined, 'Cinematic Showcase')}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          {t('common.movies')}
        </h1>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          {t('movies.subtitle', undefined, 'Curated feature films, sci-fi sagas, and psychological horror specials.')}
        </p>
      </div>

      <div className={`grid ${compactCatalogView ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4' : 'grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10'}`}>
        {allMovies.map((item) => (
          <MovieGridCard
            key={item.id}
            item={item}
            onOpenDetail={onOpenDetail}
            compact={compactCatalogView}
          />
        ))}
      </div>
    </div>
  );
};
