import { MediaItem, Episode, WatchProgress } from '../types';
import { auth } from '../firebase';
import { saveUserDataTable, loadUserDataTable } from './firestoreStorage';
import { toggleLikeInDb, fetchUserLikes } from './sheetdbSocial';

export const DEMO_TRAILER_URLS: Record<string, string> = {
  default: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  action: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  scifi: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  trailer: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  fun: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
};

export function normalizeVideoUrl(rawUrl: string, category: string = 'default'): string {
  if (!rawUrl || rawUrl.includes('example.com') || rawUrl.trim() === '') {
    if (category === 'scifi') return DEMO_TRAILER_URLS.scifi;
    if (category === 'horror') return DEMO_TRAILER_URLS.trailer;
    if (category === 'skits') return DEMO_TRAILER_URLS.fun;
    return DEMO_TRAILER_URLS.action;
  }
  let url = rawUrl.trim();

  // Convert Dropbox URLs to direct streaming URLs (raw=1 on dl.dropboxusercontent.com)
  if (url.includes('dropbox.com') || url.includes('dropboxusercontent.com')) {
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('dl.dropbox.com', 'dl.dropboxusercontent.com');
    // Replace dl=0 or dl=1 with raw=1 so the browser streams inline without attachment download blocking
    if (url.includes('dl=0')) {
      url = url.replace('dl=0', 'raw=1');
    } else if (url.includes('dl=1')) {
      url = url.replace('dl=1', 'raw=1');
    } else if (!url.includes('raw=')) {
      url = url.includes('?') ? `${url}&raw=1` : `${url}?raw=1`;
    }
  }
  return url;
}

export function getActiveUserId(explicitUid?: string): string | null {
  if (explicitUid && explicitUid.trim()) return explicitUid.trim();
  const firebaseUser = auth.currentUser;
  if (firebaseUser?.uid) return firebaseUser.uid;
  try {
    const sessionRaw = sessionStorage.getItem('farukat_current_session_v2') || localStorage.getItem('farukat_current_session_v2');
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session?.uid) return session.uid;
    }
  } catch {}
  return null;
}

// In-memory watch history map keyed strictly by UID
const watchHistoryCache = new Map<string, WatchProgress[]>();

export function clearMediaUtilsCache(): void {
  watchHistoryCache.clear();
}

export function getStoredWatchlist(explicitUid?: string): string[] {
  const uid = getActiveUserId(explicitUid);
  if (!uid || uid === 'guest') return [];
  try {
    const raw = localStorage.getItem(`farukat_watchlist_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getStoredLikes(explicitUid?: string): string[] {
  const uid = getActiveUserId(explicitUid);
  if (!uid || uid === 'guest') return [];
  try {
    const raw = localStorage.getItem(`farukat_likes_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getWatchHistory(explicitUid?: string): WatchProgress[] {
  const uid = getActiveUserId(explicitUid);
  if (!uid || uid === 'guest') return [];
  if (watchHistoryCache.has(uid)) {
    return watchHistoryCache.get(uid)!;
  }
  try {
    const raw = localStorage.getItem(`farukat_history_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    watchHistoryCache.set(uid, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export async function clearWatchHistory(explicitUid?: string): Promise<void> {
  const uid = getActiveUserId(explicitUid);
  if (!uid || uid === 'guest') return;
  watchHistoryCache.delete(uid);

  // 1. Clear LocalStorage history & individual item watch progress keys
  try {
    localStorage.removeItem(`farukat_history_${uid}`);
    localStorage.removeItem('farukat_watch_history_v1');
    localStorage.removeItem(`farukat_pending_watch_sync_${uid}`);

    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`farukat_watch_prog_${uid}_`) || key.startsWith(`farukat_history_${uid}`) || key.startsWith('farukat_watch_prog_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      window.dispatchEvent(new CustomEvent('farukat_history_updated', { detail: [] }));
    }
  } catch (err) {
    console.warn('Error clearing local watch history:', err);
  }

  // 2. Clear cloud history user data table
  try {
    await saveUserDataTable('history', uid, { history: [], userId: uid });
  } catch (err) {
    console.warn('Error clearing cloud watch history table:', err);
  }

  // 3. Clear Turso watch progress table
  try {
    const { clearTursoWatchProgress } = await import('./tursoClient');
    await clearTursoWatchProgress(uid);
  } catch (err) {
    console.warn('Error clearing Turso watch progress:', err);
  }

  // 4. Clear Firestore watch progress caches
  try {
    const { clearFirestoreWatchProgress } = await import('./watchProgressManager');
    await clearFirestoreWatchProgress(uid);
  } catch (err) {
    console.warn('Error clearing Firestore watch progress:', err);
  }
}

export function getUserRatings(explicitUid?: string): Record<string, number> {
  const uid = getActiveUserId(explicitUid);
  if (!uid || uid === 'guest') return {};
  try {
    const raw = localStorage.getItem(`farukat_ratings_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getDownloadedIds(explicitUid?: string): string[] {
  const uid = getActiveUserId(explicitUid);
  if (!uid || uid === 'guest') return [];
  try {
    const raw = localStorage.getItem(`farukat_downloads_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleStoredWatchlist(id: string, current: string[], explicitUid?: string): string[] {
  const exists = current.includes(id);
  const updated = exists ? current.filter(item => item !== id) : [...current, id];
  const userId = getActiveUserId(explicitUid);
  if (userId && userId !== 'guest') {
    try {
      localStorage.setItem(`farukat_watchlist_${userId}`, JSON.stringify(updated));
    } catch {}
    saveUserDataTable('watchlists', userId, { mediaIds: updated, userId });
  }
  return updated;
}

export function toggleStoredLike(id: string, current: string[], explicitUid?: string): string[] {
  const exists = current.includes(id);
  const updated = exists ? current.filter(item => item !== id) : [...current, id];
  const userId = getActiveUserId(explicitUid);
  if (userId && userId !== 'guest') {
    try {
      localStorage.setItem(`farukat_likes_${userId}`, JSON.stringify(updated));
    } catch {}
    toggleLikeInDb(id, userId).catch(err => console.error("Error toggling like in Firebase", err));
  }
  return updated;
}

let historyDebounceTimer: any = null;

export function saveWatchProgress(progress: WatchProgress, historyOrSkipSync?: WatchProgress[] | boolean, explicitUid?: string): WatchProgress[] {
  const isSkipSync = historyOrSkipSync === true;
  const userId = getActiveUserId(explicitUid);
  const current = Array.isArray(historyOrSkipSync) ? historyOrSkipSync : (userId ? getWatchHistory(userId) : []);
  const history = current.filter(h => !(h.mediaId === progress.mediaId && (!progress.episodeId || h.episodeId === progress.episodeId)));
  history.unshift(progress);
  const newHistory = history.slice(0, 30);
  
  if (userId && userId !== 'guest') {
    watchHistoryCache.set(userId, newHistory);
    try {
      localStorage.setItem(`farukat_history_${userId}`, JSON.stringify(newHistory));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('farukat_history_updated', { detail: newHistory }));
      }
    } catch {}
  }
  return newHistory;
}

export function saveUserRating(mediaId: string, rating: number, currentRatings: Record<string, number>, explicitUid?: string): Record<string, number> {
  const updated = { ...currentRatings, [mediaId]: rating };
  const userId = getActiveUserId(explicitUid);
  if (userId && userId !== 'guest') {
    try {
      localStorage.setItem(`farukat_ratings_${userId}`, JSON.stringify(updated));
    } catch {}
    saveUserDataTable('ratings', userId, { ratings: updated });
  }
  return updated;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) {
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function toggleDownload(id: string, current: string[], explicitUid?: string): string[] {
  const exists = current.includes(id);
  const updated = exists ? current.filter(item => item !== id) : [...current, id];
  const userId = getActiveUserId(explicitUid);
  if (userId && userId !== 'guest') {
    try {
      localStorage.setItem(`farukat_downloads_${userId}`, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function getLocalizedTitle(item: MediaItem | Episode, lang: string): string {
  if (lang === 'sq' && 'title_sq' in item && item.title_sq) {
    return item.title_sq;
  }
  return item.title;
}

export function getLocalizedDescription(item: MediaItem | Episode, lang: string): string {
  if (lang === 'sq' && 'description_sq' in item && item.description_sq) {
    return item.description_sq;
  }
  return item.description;
}
