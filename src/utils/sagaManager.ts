import { MediaItem } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';
import { recordCompletedWatch } from './xpSystem';
import { getVerifiedDuration, parseDurationToSeconds } from './durationStore';

const COMPLETIONS_KEY = 'farukat_saga_completions_v1';
const PROGRESS_KEY = 'farukat_saga_progress_v1';
const COMPLETED_SAGAS_KEY = 'farukat_saga_completed_sagas_v1';

export interface SagaCompletionResult {
  completed: boolean;
  completions: string[];
  allCompleted: boolean;
}

export const KNOWN_SAGA_IDS = ['scifi-saga', 'dardi-ladi', 'deleted-scenes'];

/**
 * Calculates the full total duration of a list of media items.
 */
export function calculateSagaTotalDuration(items: MediaItem[]): string {
  let totalSeconds = 0;
  items.forEach((item) => {
    const verifiedDur = getVerifiedDuration(item.id, item.duration);
    const secs = parseDurationToSeconds(verifiedDur);
    totalSeconds += secs;
  });

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Returns all media items that belong to a specific saga.
 */
export function getSagaItemsForUniverse(sagaId: string, catalog: MediaItem[] = MEDIA_CATALOG): MediaItem[] {
  const visible = catalog.filter((m) => !m.isHidden);

  switch (sagaId) {
    case 'dardi-ladi':
      return visible.filter(
        (m) =>
          m.id !== 'dardi-ladi-1' &&
          (m.sagaId === 'dardi-ladi' ||
          m.originalSection === 'banesa' ||
          m.originalSection === 'dardi-ladi' ||
          m.id === 'detektivi-misioni-sekret' ||
          m.id === 'banesa-1')
      );
    case 'scifi-saga':
      return visible.filter(
        (m) =>
          m.id !== 'dardi-the-end-of-year' &&
          (m.sagaId === 'scifi-saga' ||
           m.originalSection === 'the-end-saga' ||
           m.id.startsWith('the-end-') ||
           m.id.includes('the-end'))
      );
    case 'deleted-scenes':
      return visible.filter(
        (m) =>
          m.sagaId === 'deleted-scenes' ||
          m.originalSection === 'deleted-scenes' ||
          m.id.startsWith('deleted-scene-') ||
          m.category === 'deleted'
      );
    default:
      return visible.filter((m) => m.sagaId === sagaId || m.originalSection === sagaId);
  }
}

/**
 * Checks if a media item belongs to any saga.
 */
export function isItemInAnySaga(item: MediaItem, catalog: MediaItem[] = MEDIA_CATALOG): boolean {
  if (!item) return false;
  if (item.sagaId) return true;
  for (const sId of KNOWN_SAGA_IDS) {
    const items = getSagaItemsForUniverse(sId, catalog);
    if (items.some((m) => m.id === item.id)) return true;
  }
  return false;
}

/**
 * Returns only media items that are NOT part of any saga.
 * Saga videos are kept exclusively within their designated saga.
 */
export function getNonSagaCatalog(catalog: MediaItem[] = MEDIA_CATALOG): MediaItem[] {
  return catalog.filter((m) => !isItemInAnySaga(m, catalog));
}

/**
 * Detect which saga an item belongs to, if any.
 */
export function findSagaIdForMedia(mediaId: string, catalog: MediaItem[] = MEDIA_CATALOG): string | null {
  for (const sagaId of KNOWN_SAGA_IDS) {
    const items = getSagaItemsForUniverse(sagaId, catalog);
    if (items.some((item) => item.id === mediaId)) {
      return sagaId;
    }
  }
  return null;
}

/**
 * Retrieve the completed media IDs for a given saga.
 */
export function getSagaCompletions(sagaId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPLETIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed[sagaId]) ? parsed[sagaId] : [];
  } catch {
    return [];
  }
}

/**
 * Mark a media item as completed in a saga.
 */
export function markSagaMediaCompleted(
  mediaId: string,
  sagaId?: string,
  mediaTitle?: string,
  catalog: MediaItem[] = MEDIA_CATALOG
): SagaCompletionResult {
  if (typeof window === 'undefined') {
    return { completed: true, completions: [], allCompleted: false };
  }

  const resolvedSagaId = sagaId || findSagaIdForMedia(mediaId, catalog);
  if (!resolvedSagaId) {
    return { completed: true, completions: [], allCompleted: false };
  }

  try {
    const raw = localStorage.getItem(COMPLETIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const existing: string[] = Array.isArray(parsed[resolvedSagaId]) ? parsed[resolvedSagaId] : [];

    let updated = existing;
    if (!existing.includes(mediaId)) {
      updated = [...existing, mediaId];
      parsed[resolvedSagaId] = updated;
      localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(parsed));
    }

    // Check if entire saga is finished
    const allItems = getSagaItemsForUniverse(resolvedSagaId, catalog);
    const allCompleted = allItems.length > 0 && allItems.every((item) => updated.includes(item.id));
    if (allCompleted) {
      const rawSagas = localStorage.getItem(COMPLETED_SAGAS_KEY);
      const parsedSagas = rawSagas ? JSON.parse(rawSagas) : {};
      parsedSagas[resolvedSagaId] = true;
      localStorage.setItem(COMPLETED_SAGAS_KEY, JSON.stringify(parsedSagas));
    }

    // Award XP / watch count
    if (mediaTitle) {
      try {
        recordCompletedWatch(mediaId, mediaTitle);
      } catch (e) {
        console.warn('Could not record watch XP:', e);
      }
    }

    // Broadcast change to window
    window.dispatchEvent(
      new CustomEvent('saga_completion_updated', {
        detail: { sagaId: resolvedSagaId, mediaId, completed: true, completions: updated },
      })
    );

    return { completed: true, completions: updated, allCompleted };
  } catch (e) {
    console.warn('Failed to mark saga media completed:', e);
    return { completed: false, completions: [], allCompleted: false };
  }
}

/**
 * Toggle completion of a saga media item.
 */
export function toggleSagaMediaCompletion(
  mediaId: string,
  sagaId: string,
  mediaTitle?: string,
  catalog: MediaItem[] = MEDIA_CATALOG
): SagaCompletionResult {
  if (typeof window === 'undefined') {
    return { completed: false, completions: [], allCompleted: false };
  }

  try {
    const raw = localStorage.getItem(COMPLETIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const existing: string[] = Array.isArray(parsed[sagaId]) ? parsed[sagaId] : [];

    const isAlready = existing.includes(mediaId);
    let updated: string[];

    if (isAlready) {
      updated = existing.filter((id) => id !== mediaId);
    } else {
      updated = [...existing, mediaId];
      if (mediaTitle) {
        try {
          recordCompletedWatch(mediaId, mediaTitle);
        } catch (e) {
          console.warn('Could not record watch XP:', e);
        }
      }
    }

    parsed[sagaId] = updated;
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(parsed));

    const allItems = getSagaItemsForUniverse(sagaId, catalog);
    const allCompleted = allItems.length > 0 && allItems.every((item) => updated.includes(item.id));

    window.dispatchEvent(
      new CustomEvent('saga_completion_updated', {
        detail: { sagaId, mediaId, completed: !isAlready, completions: updated },
      })
    );

    return { completed: !isAlready, completions: updated, allCompleted };
  } catch (e) {
    console.warn('Failed to toggle saga completion:', e);
    return { completed: false, completions: [], allCompleted: false };
  }
}

/**
 * Check if a saga is fully completed.
 */
export function isSagaCompleted(sagaId: string, catalog: MediaItem[] = MEDIA_CATALOG): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawSagas = localStorage.getItem(COMPLETED_SAGAS_KEY);
    if (rawSagas) {
      const parsedSagas = JSON.parse(rawSagas);
      if (parsedSagas[sagaId]) return true;
    }
    const completedItems = getSagaCompletions(sagaId);
    const allItems = getSagaItemsForUniverse(sagaId, catalog);
    if (allItems.length > 0 && completedItems.length >= allItems.length) {
      return true;
    }
    if (sagaId === 'dardi-ladi' && completedItems.length >= 22) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

