import { useState, useEffect } from 'react';
import { formatTime } from './mediaUtils';

const DURATION_STORAGE_KEY = 'farukat_verified_durations_v2';

// In-memory cache for ultra-fast zero-latency reads across all render cycles
let memoryCache: Record<string, string> = {};

export const PRESET_OVERRIDE_DURATIONS: Record<string, string> = {
  'dardi-ladi-familja': '34:34',
  'dardi-ladi-ep-1': '34:34',
};

function initDurationCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(DURATION_STORAGE_KEY);
    if (raw) {
      memoryCache = { ...JSON.parse(raw) };
      // Purge any stale guessed durations
      if (memoryCache['the-end-part-1'] === '56:06') delete memoryCache['the-end-part-1'];
      if (memoryCache['the-end-part-2'] === '1:01:58') delete memoryCache['the-end-part-2'];
      if (memoryCache['the-end-part-3'] === '29:45') delete memoryCache['the-end-part-3'];
    }
  } catch {
    memoryCache = {};
  }
  // Ensure preset overrides are applied to memory cache
  Object.assign(memoryCache, PRESET_OVERRIDE_DURATIONS);
}

if (typeof window !== 'undefined') {
  initDurationCache();
}

/**
 * Returns the verified real duration for a media or episode ID,
 * falling back to the catalog duration if not yet verified.
 */
export function getVerifiedDuration(id?: string, fallback?: string): string {
  if (!id) return fallback || '';
  if (PRESET_OVERRIDE_DURATIONS[id]) {
    return PRESET_OVERRIDE_DURATIONS[id];
  }
  if (memoryCache[id]) {
    return memoryCache[id];
  }
  return fallback || '';
}

/**
 * Saves a verified real duration (from video element or player) to persistent storage
 * and broadcasts an event so all thumbnail badges immediately update in real time.
 */
export function saveVerifiedDuration(id: string, durationSecondsOrString: number | string): void {
  if (!id) return;
  let formatted = '';

  if (typeof durationSecondsOrString === 'number') {
    if (isNaN(durationSecondsOrString) || durationSecondsOrString <= 0) return;
    formatted = formatTime(durationSecondsOrString);
  } else if (typeof durationSecondsOrString === 'string') {
    const trimmed = durationSecondsOrString.trim();
    if (!trimmed || trimmed === '0:00') return;
    formatted = trimmed;
  }

  if (formatted && memoryCache[id] !== formatted) {
    memoryCache[id] = formatted;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DURATION_STORAGE_KEY, JSON.stringify(memoryCache));
        window.dispatchEvent(
          new CustomEvent('farukat_duration_verified', {
            detail: { id, duration: formatted }
          })
        );
      }
    } catch {}
  }
}

/**
 * React hook that returns the active real-time duration and listens
 * for runtime metadata verification changes.
 */
export function useVerifiedDuration(id?: string, fallback?: string): string {
  const [duration, setDuration] = useState<string>(() => getVerifiedDuration(id, fallback));

  useEffect(() => {
    setDuration(getVerifiedDuration(id, fallback));

    if (!id || typeof window === 'undefined') return;

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; duration: string }>;
      if (customEvent.detail && customEvent.detail.id === id) {
        setDuration(customEvent.detail.duration);
      }
    };

    window.addEventListener('farukat_duration_verified', handleUpdate);
    return () => window.removeEventListener('farukat_duration_verified', handleUpdate);
  }, [id, fallback]);

  return duration;
}

/**
 * Parses any duration representation into total seconds.
 */
export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 0;
  const cleaned = durationStr.trim();

  // ISO 8601 Duration (e.g. PT2H23M45S)
  if (cleaned.startsWith('P') || cleaned.startsWith('p')) {
    const regex = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/i;
    const matches = cleaned.match(regex);
    if (matches) {
      const d = parseInt(matches[1] || '0', 10);
      const h = parseInt(matches[2] || '0', 10);
      const m = parseInt(matches[3] || '0', 10);
      const s = parseFloat(matches[4] || '0');
      return d * 86400 + h * 3600 + m * 60 + Math.round(s);
    }
  }

  // Time format (HH:MM:SS or MM:SS)
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  // Textual format (e.g. "1h 45m", "45 min", "10H 44min")
  let total = 0;
  const hMatch = cleaned.match(/(\d+)\s*h(?:our|ours|r)?/i);
  const mMatch = cleaned.match(/(\d+)\s*m(?:in|inute|inutes)?/i);
  const sMatch = cleaned.match(/(\d+)\s*s(?:ec|econd|econds)?/i);

  if (hMatch) total += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) total += parseInt(mMatch[1], 10) * 60;
  if (sMatch) total += parseInt(sMatch[1], 10);

  if (total > 0) return total;

  const rawNum = parseInt(cleaned, 10);
  if (!isNaN(rawNum)) return rawNum * 60;

  return 0;
}
