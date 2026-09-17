import { useEffect, useRef } from 'react';
import { MediaItem } from '../types';

// Global cache of already preloaded image URLs to avoid duplicate network fetches
const preloadedCache = new Set<string>();
const inFlightRequests = new Map<string, Promise<void>>();

/**
 * Preload a single image URL into browser cache.
 * Returns a Promise that resolves when the image is loaded or fails.
 */
export function preloadImage(url: string | undefined | null): Promise<void> {
  if (!url || typeof url !== 'string') {
    return Promise.resolve();
  }

  const cleanUrl = url.trim();
  if (!cleanUrl) return Promise.resolve();

  // Return immediately if already cached in memory
  if (preloadedCache.has(cleanUrl)) {
    return Promise.resolve();
  }

  // Deduplicate in-flight fetch requests
  if (inFlightRequests.has(cleanUrl)) {
    return inFlightRequests.get(cleanUrl)!;
  }

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      preloadedCache.add(cleanUrl);
      inFlightRequests.delete(cleanUrl);
      resolve();
    };

    img.onerror = () => {
      // Mark resolved to avoid blocking queues on failed images
      inFlightRequests.delete(cleanUrl);
      resolve();
    };

    img.src = cleanUrl;
  });

  inFlightRequests.set(cleanUrl, promise);
  return promise;
}

/**
 * Preload multiple image URLs with concurrency limit to prevent thread starvation.
 */
export async function preloadImages(
  urls: (string | undefined | null)[],
  maxConcurrent = 4
): Promise<void> {
  const validUrls = Array.from(
    new Set(urls.filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim())))
  );

  if (validUrls.length === 0) return;

  const queue = [...validUrls];
  const workers: Promise<void>[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url) {
        await preloadImage(url);
      }
    }
  };

  const poolSize = Math.min(maxConcurrent, validUrls.length);
  for (let i = 0; i < poolSize; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}

/**
 * Helper to safely extract all potential image URLs from a media item.
 */
export function extractMediaImageUrls(item?: MediaItem | null): string[] {
  if (!item) return [];
  const urls: string[] = [];

  if (item.poster) urls.push(item.poster);
  if (item.backdrop) urls.push(item.backdrop);
  if (item.thumbnail) urls.push(item.thumbnail);
  if ((item as any).posterUrl) urls.push((item as any).posterUrl);

  if (item.episodes && Array.isArray(item.episodes)) {
    for (const ep of item.episodes) {
      if (ep.thumbnail) urls.push(ep.thumbnail);
    }
  }

  return urls;
}

/**
 * React hook to preload image URLs smoothly without blocking main thread.
 * Uses requestIdleCallback with setTimeout fallback.
 */
export function useImagePreloader(
  urls: (string | undefined | null)[],
  priority = false
): void {
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  useEffect(() => {
    const list = urlsRef.current;
    if (!list || list.length === 0) return;

    if (priority) {
      preloadImages(list, 4);
      return;
    }

    let cancelId: number | NodeJS.Timeout;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      cancelId = (window as any).requestIdleCallback(
        () => {
          preloadImages(list, 3);
        },
        { timeout: 1500 }
      );
    } else {
      cancelId = setTimeout(() => {
        preloadImages(list, 3);
      }, 50);
    }

    return () => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof cancelId === 'number') {
        (window as any).cancelIdleCallback(cancelId);
      } else {
        clearTimeout(cancelId as NodeJS.Timeout);
      }
    };
  }, [urls]);
}

/**
 * React hook specifically for media carousels and lists to preload upcoming media items
 * in the active row/track, eliminating flickering while horizontal or vertical scrolling.
 */
export function usePreloadUpcoming(
  items: MediaItem[] | undefined | null,
  preloadCount = 8
): void {
  const imagesToPreload = useRef<string[]>([]);

  useEffect(() => {
    if (!items || items.length === 0) return;

    // Collect images for the first `preloadCount` upcoming items
    const upcoming = items.slice(0, preloadCount);
    const collected: string[] = [];

    for (const item of upcoming) {
      collected.push(...extractMediaImageUrls(item));
    }

    imagesToPreload.current = collected;

    let cancelId: number | NodeJS.Timeout;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      cancelId = (window as any).requestIdleCallback(
        () => {
          preloadImages(collected, 4);
        },
        { timeout: 1200 }
      );
    } else {
      cancelId = setTimeout(() => {
        preloadImages(collected, 4);
      }, 60);
    }

    return () => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof cancelId === 'number') {
        (window as any).cancelIdleCallback(cancelId);
      } else {
        clearTimeout(cancelId as NodeJS.Timeout);
      }
    };
  }, [items, preloadCount]);
}
