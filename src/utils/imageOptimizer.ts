import { extractYouTubeId } from './youtubeUtils';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg';
  fit?: 'crop' | 'clip' | 'scale' | 'cover';
  preferWebp?: boolean;
}

const DEFAULT_FALLBACK_CARD = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600';
const DEFAULT_FALLBACK_BACKDROP = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1200';
const DEFAULT_FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=75&w=120';

/**
 * Optimizes external and remote image URLs to minimize byte weight,
 * enable next-gen formats (WebP/AVIF), and size images precisely for mobile/desktop.
 */
export function getOptimizedImageUrl(
  url?: string | null,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const {
    width,
    height,
    quality = 75,
    fit = 'crop',
  } = options;

  // 1. Unsplash Images Optimization
  // Unsplash defaults can be 4K/10MB. We strip existing sizing and inject optimal responsive sizing & webp/avif auto formatting.
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(trimmed);
      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', fit);
      parsedUrl.searchParams.set('q', quality.toString());
      if (width) parsedUrl.searchParams.set('w', width.toString());
      if (height) parsedUrl.searchParams.set('h', height.toString());
      return parsedUrl.toString();
    } catch {
      // Fallback string replacement if URL constructor fails
      const clean = trimmed.split('?')[0];
      const params = new URLSearchParams();
      params.set('auto', 'format');
      params.set('fit', fit);
      params.set('q', quality.toString());
      if (width) params.set('w', width.toString());
      if (height) params.set('h', height.toString());
      return `${clean}?${params.toString()}`;
    }
  }

  // 2. YouTube Thumbnail Optimization
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    // For small thumbnails (under 400px wide, e.g. avatars, lists, mobile cards),
    // hqdefault (480x360, ~20KB) or WebP is ultra-fast, 100% reliable (never 404s).
    if (width && width <= 360) {
      return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }
    // For large hero or modal backdrops (>800px)
    if (width && width >= 800) {
      return `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
    }
    // Default crisp 16:9 thumbnail
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  // 3. Postimg & other direct CDNs
  return trimmed;
}

/**
 * Generates an avatar optimized URL (100-120px, WebP compressed)
 */
export function getOptimizedAvatarUrl(url?: string | null, size = 120): string {
  if (!url || typeof url !== 'string' || !url.trim()) return `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=75&w=${size}`;
  const optimized = getOptimizedImageUrl(url, { width: size, height: size, quality: 75 });
  return optimized || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=75&w=${size}`;
}

/**
 * Generates a thumbnail optimized URL for cards (400-480px, WebP compressed)
 */
export function getOptimizedCardImageUrl(url?: string | null, width = 480): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return `https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=${width}`;
  }
  const optimized = getOptimizedImageUrl(url, { width, quality: 75 });
  return optimized || `https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=${width}`;
}

/**
 * Generates a backdrop / hero image URL (1080-1200px, WebP compressed)
 */
export function getOptimizedBackdropImageUrl(url?: string | null, width = 1200): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=${width}`;
  }
  const optimized = getOptimizedImageUrl(url, { width, quality: 80 });
  return optimized || `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=${width}`;
}
