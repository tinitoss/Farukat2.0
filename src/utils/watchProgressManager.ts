import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { WatchProgress } from '../types';
import { isQuotaError, isQuotaExceeded, markQuotaExceeded } from './quotaHelper';
import { safeExecuteWrite } from './queueManager';

export interface VideoWatchProgressDoc {
  videoId: string;
  currentPositionSeconds: number;
  totalWatchTimeSeconds: number;
  videoDurationSeconds: number;
  progressPercentage: number;
  completed: boolean;
  lastWatchedAt: number;

  // Metadata for local/cloud display and Continue Watching row
  mediaTitle?: string;
  mediaThumbnail?: string;
  episodeTitle?: string;
  episodeId?: string;
  mediaId?: string;
}

// In-memory cache for fast lookups & debounce tracking
const localProgressCache = new Map<string, VideoWatchProgressDoc>();
const lastSyncedDocCache = new Map<string, VideoWatchProgressDoc>();
const lastSyncTimestampMap = new Map<string, number>();

// In-flight sync timers
const syncTimeoutMap = new Map<string, NodeJS.Timeout>();

// Offline pending sync queue key
const getPendingSyncKey = (userId: string) => `farukat_pending_watch_sync_${userId}`;

/**
 * Get active user ID safely.
 */
export function getActiveWatchUserId(explicitUid?: string): string {
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
  return 'guest';
}

/**
 * Calculate the total watch time in seconds from all local watch progress records.
 */
export function getCalculatedTotalWatchSeconds(userId: string): number {
  if (!userId || userId === 'guest' || typeof window === 'undefined') return 0;
  let total = 0;
  try {
    const prefix = `farukat_watch_prog_${userId}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const valRaw = localStorage.getItem(key);
        if (valRaw) {
          const val = JSON.parse(valRaw);
          const itemSeconds = typeof val.totalWatchTimeSeconds === 'number' 
            ? val.totalWatchTimeSeconds 
            : (Number(val.currentPositionSeconds) || 0);
          total += itemSeconds;
        }
      }
    }
  } catch (e) {
    console.warn('Error computing total watch seconds:', e);
  }
  return Math.round(total);
}

/**
 * Timeout helper for Firestore operations to avoid hanging.
 */
function withFirestoreTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Firestore watch progress request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Clean and normalize a video ID for storage and firestore keys.
 */
export function normalizeVideoId(mediaId: string, episodeId?: string): string {
  if (episodeId && episodeId.trim()) {
    return `${mediaId}_ep_${episodeId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  return mediaId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Synchronously load local watch progress from memory cache or LocalStorage.
 */
export function getLocalVideoWatchProgress(
  mediaId: string,
  episodeId?: string,
  explicitUid?: string
): VideoWatchProgressDoc | null {
  const userId = getActiveWatchUserId(explicitUid);
  const videoId = normalizeVideoId(mediaId, episodeId);
  const cacheKey = `${userId}_${videoId}`;

  let localDoc: VideoWatchProgressDoc | null = localProgressCache.get(cacheKey) || null;
  if (!localDoc && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`farukat_watch_prog_${userId}_${videoId}`);
      if (raw) {
        localDoc = JSON.parse(raw) as VideoWatchProgressDoc;
        localProgressCache.set(cacheKey, localDoc);
      }
    } catch (e) {
      console.warn('Error reading local watch progress:', e);
    }
  }
  return localDoc;
}

/**
 * Load the latest watch progress for a video.
 * Local-first: checks LocalStorage immediately, then queries Firestore once,
 * resolving with the newest timestamp (lastWatchedAt).
 */
export async function loadVideoWatchProgress(
  mediaId: string,
  episodeId?: string,
  explicitUid?: string
): Promise<VideoWatchProgressDoc | null> {
  const userId = getActiveWatchUserId(explicitUid);
  const videoId = normalizeVideoId(mediaId, episodeId);
  const cacheKey = `${userId}_${videoId}`;

  // 1. Read from memory cache or LocalStorage
  let localDoc: VideoWatchProgressDoc | null = localProgressCache.get(cacheKey) || null;
  if (!localDoc && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`farukat_watch_prog_${userId}_${videoId}`);
      if (raw) {
        localDoc = JSON.parse(raw) as VideoWatchProgressDoc;
        localProgressCache.set(cacheKey, localDoc);
      }
    } catch (e) {
      console.warn('Error reading local watch progress:', e);
    }
  }

  // If user is guest or quota exceeded or offline, return local version immediately
  if (!userId || userId === 'guest' || isQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return localDoc;
  }

  // 2. Fetch single document from Firestore: users/{userId}/watchProgress/{videoId}
  try {
    const docRef = doc(db, 'users', userId, 'watchProgress', videoId);
    const docSnap = await withFirestoreTimeout(getDoc(docRef), 1800);

    if (docSnap.exists()) {
      const cloudDoc = docSnap.data() as VideoWatchProgressDoc;

      // Conflict resolution: pick the newer one
      if (!localDoc || cloudDoc.lastWatchedAt > localDoc.lastWatchedAt) {
        localDoc = cloudDoc;
        localProgressCache.set(cacheKey, cloudDoc);
        lastSyncedDocCache.set(cacheKey, cloudDoc);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`farukat_watch_prog_${userId}_${videoId}`, JSON.stringify(cloudDoc));
          } catch {}
        }
      }
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      markQuotaExceeded(err);
    }
    // Fail silently to localDoc
  }

  return localDoc;
}

/**
 * Save watch progress locally immediately.
 * This runs continuously on time updates without incurring network cost.
 */
export function saveVideoProgressLocally(
  docData: VideoWatchProgressDoc,
  explicitUid?: string
): void {
  const userId = getActiveWatchUserId(explicitUid);
  const videoId = docData.videoId;
  const cacheKey = `${userId}_${videoId}`;

  localProgressCache.set(cacheKey, docData);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`farukat_watch_prog_${userId}_${videoId}`, JSON.stringify(docData));

      // Also update the general history list for ContinueWatchingRow
      const historyKey = `farukat_history_${userId}`;
      const rawHistory = localStorage.getItem(historyKey);
      let historyList: WatchProgress[] = rawHistory ? JSON.parse(rawHistory) : [];

      // Map to WatchProgress interface
      const historyItem: WatchProgress = {
        mediaId: docData.mediaId || docData.videoId,
        episodeId: docData.episodeId,
        currentTime: docData.currentPositionSeconds,
        duration: docData.videoDurationSeconds,
        lastWatchedAt: docData.lastWatchedAt,
        completed: docData.completed,
        mediaTitle: docData.mediaTitle || 'Cinema Title',
        mediaThumbnail: docData.mediaThumbnail || '',
        episodeTitle: docData.episodeTitle,
      };

      // Filter out existing item for this media/episode and prepend
      historyList = historyList.filter(
        (h) => !(h.mediaId === historyItem.mediaId && (!docData.episodeId || h.episodeId === docData.episodeId))
      );
      historyList.unshift(historyItem);
      // Keep recent 30 items
      historyList = historyList.slice(0, 30);

      localStorage.setItem(historyKey, JSON.stringify(historyList));
      window.dispatchEvent(new CustomEvent('farukat_history_updated', { detail: historyList }));
    } catch (e) {
      console.warn('Error saving local watch progress:', e);
    }
  }
}

/**
 * Determine if Firestore write should be skipped due to negligible change.
 */
function shouldSkipFirestoreSync(cacheKey: string, currentDoc: VideoWatchProgressDoc): boolean {
  const lastSynced = lastSyncedDocCache.get(cacheKey);
  if (!lastSynced) return false;

  const posDiff = Math.abs(currentDoc.currentPositionSeconds - lastSynced.currentPositionSeconds);
  const watchDiff = Math.abs(currentDoc.totalWatchTimeSeconds - lastSynced.totalWatchTimeSeconds);
  const completedChanged = currentDoc.completed !== lastSynced.completed;

  // If completed changed, always sync
  if (completedChanged) return false;

  // If less than 2s position change and less than 5s watch time change, skip
  if (posDiff < 2 && watchDiff < 5) {
    return true;
  }

  return false;
}

/**
 * Flush/Sync watch progress to Firestore immediately.
 * Debounced/throttled to avoid spamming Firestore.
 */
export async function syncVideoProgressToFirestore(
  docData: VideoWatchProgressDoc,
  force = false,
  explicitUid?: string
): Promise<void> {
  const userId = getActiveWatchUserId(explicitUid);
  if (!userId || userId === 'guest') return;

  const videoId = docData.videoId;
  const cacheKey = `${userId}_${videoId}`;
  const now = Date.now();

  // Clear any pending debounced sync
  if (syncTimeoutMap.has(cacheKey)) {
    clearTimeout(syncTimeoutMap.get(cacheKey)!);
    syncTimeoutMap.delete(cacheKey);
  }

  // Throttle check: unless force is true, enforce at least 25 seconds between writes
  const lastSyncTime = lastSyncTimestampMap.get(cacheKey) || 0;
  if (!force && now - lastSyncTime < 25000) {
    // Schedule debounced sync after remaining time
    const waitTime = Math.max(5000, 30000 - (now - lastSyncTime));
    const timer = setTimeout(() => {
      syncVideoProgressToFirestore(docData, true, userId).catch(() => {});
    }, waitTime);
    syncTimeoutMap.set(cacheKey, timer);
    return;
  }

  // Check if changes are negligible
  if (!force && shouldSkipFirestoreSync(cacheKey, docData)) {
    return;
  }

  // If user is offline or quota exceeded, save to offline pending queue
  if (isQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    enqueuePendingSync(userId, docData);
    return;
  }

  // Clean payload matching exact specification
  const payload = {
    videoId: docData.videoId,
    currentPositionSeconds: Number(docData.currentPositionSeconds.toFixed(1)),
    totalWatchTimeSeconds: Math.round(docData.totalWatchTimeSeconds),
    videoDurationSeconds: Number(docData.videoDurationSeconds.toFixed(1)),
    progressPercentage: Number(docData.progressPercentage.toFixed(1)),
    completed: docData.completed,
    lastWatchedAt: docData.lastWatchedAt || Date.now(),
    mediaTitle: docData.mediaTitle,
    mediaThumbnail: docData.mediaThumbnail,
    episodeTitle: docData.episodeTitle,
    episodeId: docData.episodeId,
    mediaId: docData.mediaId,
  };

  try {
    lastSyncTimestampMap.set(cacheKey, now);
    lastSyncedDocCache.set(cacheKey, { ...payload });

    // Sync progress to Turso
    const { syncTursoWatchProgress, claimTursoWatchReward } = await import('./tursoClient');
    await syncTursoWatchProgress(
      payload.mediaId || payload.videoId,
      payload.currentPositionSeconds,
      payload.videoDurationSeconds,
      payload.completed
    );

    // Milestone check: claim rewards if completed or at 15s / 50% milestone
    if (payload.completed) {
      claimTursoWatchReward(payload.mediaId || payload.videoId, 'video_completion').catch(() => {});
    } else if (payload.progressPercentage >= 50) {
      claimTursoWatchReward(payload.mediaId || payload.videoId, 'watch_50_percent').catch(() => {});
    } else if (payload.currentPositionSeconds >= 15) {
      claimTursoWatchReward(payload.mediaId || payload.videoId, 'watch_15s').catch(() => {});
    }
  } catch (err: any) {
    console.warn('[Turso Watch Sync] Sync notice:', err?.message || err);
    enqueuePendingSync(userId, docData);
  }

  try {
    await safeExecuteWrite(
      'WATCH_PROGRESS_SYNC',
      `${userId}_${videoId}`,
      payload,
      () => {
        const docRef = doc(db, 'users', userId, 'watchProgress', videoId);
        return withFirestoreTimeout(setDoc(docRef, payload, { merge: true }), 2500);
      },
      { collectionName: 'watchProgress', documentId: videoId }
    );

    lastSyncedDocCache.set(cacheKey, { ...payload });
    lastSyncTimestampMap.set(cacheKey, now);
  } catch (err: any) {
    if (isQuotaError(err)) {
      markQuotaExceeded(err);
    }
    // Enqueue for background retry on reconnect
    enqueuePendingSync(userId, docData);
  }
}

/**
 * Enqueue failed or offline sync to LocalStorage queue.
 */
function enqueuePendingSync(userId: string, docData: VideoWatchProgressDoc): void {
  if (typeof window === 'undefined') return;
  try {
    const queueKey = getPendingSyncKey(userId);
    const raw = localStorage.getItem(queueKey);
    const queue: Record<string, VideoWatchProgressDoc> = raw ? JSON.parse(raw) : {};
    queue[docData.videoId] = docData;
    localStorage.setItem(queueKey, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to enqueue pending watch progress sync:', e);
  }
}

/**
 * Drain and flush any pending offline syncs when internet connection is restored.
 */
export async function flushPendingWatchProgressSyncs(explicitUid?: string): Promise<void> {
  const userId = getActiveWatchUserId(explicitUid);
  if (!userId || userId === 'guest' || typeof window === 'undefined') return;
  if (isQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  try {
    const queueKey = getPendingSyncKey(userId);
    const raw = localStorage.getItem(queueKey);
    if (!raw) return;

    const queue: Record<string, VideoWatchProgressDoc> = JSON.parse(raw);
    const videoIds = Object.keys(queue);
    if (videoIds.length === 0) return;

    localStorage.removeItem(queueKey);

    for (const vid of videoIds) {
      const item = queue[vid];
      if (item) {
        await syncVideoProgressToFirestore(item, true, userId);
      }
    }
  } catch (e) {
    console.warn('Error flushing pending watch progress syncs:', e);
  }
}

/**
 * Clear in-memory caches and pending sync queue for watch progress.
 */
export function clearWatchProgressCaches(userId?: string): void {
  localProgressCache.clear();
  lastSyncedDocCache.clear();
  lastSyncTimestampMap.clear();
  syncTimeoutMap.forEach((timer) => clearTimeout(timer));
  syncTimeoutMap.clear();

  if (userId && typeof window !== 'undefined') {
    try {
      localStorage.removeItem(getPendingSyncKey(userId));
    } catch {}
  }
}

/**
 * Clear Firestore watch progress records and local caches.
 */
export async function clearFirestoreWatchProgress(explicitUid?: string): Promise<void> {
  const userId = getActiveWatchUserId(explicitUid);
  clearWatchProgressCaches(userId);
}

// Auto-register online listener to flush pending progress when user reconnects
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingWatchProgressSyncs().catch(() => {});
  });
}
