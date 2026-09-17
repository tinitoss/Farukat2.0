import React, { useState, useMemo } from 'react';
import { Search, X, Tv, Sparkles, SlidersHorizontal } from 'lucide-react';
import { MediaItem } from '../types';
import { useImagePreloader } from '../utils/imagePreloader';
import { CinematicPoster } from './CinematicPoster';
import { useTranslation } from '../i18n/LanguageContext';

export interface SeriesViewProps {
  series?: MediaItem[];
  onSelectSeries?: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  onOpenSearch?: () => void;
  compactCatalogView?: boolean;
}

// Realistic sample series fallback array with valid vertical 9:16 poster image URLs
export const DEFAULT_SERIES_LIST = [
  {
    id: "dardi-ladi-1",
    title: "Dardi & Ladi",
    season: "Season 1",
    episodes: 22,
    posterUrl: "https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg",
    quality: "4K"
  },
  {
    id: "too-late-1",
    title: "Too Late",
    season: "Season 1",
    episodes: 12,
    posterUrl: "https://i.postimg.cc/T3trDpZZ/file-00000000ffd481f4b7d1c8c06bfe83b7.png",
    quality: "4K"
  },
  {
    id: "mahalla-kuqe-1",
    title: "Mahalla Kuqe",
    season: "Season 2",
    episodes: 16,
    posterUrl: "https://i.postimg.cc/dtLsrKqz/file-00000000251081f4a79e64a52c8093fe.png",
    quality: "4K"
  },
  {
    id: "tradhtare-1",
    title: "Tradhtare",
    season: "Season 1",
    episodes: 8,
    posterUrl: "https://i.postimg.cc/DzjF8CtY/file-00000000dde8821086d53c8fdd9f9e66.png",
    quality: "HD"
  },
  {
    id: "the-heaters-1",
    title: "The Heaters",
    season: "Season 1",
    episodes: 10,
    posterUrl: "https://i.postimg.cc/Yq14HJXH/797744914-1312747248590955-3081476372174506527-n.jpg",
    quality: "4K"
  },
  {
    id: "mange-1",
    title: "Mange",
    season: "Season 1",
    episodes: 6,
    posterUrl: "https://i.postimg.cc/1XYkqP1D/file-000000008ea4821086d20026e984efd4.png",
    quality: "4K"
  },
  {
    id: "40-dreams-1",
    title: "40 Dreams",
    season: "Season 1",
    episodes: 14,
    posterUrl: "https://i.postimg.cc/j2dWj6Rx/797337120-2004749486876542-8987355201610353384-n.jpg",
    quality: "HDR"
  },
  {
    id: "why-1",
    title: "Why?",
    season: "Season 1",
    episodes: 9,
    posterUrl: "https://i.postimg.cc/FKKN7hqS/file-00000000df5482108a5659ee053ac563.png",
    quality: "4K"
  },
  {
    id: "lifestyle-1",
    title: "Lifestyle",
    season: "Season 1",
    episodes: 7,
    posterUrl: "https://i.postimg.cc/7YM5zYB6/file-000000008eb881f4a197eca87d3e941e.png",
    quality: "HD"
  },
  {
    id: "gt2-1",
    title: "Life Story of Johny",
    season: "Season 1",
    episodes: 15,
    posterUrl: "https://i.postimg.cc/7YM5zYB6/file-000000008eb881f4a197eca87d3e941e.png",
    quality: "4K"
  },
  {
    id: "rikthimi-1",
    title: "Rikthimi",
    season: "Season 1",
    episodes: 8,
    posterUrl: "https://gorgeous-choux-7cd54a.netlify.app/images/rikthimi.png",
    quality: "4K"
  },
  {
    id: "baba-ramiz-series",
    title: "Baba Ramiz",
    season: "Season 1",
    episodes: 3,
    posterUrl: "https://i.postimg.cc/D0Lgbfgq/file-00000000999881f49ca797f4031feea6.png",
    quality: "4K"
  },
  {
    id: "dtkskr-1",
    title: "Detektivi i Fshatit",
    season: "Season 1",
    episodes: 10,
    posterUrl: "https://gorgeous-choux-7cd54a.netlify.app/images/dtkskr.jpg",
    quality: "HD"
  }
];

function getMetaLine(item: any): string {
  const seasonStr = item.season || (item.seasonNumber ? `Season ${item.seasonNumber}` : 'Season 1');
  const episodeCount = Array.isArray(item.episodes) 
    ? item.episodes.length 
    : (typeof item.episodes === 'number' ? item.episodes : (item.episodesCount || 8));
  return `${seasonStr} • ${episodeCount} ${episodeCount === 1 ? 'Episode' : 'Episodes'}`;
}

const SeriesPosterCard: React.FC<{
  item: any;
  onClick: (item: any) => void;
}> = React.memo(({ item, onClick }) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const posterSrc = item.posterUrl || item.poster || item.thumbnail || 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg';
  const qualityTag = item.quality || '4K';
  const title = item.title || 'Untitled Series';

  const seasonStr = item.season || (item.seasonNumber ? `${t('series.season', undefined, 'Season')} ${item.seasonNumber}` : `${t('series.season', undefined, 'Season')} 1`);
  const episodeCount = Array.isArray(item.episodes) 
    ? item.episodes.length 
    : (typeof item.episodes === 'number' ? item.episodes : (item.episodesCount || 8));
  const epLabel = t('series.episodesCount', { count: episodeCount }, `${episodeCount} ${episodeCount === 1 ? 'Episode' : 'Episodes'}`);
  const metaLine = `${seasonStr} • ${epLabel}`;

  return (
    <div
      onClick={() => onClick(item)}
      className="group flex flex-col cursor-pointer select-none outline-none active:scale-[0.96] transition-transform duration-200 ease-out will-change-transform"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* 9:16 Vertical Poster Frame */}
      <div 
        className="relative w-full rounded-[11px] overflow-hidden bg-[#12141c] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.6)] group-hover:border-white/20 transition-colors duration-200"
        style={{ aspectRatio: '9 / 16' }}
      >
        <CinematicPoster
          src={posterSrc}
          alt={title}
          aspectRatioClass="w-full h-full"
          fadeHeightPercent={5}
        />

        {/* Top-Left NEW Badge */}
        {item.isNew && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[4px] bg-emerald-500 text-black text-[9px] font-black tracking-wider uppercase shadow-md pointer-events-none z-20">
            NEW
          </div>
        )}

        {/* Top-Right Glassmorphic Quality Badge */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-main)]/40 backdrop-blur-md border border-white/10 text-[9px] font-bold text-[var(--text-primary)]/90 tracking-wider uppercase shadow-md pointer-events-none z-20">
          {qualityTag}
        </div>
      </div>

      {/* Minimal Typography & Metadata Below Poster */}
      <div className="mt-2 px-0.5 flex flex-col">
        <h3 className="text-xs sm:text-sm font-semibold text-[#f0f0f2] tracking-tight truncate group-hover:text-[var(--text-primary)] transition-colors">
          {title}
        </h3>
        <p className="text-[11px] sm:text-xs text-[#8e8e93] font-normal truncate mt-0.5">
          {metaLine}
        </p>
      </div>
    </div>
  );
});


export const SeriesView: React.FC<SeriesViewProps> = ({
  series,
  onSelectSeries,
  onPlay,
  onOpenSearch,
  compactCatalogView,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const rawList = (series && series.length > 0) ? series : DEFAULT_SERIES_LIST;

  // Preload posters for all series cards in idle time
  const seriesPosterUrls = useMemo(() => {
    return rawList.map((item: any) => item.posterUrl || item.poster || item.thumbnail).filter(Boolean);
  }, [rawList]);
  useImagePreloader(seriesPosterUrls);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.toLowerCase().trim();
    return rawList.filter((item: any) => {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const descMatch = (item.description || '').toLowerCase().includes(q);
      const genreMatch = (item.genre || '').toLowerCase().includes(q);
      return titleMatch || descMatch || genreMatch;
    });
  }, [rawList, searchQuery]);

  const handleCardClick = (item: any) => {
    if (onSelectSeries) {
      onSelectSeries(item);
    } else if (onPlay) {
      onPlay(item);
    }
  };

  const handleSearchToggle = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      setIsSearchExpanded((prev) => !prev);
    }
  };

  return (
    <div 
      className="w-full min-h-[100dvh] bg-[#08090c] text-[var(--text-primary)] font-sans antialiased pb-28 select-none"
      style={{
        paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        paddingLeft: 'calc(12px + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(12px + env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Top Header with Series Title */}
      <div className="max-w-7xl mx-auto mb-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              {t('common.series')}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-primary)]/70">
                {rawList.length}
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Poster Grid */}
      {filteredList.length > 0 ? (
        <div className={`max-w-7xl mx-auto grid ${compactCatalogView ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4.5'}`}>
          {filteredList.map((item, idx) => (
            <SeriesPosterCard 
              key={item.id || `series-${idx}`} 
              item={item} 
              onClick={handleCardClick} 
            />
          ))}
        </div>
      ) : (
        <div className="max-w-md mx-auto py-16 px-4 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--text-primary)]/40 mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">No series found</h3>
          <p className="text-xs text-[#8e8e93] mb-4">
            No series matching &quot;{searchQuery}&quot;
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      )}
    </div>
  );
};

// Clean JS Render Function for consumeable integration
export function renderSeriesGrid(
  seriesList?: any[],
  container?: HTMLElement | null,
  options?: { onSelect?: (item: any) => void }
): string {
  const list = (seriesList && seriesList.length > 0) ? seriesList : DEFAULT_SERIES_LIST;

  const cardsHtml = list.map((item) => {
    const posterSrc = item.posterUrl || item.poster || item.thumbnail || 'https://gorgeous-choux-7cd54a.netlify.app/images/dlserie.jpg';
    const quality = item.quality || '4K';
    const title = item.title || 'Untitled Series';
    const meta = getMetaLine(item);

    return `
      <div 
        class="series-card group flex flex-col cursor-pointer select-none outline-none active:scale-[0.95] transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]"
        data-id="${item.id}"
      >
        <div 
          class="relative w-full rounded-[11px] overflow-hidden bg-[#12141c] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.6)] group-hover:border-white/20 transition-colors duration-300"
          style="aspect-ratio: 9 / 16;"
        >
          <div class="shimmer-loader absolute inset-0 animate-shimmer z-0"></div>
          <img 
            src="${posterSrc}" 
            alt="${title}" 
            loading="lazy" 
            referrerpolicy="no-referrer"
            onload="if(this.previousElementSibling) this.previousElementSibling.style.display='none'; this.classList.remove('opacity-0'); this.classList.add('opacity-100');"
            onerror="this.src='https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80';"
            class="w-full h-full object-cover transition-opacity duration-300 ease-out opacity-0 z-10 relative"
          />
          <div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-main)]/40 backdrop-blur-md border border-white/10 text-[9px] font-bold text-[var(--text-primary)]/90 tracking-wider uppercase shadow-md pointer-events-none z-20">
            ${quality}
          </div>
          <div class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#08090c]/80 via-[#08090c]/20 to-transparent pointer-events-none z-20"></div>
        </div>
        <div class="mt-2.5 px-0.5 flex flex-col">
          <h3 class="text-xs sm:text-sm font-semibold text-[#f0f0f2] tracking-tight truncate group-hover:text-[var(--text-primary)] transition-colors">
            ${title}
          </h3>
          <p class="text-[11px] sm:text-xs text-[#8e8e93] font-normal truncate mt-0.5">
            ${meta}
          </p>
        </div>
      </div>
    `;
  }).join('');

  const fullHtml = `
    <div 
      class="w-full min-h-[100dvh] bg-[#08090c] text-[var(--text-primary)] font-sans antialiased pb-28 select-none"
      style="padding-top: calc(14px + env(safe-area-inset-top, 0px)); padding-left: calc(12px + env(safe-area-inset-left, 0px)); padding-right: calc(12px + env(safe-area-inset-right, 0px));"
    >
      <div class="max-w-7xl mx-auto mb-3.5 flex items-center justify-between gap-2">
        <h1 class="text-base font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          Series
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-primary)]/70">${list.length}</span>
        </h1>
        <button id="series-search-btn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-primary)]/90 text-xs font-semibold cursor-pointer">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <span>Search</span>
        </button>
      </div>
      <div class="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4.5">
        ${cardsHtml}
      </div>
    </div>
  `;

  if (container) {
    container.innerHTML = fullHtml;
    if (options?.onSelect) {
      container.querySelectorAll('.series-card').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          const item = list.find((s) => s.id === id);
          if (item) options.onSelect!(item);
        });
      });
    }
  }

  return fullHtml;
}
