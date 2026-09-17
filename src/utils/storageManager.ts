import { XpAccount } from '../types';

const IMAGE_CACHE_NAME = 'farukat-image-cache-v1';

export interface StorageStats {
  imageCache: number; // bytes
  tempData: number; // bytes
  total: number; // bytes
}

// Memory map to reuse object URLs
const blobUrlCache = new Map<string, string>();

/**
 * Returns a cached object URL for the image if it exists in the Cache API,
 * otherwise fetches it, caches it, and returns the new object URL.
 */
export async function getCachedImageUrl(url: string): Promise<string> {
  if (!url || !url.trim()) return '';

  if (blobUrlCache.has(url)) {
    return blobUrlCache.get(url)!;
  }

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    let response = await cache.match(url);
    
    if (!response) {
      response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        // Enforce cache limits before adding (e.g., max 500 items)
        await enforceCacheLimit(cache, 500);
        await cache.put(url, response.clone());
      } else {
        // If fetch failed (e.g. CORS issues on fallback images), just return original url
        return url;
      }
    }
    
    if (response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlCache.set(url, objectUrl);
      return objectUrl;
    }
  } catch (error) {
    console.warn('Image cache error, falling back to network url:', error);
  }
  
  return url;
}

/**
 * Enforces a maximum number of items in the image cache using LRU (simplistic approach: deletes oldest).
 */
async function enforceCacheLimit(cache: Cache, maxItems: number) {
  try {
    const keys = await cache.keys();
    if (keys.length >= maxItems) {
      // Remove the first (oldest) 50 items to make room
      const itemsToRemove = keys.slice(0, 50);
      for (const req of itemsToRemove) {
        await cache.delete(req);
      }
    }
  } catch (e) {
    console.error('Cache limit enforcement failed:', e);
  }
}

/**
 * Calculates the exact size of the image cache and other temporary storage.
 */
export async function getStorageStats(): Promise<StorageStats> {
  let imageCacheSize = 0;
  let tempDataSize = 0;

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const keys = await cache.keys();
    
    const responses = await Promise.all(keys.map(k => cache.match(k)));
    for (const res of responses) {
      if (res) {
        const contentLength = res.headers.get('content-length');
        if (contentLength) {
          imageCacheSize += parseInt(contentLength, 10);
        } else {
          // If no content-length, we must read the blob to get its size
          const blob = await res.clone().blob();
          imageCacheSize += blob.size;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to measure image cache', err);
  }

  // Measure Temporary LocalStorage (Durations, old queue items)
  const tempKeys = ['farukat_media_durations', 'farukat_feed_cache'];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && tempKeys.some(tk => key.includes(tk))) {
      const val = localStorage.getItem(key) || '';
      tempDataSize += val.length * 2; // Approximate JS string bytes
    }
  }

  return {
    imageCache: imageCacheSize,
    tempData: tempDataSize,
    total: imageCacheSize + tempDataSize
  };
}

/**
 * Clears the image cache and revokes all object URLs in memory.
 */
export async function clearImageCache(): Promise<void> {
  try {
    await caches.delete(IMAGE_CACHE_NAME);
    for (const url of blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    blobUrlCache.clear();
  } catch (err) {
    console.error('Failed to clear image cache', err);
    throw new Error('Failed to clear image cache');
  }
}

/**
 * Clears temporary data from localStorage without touching permanent user data.
 */
export async function clearTemporaryData(): Promise<void> {
  const tempKeys = ['farukat_media_durations', 'farukat_feed_cache'];
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && tempKeys.some(tk => key.includes(tk))) {
      toRemove.push(key);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Clears all caches (images + temp data).
 */
export async function clearAllCache(): Promise<void> {
  await clearImageCache();
  await clearTemporaryData();
}

/**
 * Formats bytes to human-readable size.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
