import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Star, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { MediaItem, XpAccount, UserProfile } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';
import { FarukatLogo } from './FarukatLogo';
import { RenderUserIdentity } from './UserIdentityRenderer';
import { CinematicPoster } from './CinematicPoster';
import { useTranslation } from '../i18n/LanguageContext';

interface SearchModalProps {
  onClose: () => void;
  onSelectMedia: (item: MediaItem) => void;
  account?: XpAccount;
  currentUser?: any;
  isGuest?: boolean;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  onClose,
  onSelectMedia,
  account,
  currentUser,
  isGuest,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'movies' | 'series'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const isGuestUser = isGuest || !currentUser || !!currentUser?.isGuest || currentUser?.uid === 'guest' || !!currentUser?.isAnonymous;

  // Auto-focus only after slide-in animation finishes (340ms) so mobile keyboard doesn't clip the transition
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 340);
    return () => clearTimeout(timer);
  }, []);

  const trendingSearches = ['Dardi', 'Bora', 'The Survivor', 'Action', 'Skits'];
  
  const browseCategories = [
    { id: 'movies', label: t('common.movies', undefined, 'Movies') },
    { id: 'series', label: t('common.series', undefined, 'Series') },
    { id: 'action', label: t('genres.action', undefined, 'Action') },
    { id: 'drama', label: t('genres.drama', undefined, 'Drama') },
    { id: 'comedy', label: t('genres.comedy', undefined, 'Comedy') },
    { id: 'horror', label: t('genres.horror', undefined, 'Horror') },
    { id: 'thriller', label: t('genres.thriller', undefined, 'Thriller') },
    { id: 'scifi', label: t('genres.scifi', undefined, 'Sci-Fi') },
  ];

  // Logic for search
  const filteredResults = useMemo(() => {
    let list = MEDIA_CATALOG;
    if (filterType === 'movies') {
        list = list.filter(m => !m.isSeries);
    } else if (filterType === 'series') {
        list = list.filter(m => m.isSeries);
    }
    
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags?.some((t) => t.toLowerCase().includes(q)) ||
          m.cast?.some((c) => c.toLowerCase().includes(q)) ||
          m.director?.toLowerCase().includes(q) ||
          m.episodes?.some((ep) => ep.title.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q))
      );
    }
    
    return list;
  }, [query, filterType]);

  const popularOnFarukat = useMemo(() => MEDIA_CATALOG.filter(m => m.featured).slice(0, 10), []);
  const recentlyAdded = useMemo(() => [...MEDIA_CATALOG].sort((a,b) => parseInt(b.year) - parseInt(a.year)).slice(0, 10), []);

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: '0%', opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{
        duration: 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="fixed inset-0 z-50 bg-[var(--bg-surface)] flex flex-col h-full select-none will-change-transform shadow-2xl"
      style={{ willChange: 'transform, opacity' }}
    >
       {/* HEADER */}
       <div className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/5 bg-[var(--bg-surface)]/90 backdrop-blur-md">
         <FarukatLogo size="sm" showText={true} />
         <div className="flex items-center gap-4">
            {account && !isGuestUser && (
              <div className="w-9 h-9 rounded-full overflow-hidden">
                <RenderUserIdentity
                  user={account.profile}
                  equippedCosmetics={account.equippedCosmetics}
                  showName={false}
                  size="md"
                />
              </div>
            )}
            <button
               onClick={onClose}
               className="p-2 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all duration-150 ease-out active:scale-90 cursor-pointer"
             >
               <X className="w-5 h-5" />
             </button>
         </div>
       </div>

       {/* SEARCH BAR */}
       <div className="px-4 sm:px-8 pt-6 pb-2 max-w-5xl mx-auto w-full">
         <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-muted)] group-focus-within:text-[#e2b14c] transition-colors pointer-events-none" />
            <input 
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder', undefined, 'Search movies, series, people...')}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] focus:border-[#e2b14c]/70 rounded-2xl pl-14 pr-14 py-4 text-lg text-[var(--text-primary)] placeholder-[#666] outline-none shadow-sm transition-all focus:bg-[#171717]"
            />
            {query && (
               <button 
                 onClick={() => setQuery('')} 
                 className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition active:scale-90 cursor-pointer"
               >
                  <X className="w-5 h-5" />
               </button>
            )}
         </div>
       </div>

       {/* BODY CONTENT */}
       <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-12 max-w-7xl mx-auto w-full scrollbar-none">
          {!query.trim() ? (
             <div className="space-y-12 mt-8 animate-fadeIn">
                {/* Trending Searches */}
                <div>
                  <h3 className="text-[var(--text-primary)] font-bold text-lg mb-5 flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-[#e2b14c]" /> {t('search.trendingSearches', undefined, 'Trending Searches')}
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                     {trendingSearches.map(term => (
                        <button 
                          key={term} 
                          onClick={() => setQuery(term)} 
                          className="px-5 py-2.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[#ccc] hover:text-[#e2b14c] hover:border-[#e2b14c]/50 text-sm font-semibold transition cursor-pointer shadow-sm"
                        >
                           {term}
                        </button>
                     ))}
                  </div>
                </div>

                {/* Browse */}
                <div>
                   <h3 className="text-[var(--text-primary)] font-bold text-lg mb-5">{t('search.browse', undefined, 'Browse')}</h3>
                   <div className="flex flex-wrap gap-2.5">
                      {browseCategories.map(cat => (
                         <button 
                           key={cat.id} 
                           onClick={() => setQuery(cat.label)} 
                           className="px-5 py-2.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[#ccc] hover:text-[var(--text-primary)] hover:border-[var(--border-elevated)] text-sm font-semibold transition cursor-pointer shadow-sm"
                         >
                            {cat.label}
                         </button>
                      ))}
                   </div>
                </div>

                {/* Popular on FARUKAT */}
                <div>
                   <h3 className="text-[var(--text-primary)] font-bold text-lg mb-5 flex items-center gap-2">
                     {t('search.popularTitle', undefined, 'Popular on FARUKAT')} <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                   </h3>
                   <div className="flex items-center gap-4 overflow-x-auto scrollbar-none pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                      {popularOnFarukat.map(item => (
                         <div 
                           key={item.id} 
                           onClick={() => { onSelectMedia(item); onClose(); }} 
                           className="flex-shrink-0 w-32 sm:w-40 lg:w-44 group cursor-pointer"
                         >
                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-white/5 group-hover:border-[#e2b14c]/40 transition-colors shadow-md">
                               <CinematicPoster src={item.poster} alt={item.title} aspectRatioClass="w-full h-full" fadeHeightPercent={5} />
                            </div>
                            <h4 className="text-sm font-bold text-[#e0e0e0] mt-3 line-clamp-1 group-hover:text-[#e2b14c] transition">{item.title}</h4>
                         </div>
                      ))}
                   </div>
                </div>

                {/* Recently Added */}
                <div>
                   <h3 className="text-[var(--text-primary)] font-bold text-lg mb-5 flex items-center gap-2">
                     {t('search.recentlyAdded', undefined, 'Recently Added')} <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                   </h3>
                   <div className="flex items-center gap-4 overflow-x-auto scrollbar-none pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                      {recentlyAdded.map(item => (
                         <div 
                           key={item.id} 
                           onClick={() => { onSelectMedia(item); onClose(); }} 
                           className="flex-shrink-0 w-32 sm:w-40 lg:w-44 group cursor-pointer"
                         >
                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-white/5 group-hover:border-[#e2b14c]/40 transition-colors shadow-md">
                               <CinematicPoster src={item.poster} alt={item.title} aspectRatioClass="w-full h-full" fadeHeightPercent={5} />
                            </div>
                            <h4 className="text-sm font-bold text-[#e0e0e0] mt-3 line-clamp-1 group-hover:text-[#e2b14c] transition">{item.title}</h4>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          ) : (
             <div className="mt-8 animate-fadeIn">
                {/* Search Results Header & Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8">
                   <h3 className="text-2xl font-bold text-[var(--text-primary)]">{t('search.resultsFor', { query }, `Results for "${query}"`)}</h3>
                   <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 sm:pb-0">
                      {(['all', 'movies', 'series'] as const).map(type => (
                         <button
                           key={type}
                           onClick={() => setFilterType(type)}
                           className={`px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer flex-shrink-0 ${
                             filterType === type 
                               ? 'bg-[#e2b14c] text-black shadow-md' 
                               : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-elevated)]'
                           }`}
                         >
                            {type === 'all' ? t('saved.all', undefined, 'All') : type === 'movies' ? t('common.movies', undefined, 'Movies') : t('common.series', undefined, 'Series')}
                         </button>
                      ))}
                   </div>
                </div>

                {/* Results Grid */}
                {filteredResults.length === 0 ? (
                   <div className="py-24 text-center">
                      <Sparkles className="w-12 h-12 text-[#333] mx-auto mb-5" />
                      <h4 className="text-2xl font-black text-[var(--text-primary)] mb-3">{t('search.noTitlesFound', undefined, 'No titles found')}</h4>
                      <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-10 text-sm leading-relaxed">
                         {t('search.noMatchesDesc', { query }, `We couldn't find any exact matches for "${query}". Try checking for typos or searching for a different genre.`)}
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-3">
                         <button 
                           onClick={() => {setQuery(''); setFilterType('movies')}} 
                           className="px-6 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[#ccc] hover:text-[var(--text-primary)] text-sm font-semibold transition cursor-pointer"
                         >
                            {t('common.movies', undefined, 'Movies')}
                         </button>
                         <button 
                           onClick={() => {setQuery(''); setFilterType('series')}} 
                           className="px-6 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[#ccc] hover:text-[var(--text-primary)] text-sm font-semibold transition cursor-pointer"
                         >
                            {t('common.series', undefined, 'Series')}
                         </button>
                         <button 
                           onClick={() => setQuery('Action')} 
                           className="px-6 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[#ccc] hover:text-[var(--text-primary)] text-sm font-semibold transition cursor-pointer"
                         >
                            {t('search.browse', undefined, 'Browse')}
                         </button>
                      </div>
                   </div>
                ) : (
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
                      {filteredResults.map(item => (
                         <div
                            key={item.id}
                            onClick={() => { onSelectMedia(item); onClose(); }}
                            className="group cursor-pointer flex flex-col"
                         >
                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-white/5 group-hover:border-[#e2b14c]/50 shadow-lg transition-all duration-300 group-hover:shadow-[#e2b14c]/10 group-hover:-translate-y-1">
                               <CinematicPoster
                                 src={item.poster || item.thumbnail}
                                 alt={item.title}
                                 aspectRatioClass="w-full h-full"
                                 fadeHeightPercent={5}
                               />
                               <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[var(--bg-main)]/75 backdrop-blur-md text-[var(--text-primary)] text-[10px] font-black uppercase tracking-wider border border-white/10 z-20">
                                 {item.isSeries ? t('common.series', undefined, 'Series') : t('common.movies', undefined, 'Movies')}
                               </div>
                            </div>
                            <div className="mt-3 px-0.5">
                               <h5 className="text-sm font-bold text-[#e0e0e0] group-hover:text-[var(--text-primary)] transition-colors line-clamp-1">
                                 {item.title}
                               </h5>
                               <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)] mt-1.5">
                                  <span className="flex items-center gap-0.5 text-[#e2b14c]">
                                     <Star className="w-3 h-3 fill-[#e2b14c]" /> {item.rating || 'N/A'}
                                  </span>
                                  <span>·</span>
                                  <span>{item.year}</span>
                                  {item.isSeries && item.episodes && (
                                     <>
                                        <span>·</span>
                                        <span>{t('common.episode_other', { count: item.episodes.length }, `${item.episodes.length} Eps`)}</span>
                                     </>
                                  )}
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          )}
       </div>
    </motion.div>
  );
};

