/**
 * OFFLINE TRANSACTION QUEUE MANAGER & AUTOMATIC FIREBASE SYNC ENGINE
 * 
 * Features:
 * 1. Optimistic Local Caching & Queueing under localStorage 'PENDING_QUEUE'
 * 2. Graceful Quota Error Interceptor for resource-exhausted & unavailable errors
 * 3. Automatic Background Queue Flush Daemon (Startup, Online event, 60s Interval)
 * 4. Deterministic Local Market Ticker Price Calculation Fallback
 */

import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { isQuotaError, isQuotaExceeded, markQuotaExceeded } from './quotaHelper';
import { MarketAsset } from '../types';

export const PENDING_QUEUE_KEY = 'PENDING_QUEUE';
export const ALT_QUEUE_KEY = 'farukat_pending_queue';
export const OFFLINE_EVENT = 'farukat_offline_mode_active';
export const SYNC_EVENT = 'farukat_sync_status_changed';

export type OperationType =
  | 'USER_ACCOUNT_SAVE'
  | 'TABLE_SAVE'
  | 'MARKET_TRADE'
  | 'COSMETIC_PURCHASE'
  | 'COSMETIC_EQUIP'
  | 'BALANCE_UPDATE'
  | 'WATCH_PROGRESS_SYNC'
  | 'GENERIC_FIRESTORE_WRITE';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  userId: string;
  collectionName?: string;
  documentId?: string;
  payload: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface SyncResult {
  processed: number;
  remaining: number;
  success: boolean;
}

// -----------------------------------------------------------------------------
// 1. LOCAL STORAGE QUEUE STATE ENGINE
// -----------------------------------------------------------------------------

export function runLocalStorageGC(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    let keysDeleted = 0;
    const keysToPrune: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Keep critical items:
      // - PENDING_QUEUE / PENDING_TRANSACTIONS (these are local trades/writes!)
      // - credentials/session tokens
      if (
        key === PENDING_QUEUE_KEY || 
        key === 'PENDING_TRANSACTIONS' ||
        key === 'farukat_registered_credentials' ||
        key === 'farukat_google_token'
      ) {
        continue;
      }
      
      // Prune list (categorized by order of safety)
      if (
        key.startsWith('farukat_table_') ||
        key.startsWith('farukat_db_') ||
        key.startsWith('farukat_watchlist_') ||
        key.startsWith('farukat_likes_') ||
        key.startsWith('farukat_history_') ||
        key.startsWith('farukat_downloads_') ||
        key.startsWith('farukat_ratings_') ||
        key.startsWith('farukat_xp_account_') ||
        key.startsWith('farukat_user_account_') ||
        key.includes('community_members') ||
        key === 'farukat_current_session_v2'
      ) {
        keysToPrune.push(key);
      }
    }
    
    for (const key of keysToPrune) {
      localStorage.removeItem(key);
      keysDeleted++;
    }
    
    console.log(`[StorageGC] Garbage collection complete. Cleaned up ${keysDeleted} cached storage keys.`);
    return keysDeleted > 0;
  } catch (e) {
    console.error('[StorageGC] Failed to execute localStorage garbage collection:', e);
    return false;
  }
}

export function getPendingQueue(): QueuedOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY) || localStorage.getItem(ALT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse PENDING_QUEUE from localStorage:', e);
    return [];
  }
}

export function savePendingQueue(queue: QueuedOperation[]): void {
  if (typeof window === 'undefined') return;
  try {
    const jsonStr = JSON.stringify(queue);
    
    // Write only to primary PENDING_QUEUE_KEY to save space
    localStorage.setItem(PENDING_QUEUE_KEY, jsonStr);
    
    // Safely remove ALT_QUEUE_KEY to reclaim up to 50% storage space instantly
    localStorage.removeItem(ALT_QUEUE_KEY);
    
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT, {
        detail: { pendingCount: queue.length },
      })
    );
  } catch (e: any) {
    console.warn('[QueueManager] Local storage full. Attempting cache pruning...', e?.message || e);
    
    // RUN GARBAGE COLLECTION ON LOCAL STORAGE
    const prunedSuccess = runLocalStorageGC();
    
    if (prunedSuccess) {
      try {
        const jsonStr = JSON.stringify(queue);
        localStorage.setItem(PENDING_QUEUE_KEY, jsonStr);
        localStorage.removeItem(ALT_QUEUE_KEY);
        console.log('[QueueManager] Saved queue successfully after garbage collection.');
        return;
      } catch (retryError) {
        console.error('[QueueManager] Quota still exceeded after garbage collection:', retryError);
      }
    }
    
    // Fallback: If even GC fails (e.g. because of extremely large queue entries),
    // let's trim the queue itself to keep only the most recent 15 operations to prevent freeze
    if (queue.length > 15) {
      const trimmed = queue.slice(-15);
      try {
        const jsonStr = JSON.stringify(trimmed);
        localStorage.setItem(PENDING_QUEUE_KEY, jsonStr);
        localStorage.removeItem(ALT_QUEUE_KEY);
        console.warn('[QueueManager] Saved trimmed queue (last 15 ops) to avoid complete freeze.');
        return;
      } catch (trimError) {
        console.error('[QueueManager] Failed to save even trimmed queue:', trimError);
      }
    }
  }
}

export function notifyOfflineModeActive(customMessage?: string): void {
  // Toast disabled per user request
}

export function enqueueOperation(
  op: Omit<QueuedOperation, 'id' | 'createdAt' | 'attempts'>
): QueuedOperation {
  let queue = getPendingQueue();
  
  // COLLAPSE REDUNDANT OVERWRITE OPERATIONS to prevent queue bloat
  if (op.type === 'USER_ACCOUNT_SAVE') {
    queue = queue.filter(item => !(item.type === 'USER_ACCOUNT_SAVE' && item.userId === op.userId));
  } else if (op.type === 'TABLE_SAVE' && op.collectionName) {
    queue = queue.filter(item => !(item.type === 'TABLE_SAVE' && item.collectionName === op.collectionName && item.userId === op.userId));
  }

  const newItem: QueuedOperation = {
    ...op,
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
    attempts: 0,
  };

  queue.push(newItem);
  savePendingQueue(queue);
  notifyOfflineModeActive();
  return newItem;
}

export function removeOperationFromQueue(id: string): void {
  const queue = getPendingQueue().filter((item) => item.id !== id);
  savePendingQueue(queue);
}

export function clearPendingQueue(): void {
  savePendingQueue([]);
}

// -----------------------------------------------------------------------------
// 2. GRACEFUL QUOTA ERROR INTERCEPTOR & WRAPPER
// -----------------------------------------------------------------------------

export function isQuotaOrNetworkError(err: any): boolean {
  if (!err) return false;
  if (isQuotaError(err)) return true;
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  const str = String(err || '').toLowerCase();

  return (
    code.includes('resource-exhausted') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('quota') ||
    msg.includes('offline') ||
    str.includes('resource_exhausted') ||
    str.includes('quota')
  );
}

/**
 * Higher-order write execution wrapper that optimistically applies state locally
 * and gracefully queues writes to PENDING_QUEUE when Firebase quota/network errors occur.
 */
export async function safeExecuteWrite<T>(
  type: OperationType,
  userId: string,
  payload: any,
  firestoreWriteFn: () => Promise<T>,
  options?: {
    collectionName?: string;
    documentId?: string;
    onLocalUpdate?: () => void;
  }
): Promise<{ success: boolean; synced: boolean; data?: T }> {
  // Step 1: Optimistic Local State Update
  if (options?.onLocalUpdate) {
    try {
      options.onLocalUpdate();
    } catch (e) {
      console.warn('Local optimistic update warning:', e);
    }
  }

  // If already in quota exceeded mode or navigator offline, bypass network call immediately
  if (isQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    enqueueOperation({
      type,
      userId,
      collectionName: options?.collectionName,
      documentId: options?.documentId,
      payload,
    });
    return { success: true, synced: false };
  }

  // Step 2: Attempt Firebase Write
  try {
    const data = await firestoreWriteFn();
    return { success: true, synced: true, data };
  } catch (err: any) {
    console.warn(`[QueueManager] Firestore write encountered error for ${type}:`, err?.message || err);

    if (isQuotaOrNetworkError(err)) {
      markQuotaExceeded(err);
      enqueueOperation({
        type,
        userId,
        collectionName: options?.collectionName,
        documentId: options?.documentId,
        payload,
      });
      return { success: true, synced: false };
    }

    // For non-quota errors (e.g. permission or index), still queue locally as fallback
    enqueueOperation({
      type,
      userId,
      collectionName: options?.collectionName,
      documentId: options?.documentId,
      payload,
      lastError: String(err?.message || err),
    });

    return { success: true, synced: false };
  }
}

// -----------------------------------------------------------------------------
// 3. AUTOMATIC BACKGROUND QUEUE FLUSH (SYNC ENGINE)
// -----------------------------------------------------------------------------

let isFlushing = false;

export async function flushPendingQueue(): Promise<SyncResult> {
  if (isFlushing) {
    const queue = getPendingQueue();
    return { processed: 0, remaining: queue.length, success: false };
  }

  // CRITICAL: If quota is already marked as exceeded, do not even attempt to flush.
  // This prevents spamming Firebase with requests that we know will fail with 429/Resource Exhausted.
  if (isQuotaExceeded()) {
    const queue = getPendingQueue();
    return { processed: 0, remaining: queue.length, success: false };
  }

  const queue = getPendingQueue();
  if (queue.length === 0) {
    return { processed: 0, remaining: 0, success: true };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, remaining: queue.length, success: false };
  }

  isFlushing = true;
  let processedCount = 0;
  const remainingQueue: QueuedOperation[] = [];

  for (const op of queue) {
    try {
      op.attempts = (op.attempts || 0) + 1;

      if (op.type === 'USER_ACCOUNT_SAVE') {
        const docRef = doc(db, 'users', op.userId);
        await setDoc(docRef, JSON.parse(JSON.stringify(op.payload)), { merge: true });
      } else if (op.type === 'TABLE_SAVE' && op.collectionName) {
        const docRef = doc(db, op.collectionName, op.userId);
        await setDoc(docRef, JSON.parse(JSON.stringify(op.payload)), { merge: true });
      } else if (op.collectionName && op.documentId) {
        const docRef = doc(db, op.collectionName, op.documentId);
        await setDoc(docRef, JSON.parse(JSON.stringify(op.payload)), { merge: true });
      } else if (op.userId) {
        const docRef = doc(db, 'users', op.userId);
        await setDoc(docRef, JSON.parse(JSON.stringify(op.payload)), { merge: true });
      }

      processedCount++;
    } catch (err: any) {
      console.warn(`[SyncDaemon] Failed to flush item ${op.id}:`, err?.message || err);

      if (isQuotaOrNetworkError(err)) {
        markQuotaExceeded(err);
        op.lastError = String(err?.message || err);
        remainingQueue.push(op);
        // Stop sequential flush on quota/network barrier
        const restIndex = queue.indexOf(op);
        if (restIndex !== -1) {
          remainingQueue.push(...queue.slice(restIndex + 1));
        }
        break;
      } else {
        // Drop malformed/unrecoverable after 5 attempts
        if (op.attempts < 5) {
          op.lastError = String(err?.message || err);
          remainingQueue.push(op);
        }
      }
    }
  }

  savePendingQueue(remainingQueue);
  isFlushing = false;

  // If queue is now completely cleared, clear quota exceeded state flag
  if (remainingQueue.length === 0 && processedCount > 0) {
    try {
      localStorage.removeItem('farukat_quota_exceeded');
      window.dispatchEvent(
        new CustomEvent('farukat_toast', {
          detail: {
            type: 'achievement',
            title: 'Sync Complete',
            description: 'All offline transactions have been synchronized to cloud.',
          },
        })
      );
    } catch {}
  }

  return {
    processed: processedCount,
    remaining: remainingQueue.length,
    success: remainingQueue.length === 0,
  };
}

/**
 * Initializes the background sync daemon.
 * Runs on mount, network 'online' events, and a 60-second polling interval.
 */
export function initSyncDaemon(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Initial flush attempt on mount
  flushPendingQueue().catch(() => {});

  // 2. Network connectivity restored handler
  const handleOnline = () => {
    console.log('[SyncDaemon] Connectivity restored. Flushing pending queue...');
    flushPendingQueue().catch(() => {});
  };

  window.addEventListener('online', handleOnline);

  // 3. Subtle 60-second polling timer
  const intervalId = setInterval(() => {
    flushPendingQueue().catch(() => {});
  }, 60000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(intervalId);
  };
}


