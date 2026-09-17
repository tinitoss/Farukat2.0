import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Play,
  Trash2,
  Star,
  Search,
  LayoutGrid,
  List,
  Info,
  Tv,
  Film,
  Clock,
  Sparkles,
} from 'lucide-react';
import { MediaItem } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';
import { getVerifiedDuration } from '../utils/durationStore';
import { useTranslation } from '../i18n/LanguageContext';

interface MyListViewProps {
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  likes: string[];
  history: any[];
  downloads: string[];
  onToggleDownload: (id: string) => void;
  onPlay: (item: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
  ratings: Record<string, number>;
  onExploreCatalog?: () => void;
  compactCatalogView?: boolean;
}

export const MyListView: React.FC<MyListViewProps> = ({
  watchlist,
  onToggleWatchlist,
  likes,
  downloads,
  onPlay,
  onSelectMedia,
  ratings,
  onExploreCatalog,
  compactCatalogView,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Unified list of all saved items
  const savedItemIds = useMemo(() => {
    return Array.from(new Set([...watchlist, ...likes, ...downloads]));
  }, [watchlist, likes, downloads]);

  const savedItems = useMemo(
    () => MEDIA_CATALOG.filter((m) => savedItemIds.includes(m.id)),
    [savedItemIds]
  );

  // Filtered saved items by search query & category
  const filteredItems = useMemo(() => {
    return savedItems.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'all' ||
        (selectedCategory === 'series' && (item.isSeries || item.category === 'series')) ||
        (selectedCategory === 'movies' && !item.isSeries) ||
        (selectedCategory === 'behind' && (item.category === 'behind' || item.category === 'deleted')) ||
        (selectedCategory === 'skits' && item.category === 'skits');

      return matchesSearch && matchesCat;
    }, [searchQuery, selectedCategory]);
  }, [savedItems, searchQuery, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 select-none animate-fadeIn text-[var(--text-primary)]">
      {/* 1. Header Section */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-[#e2b14c]" />
              {t('saved.title', undefined, 'MY COLLECTION')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Unified List */}
      <div className="flex flex-col gap-5">
        {/* Controls Bar: Search & Category Filter */}
        {savedItems.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d0d0d] p-3 rounded-2xl border border-[var(--border-subtle)]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('saved.searchPlaceholder', undefined, 'Search in saved playlist...')}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-xs text-[var(--text-primary)] placeholder-[#666] focus:outline-none focus:border-[#e2b14c]"
              />
            </div>

            <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: t('saved.all', undefined, 'All') },
                  { id: 'series', label: t('common.series', undefined, 'Series') },
                  { id: 'movies', label: t('common.movies', undefined, 'Movies') },
                  { id: 'behind', label: t('saved.behindScenes', undefined, 'Behind Scenes') },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition ${
                      selectedCategory === cat.id
                        ? 'bg-[#e2b14c]/20 text-[#e2b14c] border border-[#e2b14c]/40'
                        : 'bg-[#161616] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 pl-2 border-l border-[var(--border-subtle)]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'grid' ? 'bg-[#e2b14c] text-black font-black' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'list' ? 'bg-[#e2b14c] text-black font-black' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Compact List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty Saved State */}
        {savedItems.length === 0 ? (
          <div className="py-20 text-center text-[var(--text-muted)] flex flex-col items-center justify-center bg-[#0d0d0d] border border-[#1e1e1e] rounded-3xl p-6">
            <div className="p-4 rounded-2xl bg-[#e2b14c]/10 text-[#e2b14c] border border-[#e2b14c]/20 mb-4">
              <Bookmark className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-[var(--text-primary)]">{t('saved.emptyTitle', undefined, 'Nothing saved yet.')}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
              {t('saved.emptySubtitle', undefined, 'Explore FARUKAT titles and tap "+ Watchlist" to save them here.')}
            </p>
            {onExploreCatalog && (
              <button
                onClick={onExploreCatalog}
                className="mt-6 px-6 py-3 rounded-2xl bg-[var(--accent-gold)] hover:brightness-110 text-black font-black text-xs transition cursor-pointer shadow-xl shadow-[var(--accent-gold)]/20 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{t('saved.exploreCatalog', undefined, 'Explore Cinema Catalog')}</span>
              </button>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-6">
            <Search className="w-8 h-8 text-[#444] mx-auto mb-2" />
            <p className="text-xs">{t('saved.noMatch', { query: searchQuery }, `No saved titles match "${searchQuery}" in this category.`)}</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-3 text-xs text-[#e2b14c] underline cursor-pointer"
            >
              {t('saved.resetFilters', undefined, 'Reset filters')}
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW WITH LARGE POSTERS & RICH DETAILS */
          <div className={`grid ${compactCatalogView ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'}`}>
            {filteredItems.map((item) => {
              const userRating = ratings[item.id] || item.rating;
              return (
                <div
                  key={item.id}
                  className="group relative rounded-3xl overflow-hidden bg-[#0e0e0e] border border-[var(--border-subtle)] hover:border-[#e2b14c]/50 transition-all duration-300 p-3.5 flex flex-col justify-between shadow-xl"
                >
                  <div className="flex flex-col gap-3">
                    {/* Large Poster Container */}
                    <div
                      onClick={() => onSelectMedia(item)}
                      className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[var(--bg-main)] cursor-pointer group/poster shadow-md"
                    >
                      <img
                        src={item.backdrop || item.thumbnail || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-80 group-hover/poster:opacity-90 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlay(item);
                          }}
                          className="w-12 h-12 rounded-full bg-[#e2b14c] text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer"
                          title="Play Title"
                        >
                          <Play className="w-6 h-6 fill-black ml-0.5" />
                        </button>
                      </div>

                      {/* Top Overlay Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <div className="px-2.5 py-1 rounded-full bg-black/75 text-[#e2b14c] text-[11px] font-bold flex items-center gap-1 border border-[#e2b14c]/30 backdrop-blur-md">
                          <Star className="w-3.5 h-3.5 fill-[#e2b14c]" />
                          <span>{userRating}</span>
                        </div>
                        {item.quality && (
                          <span className="px-2 py-1 rounded-full bg-black/75 text-white text-[10px] font-mono font-bold border border-white/20 backdrop-blur-md">
                            {item.quality}
                          </span>
                        )}
                      </div>

                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-black/75 text-xs font-semibold text-white/90 border border-white/10 backdrop-blur-md flex items-center gap-1">
                          {item.isSeries ? (
                            <>
                              <Tv className="w-3 h-3 text-[#e2b14c]" />
                              <span>{t('common.series', undefined, 'Series')}</span>
                            </>
                          ) : (
                            <>
                              <Film className="w-3 h-3 text-[#e2b14c]" />
                              <span>{t('common.movie', undefined, 'Movie')}</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Bottom Overlay Info on Poster */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-medium text-white/80 pointer-events-none">
                        <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                          <Clock className="w-3 h-3 text-[#e2b14c]" />
                          {getVerifiedDuration(item.id, item.duration)}
                        </span>
                        {item.ageRating && (
                          <span className="bg-red-500/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                            {item.ageRating}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rich Details Section */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          onClick={() => onSelectMedia(item)}
                          className="text-base font-black text-[var(--text-primary)] group-hover:text-[#e2b14c] transition-colors cursor-pointer leading-tight"
                        >
                          {item.title}
                        </h4>
                        <span className="text-xs font-mono text-[#e2b14c] font-bold shrink-0 mt-0.5">
                          {item.year}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Cast or Director details */}
                      {(item.cast?.length || item.director) && (
                        <div className="text-[11px] text-[var(--text-secondary)] line-clamp-1 flex items-center gap-1">
                          <span className="font-semibold text-[var(--text-muted)]">{t('saved.starring', undefined, 'Starring:')}</span>
                          <span>{item.cast?.slice(0, 3).join(', ') || item.director}</span>
                        </div>
                      )}

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#181818] text-[var(--text-secondary)] border border-[#2a2a2a]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => onPlay(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#e2b14c] hover:bg-[#f0c265] text-black font-black text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>{t('saved.watchNow', undefined, 'Watch Now')}</span>
                    </button>

                    <button
                      onClick={() => onSelectMedia(item)}
                      className="p-2 rounded-xl bg-[#181818] hover:bg-[#222] text-[var(--text-secondary)] hover:text-white border border-[#2a2a2a] transition cursor-pointer"
                      title={t('common.details', undefined, 'Details')}
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(item.id);
                      }}
                      className="p-2 rounded-xl bg-[#181818] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 border border-[#2a2a2a] transition cursor-pointer"
                      title={t('common.remove', undefined, 'Remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DETAILED LIST VIEW */
          <div className="flex flex-col gap-3.5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#0e0e0e] border border-[var(--border-subtle)] hover:border-[#e2b14c]/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group shadow-md"
              >
                <div
                  onClick={() => onSelectMedia(item)}
                  className="flex items-start sm:items-center gap-3.5 min-w-0 cursor-pointer w-full sm:w-auto"
                >
                  <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-[var(--bg-main)] shrink-0 border border-[var(--border-subtle)]">
                    <img
                      src={item.backdrop || item.thumbnail || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[#e2b14c] text-[9px] font-bold flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-[#e2b14c]" />
                      <span>{item.rating}</span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-[var(--text-primary)] group-hover:text-[#e2b14c] transition-colors truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a1a1a] text-[#e2b14c] border border-[#333]">
                        {item.isSeries ? t('common.series', undefined, 'Series') : t('common.movie', undefined, 'Movie')}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-mono mt-1.5 flex-wrap">
                      <span>{item.year}</span>
                      <span>•</span>
                      <span>{getVerifiedDuration(item.id, item.duration)}</span>
                      {item.cast && item.cast.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-[var(--text-muted)] truncate max-w-[200px]">
                            {item.cast.slice(0, 2).join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1a1a1a]">
                  <button
                    onClick={() => onPlay(item)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#e2b14c] text-black hover:brightness-110 font-bold text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>{t('saved.watch', undefined, 'Watch')}</span>
                  </button>
                  <button
                    onClick={() => onSelectMedia(item)}
                    className="p-2 rounded-xl bg-[#161616] text-[var(--text-secondary)] hover:text-white border border-[#2a2a2a] transition cursor-pointer"
                    title={t('common.details', undefined, 'Details')}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (watchlist.includes(item.id)) onToggleWatchlist(item.id);
                    }}
                    className="p-2 rounded-xl bg-[#161616] text-[var(--text-muted)] hover:text-red-400 transition border border-[#2a2a2a] cursor-pointer"
                    title={t('common.remove', undefined, 'Remove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

