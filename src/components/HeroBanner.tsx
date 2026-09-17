import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, XpAccount } from '../types';
import { getHeroSettings, HeroCategoryConfig, DEFAULT_HERO_CATEGORIES } from '../utils/mediaCatalogStore';
import { getOptimizedBackdropImageUrl } from '../utils/imageOptimizer';
import { preloadImage } from '../utils/imagePreloader';
import { useTranslation } from '../i18n/LanguageContext';

// High-speed, guaranteed reliable CDN fallback cinematic backdrops
const CATEGORY_BACKDROP_FALLBACKS: Record<string, string> = {
  action: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1200',
  comedy: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=1200',
  horror: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=1200',
  bts: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1200',
  'sci-fi': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
  default: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1200'
};

interface HeroBannerProps {
  items?: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  onOpenSearch?: () => void;
  onOpenJoinWatchParty?: () => void;
  onOpenMembership?: () => void;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  onSignIn?: () => void;
  account: XpAccount;
  currentUser?: any;
  isGuest?: boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  onPlay,
  onOpenDetail,
  watchlist,
  onToggleWatchlist,
  account,
  currentUser,
  isGuest,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [heroCategories, setHeroCategories] = useState<HeroCategoryConfig[]>(() => getHeroSettings());
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setHeroCategories(getHeroSettings());
    };
    window.addEventListener('farukat_catalog_updated', handleUpdate);
    return () => window.removeEventListener('farukat_catalog_updated', handleUpdate);
  }, []);

  const categories = heroCategories && heroCategories.length > 0 ? heroCategories : DEFAULT_HERO_CATEGORIES;
  const current = categories[currentIndex % categories.length] || categories[0] || DEFAULT_HERO_CATEGORIES[0];
  const nextItem = categories[(currentIndex + 1) % categories.length];

  // Preload all category hero slides in advance for instant transitions
  useEffect(() => {
    categories.forEach((cat) => {
      if (cat.image) {
        preloadImage(getOptimizedBackdropImageUrl(cat.image));
      }
      const fallback = CATEGORY_BACKDROP_FALLBACKS[cat.id] || CATEGORY_BACKDROP_FALLBACKS.default;
      preloadImage(fallback);
    });
  }, [categories]);

  useEffect(() => {
    if (categories.length <= 1) return;
    const interval = setInterval(() => {
      setIsLoaded(false);
      setCurrentIndex((prev) => (prev + 1) % categories.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [categories.length]);

  const fallbackUrl = CATEGORY_BACKDROP_FALLBACKS[current.id] || CATEGORY_BACKDROP_FALLBACKS.default;
  const rawImage = failedImages[current.id] ? fallbackUrl : (current.image || fallbackUrl);
  const optimizedHeroImage = getOptimizedBackdropImageUrl(rawImage);

  return (
    <div className="relative w-full h-[65vh] sm:h-[70vh] min-h-[480px] overflow-hidden bg-[#0a0a0a] select-none">
      {/* Cinematic Background Ambient Gradient Placeholder */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#121015] via-[#0b090e] to-[#050505]" />

      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0">
        <img
          key={`${current.id}_${optimizedHeroImage}`}
          src={optimizedHeroImage}
          alt={current.label}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (!failedImages[current.id]) {
              setFailedImages((prev) => ({ ...prev, [current.id]: true }));
            }
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            isLoaded ? 'opacity-100' : 'opacity-40'
          } animate-slowZoom`}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />

        {/* Global Readability Treatments */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[#050505]/20" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050505] via-[#050505]/75 to-transparent pointer-events-none" />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 pb-8 sm:pb-12 max-w-7xl mx-auto">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-[#e2b14c] font-black uppercase tracking-[0.2em] drop-shadow-lg">
              {t('home.featured', undefined, 'Featured')}
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase drop-shadow-2xl">
              {current.label}
            </h1>
          </div>
          
          <p className="text-xs sm:text-sm text-neutral-300 max-w-sm leading-relaxed drop-shadow">
            {current.tagline}
          </p>

          <div className="mt-3 flex items-center gap-4">
            {/* Clean Carousel Indicators */}
            <div className="flex items-center gap-1.5">
              {categories.map((cat, idx) => (
                <button
                  key={cat.id || idx}
                  onClick={() => {
                    setIsLoaded(false);
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                    idx === currentIndex ? 'w-6 bg-[#e2b14c]' : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
