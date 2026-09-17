import React, { useState, useEffect, memo, useRef } from 'react';
import { Film } from 'lucide-react';
import { getYouTubeThumbnail16x9, extractYouTubeId } from '../utils/youtubeUtils';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { getCachedImageUrl } from '../utils/storageManager';

interface CinematicPosterProps {
  src?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fadeHeightPercent?: number; // default 5 (approx 5%)
  blurAmount?: string; // default "blur-2xl"
  blurScale?: string; // default "scale-125"
  blurOpacity?: string; // default "opacity-60"
  fallbackIcon?: React.ReactNode;
  aspectRatioClass?: string; // e.g. "aspect-[2/3]", "h-full w-full"
  priority?: boolean;
  objectFit?: 'contain' | 'cover'; // default "contain"
}

/**
 * Resolves high-resolution 16:9 poster/thumbnail artwork, with optimized fallback strategy.
 */
export function getOptimizedPosterUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }
  return getOptimizedImageUrl(trimmed, { width: 600, quality: 75 });
}

/**
 * Universal Cinematic Poster Component
 * 
 * Guarantees:
 * 1. Fast, progressive loading with WebP/HQ defaults and async decoding.
 * 2. Zero Cropping in contain mode, full bleed edge-to-edge in 16:9 cover mode.
 * 3. Blurred Ambient Backdrop: Fills any empty letterbox/pillarbox space when using contain.
 * 4. Minimal Bottom Edge Gradient: Affects only the bottom ~5% of the poster's height.
 * 5. Multi-tiered error fallback (maxres -> hqdefault -> mqdefault).
 */
export const CinematicPoster: React.FC<CinematicPosterProps> = memo(({
  src,
  alt,
  className = '',
  containerClassName = '',
  fadeHeightPercent = 5,
  blurAmount = 'blur-2xl',
  blurScale = 'scale-125',
  blurOpacity = 'opacity-60',
  fallbackIcon,
  aspectRatioClass = 'w-full h-full',
  priority = false,
  objectFit = 'contain',
}) => {
  const optimizedBase = getOptimizedPosterUrl(src);
  const [currentNetworkSrc, setCurrentNetworkSrc] = useState(optimizedBase);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Track mount status to prevent setting state on unmounted components
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const nextOptimized = getOptimizedPosterUrl(src);
    setCurrentNetworkSrc(nextOptimized);
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  // Load image through our caching layer
  useEffect(() => {
    if (!currentNetworkSrc || hasError) return;
    
    let isActive = true;
    getCachedImageUrl(currentNetworkSrc)
      .then(url => {
        if (isActive && isMounted.current) {
          setResolvedSrc(url);
        }
      })
      .catch(() => {
        if (isActive && isMounted.current) {
          setResolvedSrc(currentNetworkSrc);
        }
      });
      
    return () => {
      isActive = false;
    };
  }, [currentNetworkSrc, hasError]);

  const handleError = () => {
    if (hasError) return;
    
    // If maxresdefault failed, fallback down the YouTube thumbnail tier
    if (currentNetworkSrc.includes('maxresdefault.jpg')) {
      setCurrentNetworkSrc(currentNetworkSrc.replace('maxresdefault.jpg', 'hqdefault.jpg'));
    } else if (currentNetworkSrc.includes('hqdefault.jpg')) {
      setCurrentNetworkSrc(currentNetworkSrc.replace('hqdefault.jpg', 'mqdefault.jpg'));
    } else if (currentNetworkSrc.includes('/0.jpg')) {
      setCurrentNetworkSrc(currentNetworkSrc.replace('/0.jpg', 'hqdefault.jpg'));
    } else {
      setHasError(true);
    }
  };

  if (!src || !src.trim() || !currentNetworkSrc || !currentNetworkSrc.trim() || hasError || !resolvedSrc) {
    return (
      <div className={`relative flex flex-col items-center justify-center bg-zinc-950 text-zinc-600 select-none overflow-hidden ${aspectRatioClass} ${containerClassName}`}>
        {fallbackIcon || <Film className="w-8 h-8 text-zinc-700 mb-1.5" />}
        <span className="text-[11px] text-zinc-500 font-medium px-2 text-center line-clamp-2">
          {alt}
        </span>
      </div>
    );
  }

  const isCover = objectFit === 'cover';

  return (
    <div className={`relative overflow-hidden bg-zinc-950 select-none ${aspectRatioClass} ${containerClassName}`}>
      {/* 1. Blurred ambient background (only needed if using contain to eliminate voids) */}
      {!isCover && (
        <img
          src={resolvedSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover ${blurScale} ${blurAmount} ${blurOpacity} brightness-75 select-none pointer-events-none transition-opacity duration-300 ${
            isLoaded ? 'opacity-60' : 'opacity-0'
          }`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}

      {/* 2. Foreground Poster Image: object-cover (full bleed screen fit) or object-contain */}
      <img
        src={resolvedSrc}
        alt={alt}
        className={`relative z-[1] w-full h-full ${isCover ? 'object-cover object-center' : 'object-contain'} block transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
      />

      {/* 3. Bottom gradient fade if configured */}
      {fadeHeightPercent > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none z-[2]"
          style={{
            height: `${fadeHeightPercent}%`,
            background: 'linear-gradient(to top, rgba(10, 10, 10, 1) 0%, rgba(10, 10, 10, 0.4) 40%, rgba(10, 10, 10, 0) 100%)',
          }}
        />
      )}
    </div>
  );
});

CinematicPoster.displayName = 'CinematicPoster';
