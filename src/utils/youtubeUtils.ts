import { useState, useEffect } from 'react';

const titleCache: Record<string, string> = {};

/**
 * Extracts a YouTube video ID from any YouTube URL (watch, embed, short, youtu.be)
 * or thumbnail URL (img.youtube.com, i.ytimg.com).
 */
export function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match1 = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (match1 && match1[1]) return match1[1];
  const match2 = url.match(/(?:img\.youtube\.com|i\.ytimg\.com)\/vi(?:_webp)?\/([\w-]{11})/i);
  if (match2 && match2[1]) return match2[1];
  return null;
}

/**
 * Returns a 16:9 high-definition YouTube thumbnail URL for any video item or URL.
 */
export function getYouTubeThumbnail16x9(
  itemOrUrl?: { videoUrl?: string; thumbnail?: string; poster?: string; backdrop?: string; posterImageUrl?: string; backdropImageUrl?: string } | string
): string {
  if (!itemOrUrl) return '';
  if (typeof itemOrUrl === 'string') {
    const id = extractYouTubeId(itemOrUrl);
    if (id) return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    return itemOrUrl;
  }
  const id =
    extractYouTubeId(itemOrUrl.videoUrl) ||
    extractYouTubeId(itemOrUrl.thumbnail) ||
    extractYouTubeId(itemOrUrl.poster) ||
    extractYouTubeId(itemOrUrl.backdrop) ||
    extractYouTubeId(itemOrUrl.posterImageUrl) ||
    extractYouTubeId(itemOrUrl.backdropImageUrl);
  if (id) {
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  }
  return itemOrUrl.thumbnail || itemOrUrl.poster || itemOrUrl.backdrop || '';
}

export function useYouTubeTitle(url: string | undefined): string | null {
  const [title, setTitle] = useState<string | null>(() => {
    if (url && titleCache[url]) return titleCache[url];
    return null;
  });

  useEffect(() => {
    if (!url) return;
    
    if (titleCache[url]) {
      setTitle(titleCache[url]);
      return;
    }

    let isMounted = true;
    const fetchTitle = async () => {
      try {
        const response = await fetch(`/api/youtube-title?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        if (data?.title) {
          titleCache[url] = data.title;
          if (isMounted) setTitle(data.title);
        }
      } catch {
        // Silent fallback without spamming console
        titleCache[url] = 'FPX Cinema';
        if (isMounted) setTitle('FPX Cinema');
      }
    };

    fetchTitle();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return title;
}

