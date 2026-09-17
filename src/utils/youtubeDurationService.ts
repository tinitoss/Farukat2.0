import { saveVerifiedDuration, getVerifiedDuration, parseDurationToSeconds } from './durationStore';
import { MediaItem } from '../types';

/**
 * Extracts a valid 11-character YouTube video ID from a URL or raw ID.
 */
export function extractYouTubeVideoId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If already an 11-character alphanumeric YouTube ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle various YouTube URL formats
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (match && match[1]) return match[1];

  const imgMatch = trimmed.match(/\/vi\/([\w-]{11})\//);
  if (imgMatch && imgMatch[1]) return imgMatch[1];

  return null;
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT5M14S", "PT1H2M3S", "PT45S")
 * into minutes:seconds (or hours:minutes:seconds) and total seconds.
 */
export function parseISO8601Duration(iso?: string): { formatted: string; totalSeconds: number } {
  if (!iso) return { formatted: '0:00', totalSeconds: 0 };
  const cleaned = iso.trim();

  const match = cleaned.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) {
    // Fallback if not standard ISO
    const secs = parseDurationToSeconds(cleaned);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return { formatted: `${m}:${String(s).padStart(2, '0')}`, totalSeconds: secs };
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  return { formatted, totalSeconds };
}

// In-flight request cache to avoid duplicate API requests
const pendingRequests = new Map<string, Promise<{ formatted: string; totalSeconds: number; isoDuration?: string } | null>>();

/**
 * Fetches the real duration of a YouTube video directly from the backend YouTube API proxy.
 */
export async function fetchYouTubeVideoDuration(
  videoIdOrUrl: string
): Promise<{ formatted: string; totalSeconds: number; isoDuration?: string } | null> {
  const videoId = extractYouTubeVideoId(videoIdOrUrl);
  if (!videoId) return null;

  if (pendingRequests.has(videoId)) {
    return pendingRequests.get(videoId)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`/api/youtube-duration?id=${encodeURIComponent(videoId)}`);
      if (!res.ok) return null;

      const data = await res.json();
      if (data && data.success && data.duration) {
        return {
          formatted: data.duration,
          totalSeconds: data.totalSeconds || parseDurationToSeconds(data.duration),
          isoDuration: data.isoDuration,
        };
      }
      return null;
    } catch (err) {
      console.warn('[YouTube Duration Service] Failed to fetch duration for', videoId, err);
      return null;
    } finally {
      pendingRequests.delete(videoId);
    }
  })();

  pendingRequests.set(videoId, promise);
  return promise;
}

/**
 * Synchronizes an individual media item's duration from YouTube if it has a YouTube video URL.
 * Automatically saves the verified duration in the duration store and triggers UI re-renders.
 */
export async function syncItemYouTubeDuration(item: {
  id: string;
  videoUrl?: string;
  duration?: string;
}): Promise<string> {
  if (!item.videoUrl) {
    return getVerifiedDuration(item.id, item.duration);
  }

  const videoId = extractYouTubeVideoId(item.videoUrl);
  if (!videoId) {
    return getVerifiedDuration(item.id, item.duration);
  }

  const result = await fetchYouTubeVideoDuration(videoId);
  if (result && result.formatted) {
    saveVerifiedDuration(item.id, result.formatted);
    return result.formatted;
  }

  return getVerifiedDuration(item.id, item.duration);
}

/**
 * Batch fetches and verifies the real YouTube durations for all items in a saga,
 * updating the verified duration store for each and returning the exact total duration.
 */
export async function batchFetchSagaYouTubeDurations(items: MediaItem[]): Promise<{
  totalFormatted: string;
  totalSeconds: number;
  itemDurations: Record<string, string>;
}> {
  const itemDurations: Record<string, string> = {};

  // Fetch all in parallel
  await Promise.all(
    items.map(async (item) => {
      const dur = await syncItemYouTubeDuration(item);
      itemDurations[item.id] = dur;
    })
  );

  let totalSeconds = 0;
  items.forEach((item) => {
    const verified = itemDurations[item.id] || getVerifiedDuration(item.id, item.duration);
    totalSeconds += parseDurationToSeconds(verified);
  });

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let totalFormatted = '';
  if (hours > 0) {
    totalFormatted = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    totalFormatted = `${minutes}m`;
  }

  return {
    totalFormatted,
    totalSeconds,
    itemDurations,
  };
}
