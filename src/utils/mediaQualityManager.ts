/**
 * Media Quality Manager & Source Capability Layer
 * Provides real media capability detection, network/buffering state monitoring,
 * and adaptive/manual quality control for YouTube, Dropbox, and HTML5 video streams.
 */

export type VideoProviderType = 'youtube' | 'dropbox' | 'direct';

export interface QualityOption {
  id: string; // 'auto' | '2160p' | '1440p' | '1080p' | '720p' | '480p' | '360p'
  label: string; // 'Auto' | '2160p / 4K' | '1080p' | etc.
  subtitle?: string;
  height?: number; // 2160, 1080, 720, 480, 360
  ytCode?: string; // 'hd2160', 'hd1080', 'hd720', 'large', 'medium', 'small', 'auto'
}

export interface VideoSourceCapability {
  provider: VideoProviderType;
  rawUrl: string;
  normalizedUrl: string;
  maxResolution: string; // '1080p', '720p', '480p', etc.
  maxHeight: number; // 1080, 720, 480, etc.
  availableQualities: QualityOption[];
  adaptiveSupported: boolean;
  manualQualitySupported: boolean;
  providerNote?: string;
}

export interface NetworkPlaybackStats {
  connectionType?: string;
  stalledCount: number;
  bufferSeconds: number;
  networkQuality: 'excellent' | 'good' | 'constrained';
  autoAdaptedQuality?: string;
}

/**
 * Maps height in pixels to standard video quality label
 */
export function getHeightQualityLabel(height: number): string {
  if (height >= 2160) return '2160p / 4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return '240p';
}

/**
 * Maps YouTube API quality codes to standardized pixel heights and labels
 */
export function mapYouTubeQualityCode(ytCode: string): QualityOption | null {
  const code = ytCode.toLowerCase();
  switch (code) {
    case 'hd2160':
    case 'highres':
      return { id: '2160p', label: '2160p / 4K', height: 2160, ytCode };
    case 'hd1440':
      return { id: '1440p', label: '1440p', height: 1440, ytCode };
    case 'hd1080':
      return { id: '1080p', label: '1080p', height: 1080, ytCode };
    case 'hd720':
    case '720p':
      return { id: '720p', label: '720p', height: 720, ytCode };
    case 'large':
    case '480p':
      return { id: '480p', label: '480p', height: 480, ytCode };
    case 'medium':
    case '360p':
      return { id: '360p', label: '360p', height: 360, ytCode };
    case 'small':
    case '240p':
      return { id: '240p', label: '240p', height: 240, ytCode };
    case 'tiny':
    case '144p':
      return { id: '144p', label: '144p', height: 144, ytCode };
    default:
      return null;
  }
}

/**
 * Standard resolution tiers to filter available options
 */
const ALL_RESOLUTIONS: QualityOption[] = [
  { id: '2160p', label: '2160p / 4K', height: 2160 },
  { id: '1440p', label: '1440p', height: 1440 },
  { id: '1080p', label: '1080p', height: 1080 },
  { id: '720p', label: '720p', height: 720 },
  { id: '480p', label: '480p', height: 480 },
  { id: '360p', label: '360p', height: 360 },
];

/**
 * Detects the media capability for a given video URL and optional metadata quality hint
 */
export function detectVideoCapability(
  rawUrl: string,
  catalogQualityHint?: string, // e.g., '1080p', '4K', '720p'
  detectedVideoHeight?: number // Actual HTML5 video element intrinsic height
): VideoSourceCapability {
  const url = rawUrl ? rawUrl.trim() : '';
  const isYoutube = Boolean(url && (url.includes('youtube.com') || url.includes('youtu.be')));
  const isDropbox = Boolean(url && (url.includes('dropbox.com') || url.includes('dropboxusercontent.com')));

  let provider: VideoProviderType = 'direct';
  if (isYoutube) provider = 'youtube';
  else if (isDropbox) provider = 'dropbox';

  // Determine actual maximum height
  let maxHeight = 1080; // Default fallback ceiling
  if (detectedVideoHeight && detectedVideoHeight > 0) {
    maxHeight = detectedVideoHeight;
  } else if (catalogQualityHint) {
    const hint = catalogQualityHint.toLowerCase();
    if (hint.includes('4k') || hint.includes('2160')) maxHeight = 2160;
    else if (hint.includes('1440')) maxHeight = 1440;
    else if (hint.includes('1080') || hint.includes('fhd')) maxHeight = 1080;
    else if (hint.includes('720') || hint.includes('hd')) maxHeight = 720;
    else if (hint.includes('480')) maxHeight = 480;
    else if (hint.includes('360')) maxHeight = 360;
  }

  const maxResLabel = getHeightQualityLabel(maxHeight);

  if (provider === 'youtube') {
    return {
      provider: 'youtube',
      rawUrl: url,
      normalizedUrl: url,
      maxResolution: maxResLabel,
      maxHeight,
      availableQualities: [
        { id: 'auto', label: 'Auto', subtitle: 'YouTube adaptive quality' }
      ],
      adaptiveSupported: true,
      manualQualitySupported: false, // Updated dynamically if YT iframe API exposes levels
      providerNote: 'Quality controlled by YouTube',
    };
  }

  if (provider === 'dropbox') {
    // Filter available resolution options strictly at or below actual max height
    const validQualities = ALL_RESOLUTIONS.filter((q) => (q.height || 0) <= maxHeight);

    return {
      provider: 'dropbox',
      rawUrl: url,
      normalizedUrl: url,
      maxResolution: maxResLabel,
      maxHeight,
      availableQualities: [
        { id: 'auto', label: 'Auto', subtitle: `Best available (${maxResLabel})` },
        ...validQualities
      ],
      adaptiveSupported: true,
      manualQualitySupported: true,
      providerNote: `Dropbox HTML5 source (${maxResLabel})`,
    };
  }

  // Direct HTML5 video source
  const validQualities = ALL_RESOLUTIONS.filter((q) => (q.height || 0) <= maxHeight);

  return {
    provider: 'direct',
    rawUrl: url,
    normalizedUrl: url,
    maxResolution: maxResLabel,
    maxHeight,
    availableQualities: [
      { id: 'auto', label: 'Auto', subtitle: `Best available (${maxResLabel})` },
      ...validQualities
    ],
    adaptiveSupported: true,
    manualQualitySupported: true,
    providerNote: `HTML5 Direct stream (${maxResLabel})`,
  };
}
