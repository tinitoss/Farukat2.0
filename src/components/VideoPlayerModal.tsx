import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sparkles,
  Zap,
  Moon,
  Sun,
  Shield,
  ThumbsUp,
  Bookmark,
  BookmarkCheck,
  Share2,
  Download,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Tv,
  Eye,
  Send,
  Heart,
  CornerDownRight,
  Reply,
  Trash2,
  SlidersHorizontal,
  CheckCircle2,
  Flame,
  ArrowLeft,
  Star,
  Users,
  AlertCircle,
  RefreshCw,
  Settings,
  Gauge,
  Wifi,
} from 'lucide-react';
import { WatchTogetherInviteModal } from './WatchTogetherInviteModal';
import { CinematicPlayerLoader } from './CinematicPlayerLoader';
import { QualityMenuModal } from './QualityMenuModal';
import {
  detectVideoCapability,
  mapYouTubeQualityCode,
  getHeightQualityLabel,
  QualityOption,
  VideoSourceCapability,
} from '../utils/mediaQualityManager';
import { MediaItem, Episode, XpAccount, CommentItem, ActiveTab, WatchProgress } from '../types';
import { getVerifiedDuration, saveVerifiedDuration, parseDurationToSeconds } from '../utils/durationStore';
import {
  normalizeVideoUrl,
  formatTime,
  saveWatchProgress,
  DEMO_TRAILER_URLS,
  getWatchHistory,
} from '../utils/mediaUtils';
import {
  loadVideoWatchProgress,
  getLocalVideoWatchProgress,
  saveVideoProgressLocally,
  syncVideoProgressToFirestore,
  normalizeVideoId,
  VideoWatchProgressDoc,
} from '../utils/watchProgressManager';
import {
  recordWatchTimeSeconds,
  recordCompletedWatch,
  calculateLevelInfo,
  getXpAccount,
  saveXpAccount,
  awardXp,
} from '../utils/xpSystem';
import { markSagaMediaCompleted, isItemInAnySaga } from '../utils/sagaManager';
import {
  getCommentsForMedia,
  addMediaComment,
  toggleCommentLike,
  followMember,
  isFollowing,
  getCommunityMembers,
} from '../utils/memberSystem';
import {
  fetchLikesForContent,
  toggleLikeInDb,
  fetchCommentsForContent,
  addCommentToDb,
  deleteCommentFromDb,
  toggleCommentLikeInDb,
  SheetDbComment,
} from '../utils/sheetdbSocial';
import { MEDIA_CATALOG } from '../data/mediaData';
import { BottomNav } from './BottomNav';
import { auth } from '../firebase';
import { RenderUserIdentity } from './UserIdentityRenderer';
import { useYouTubeTitle, extractYouTubeId } from '../utils/youtubeUtils';
import { RewardService } from "../utils/rewardService";

interface VideoPlayerModalProps {
  item: MediaItem;
  episode?: Episode;
  onClose: () => void;
  onSelectEpisode?: (item: MediaItem, episode: Episode) => void;
  onPlayMedia?: (item: MediaItem, episode?: Episode) => void;
  watchlist?: string[];
  onToggleWatchlist?: (id: string) => void;
  likes?: string[];
  onToggleLike?: (id: string) => void;
  downloads?: string[];
  onToggleDownload?: (id: string) => void;
  account?: XpAccount;
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onOpenMembership?: () => void;
  isGuest?: boolean;
  initialTargetCommentId?: string;
  initialIsReplying?: boolean;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  item,
  episode,
  onClose,
  onSelectEpisode,
  onPlayMedia,
  watchlist = [],
  onToggleWatchlist,
  likes = [],
  onToggleLike,
  downloads = [],
  onToggleDownload,
  account,
  activeTab,
  onSelectTab,
  onOpenMembership,
  isGuest,
  initialTargetCommentId,
  initialIsReplying,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);

  // Loading & Description States
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);

  // Active session parameters
  const sessionRaw = localStorage.getItem('farukat_current_session_v2');
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;
  const currentAccount = account || getXpAccount();
  const isWatchPartyHidden = Boolean(
    currentAccount?.stats?.hideWatchParty || currentAccount?.stats?.watchPartyEnabled === false
  );
  const watchPartyEnabled = !isWatchPartyHidden;
  const userId = auth.currentUser?.uid || session?.uid || currentAccount?.profile?.memberId || 'usr_anonymous';
  const username = auth.currentUser?.displayName || session?.displayName || currentAccount?.profile?.name || 'Cinema Member';
  const avatar = auth.currentUser?.photoURL || currentAccount?.profile?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';

  // Target content ID (Movie/item ID or active episode ID)
  const contentId = episode ? episode.id : item.id;

  // Initial resume position from LocalStorage synchronously
  const [initialResumePos, setInitialResumePos] = useState<number>(() => {
    const localDoc = getLocalVideoWatchProgress(item.id, episode?.id, userId);
    if (localDoc && localDoc.currentPositionSeconds > 3 && !localDoc.completed) {
      const dur = localDoc.videoDurationSeconds || 600;
      if (localDoc.currentPositionSeconds < dur - 5) {
        return localDoc.currentPositionSeconds;
      }
    }
    return 0;
  });

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialResumePos);
  const [duration, setDuration] = useState(() => {
    const rawDur = getVerifiedDuration(episode ? episode.id : item.id, episode ? episode.duration : item.duration);
    return parseDurationToSeconds(rawDur) || 0;
  });
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFitCover, setIsFitCover] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterDimmed, setIsTheaterDimmed] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [seekHoverTime, setSeekHoverTime] = useState<number | null>(null);
  const [seekHoverPos, setSeekHoverPos] = useState<number>(0);

  // Real Quality Control State
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [activeEffectiveQuality, setActiveEffectiveQuality] = useState<string>('1080p');
  const [intrinsicVideoHeight, setIntrinsicVideoHeight] = useState<number | undefined>(undefined);
  const [ytAvailableQualities, setYtAvailableQualities] = useState<QualityOption[]>([]);
  const [ytManualSupported, setYtManualSupported] = useState<boolean>(false);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'constrained'>('excellent');
  const [stalledCount, setStalledCount] = useState<number>(0);
  const [qualityToast, setQualityToast] = useState<string | null>(null);

  // XP Tracker State
  const [sessionWatchSeconds, setSessionWatchSeconds] = useState(0);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);
  const [showXpFloat, setShowXpFloat] = useState(false);
  const [hasAwardedCompletion, setHasAwardedCompletion] = useState(false);

  // Series Flow
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);

  // Social State (No fake comments - real only)
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentSort, setCommentSort] = useState<'top' | 'newest'>('top');
  const [showAllComments, setShowAllComments] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [isCreatorFollowed, setIsCreatorFollowed] = useState(false);

  // SheetDB persistent likes
  const [dbLikesCount, setDbLikesCount] = useState<number>(0);
  const [dbUserLiked, setDbUserLiked] = useState<boolean>(false);
  const [isLikeTransitioning, setIsLikeTransitioning] = useState<boolean>(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  // SheetDB persistent comments
  const [dbComments, setDbComments] = useState<SheetDbComment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState<boolean>(true);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState<boolean>(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentLikeTransitions, setCommentLikeTransitions] = useState<Record<string, boolean>>({});

  // Reply State
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyTargetUsername, setReplyTargetUsername] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [isReplySubmitting, setIsReplySubmitting] = useState<boolean>(false);
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});

  // Synchronize Likes and Comments from Turso database on mount and whenever content or user changes
  useEffect(() => {
    let isMounted = true;
    async function loadSocialData() {
      setIsCommentsLoading(true);
      try {
        const [likesRes, commentsRes] = await Promise.all([
          fetchLikesForContent(contentId, userId),
          fetchCommentsForContent(contentId, userId, true)
        ]);
        if (isMounted) {
          setDbLikesCount(likesRes.likesCount || 0);
          setDbUserLiked(Boolean(likesRes.userLiked));
          setDbComments(commentsRes || []);

          // Deep-link to comment or activate reply mode if opened from notification
          if (initialTargetCommentId && commentsRes && commentsRes.length > 0) {
            const target = commentsRes.find(
              (c) => c.commentId === initialTargetCommentId
            );
            const parent = target?.parentCommentId
              ? commentsRes.find(
                  (c) => c.commentId === target.parentCommentId
                )
              : target;

            if (parent) {
              setExpandedReplyThreads((prev) => ({ ...prev, [parent.commentId]: true }));
              if (initialIsReplying) {
                setReplyingToCommentId(parent.commentId);
                setReplyTargetUsername(target?.username || parent.username || 'Cinema Member');
              }
            }

            // Smooth scroll into comment section and highlight
            setTimeout(() => {
              const targetEl =
                document.getElementById(`comment-${initialTargetCommentId}`) ||
                document.getElementById(`comment-${parent?.commentId}`);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.classList.add('ring-2', 'ring-[#e2b14c]', 'bg-[#e2b14c]/10');
                setTimeout(() => {
                  targetEl.classList.remove('ring-2', 'ring-[#e2b14c]', 'bg-[#e2b14c]/10');
                }, 4000);
              } else if (commentsSectionRef.current) {
                commentsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 600);
          }
        }
      } catch (err) {
        console.warn('[Social] Load social data notice for content:', contentId, err);
      } finally {
        if (isMounted) {
          setIsCommentsLoading(false);
        }
      }
    }
    loadSocialData();
    return () => {
      isMounted = false;
    };
  }, [contentId, userId, initialTargetCommentId, initialIsReplying]);

  const allMembers = useMemo(() => getCommunityMembers(), []);

  // Video Stream URLs
  const rawUrl = episode?.videoUrl || item.videoUrl;
  
  const isYoutube = Boolean(rawUrl && (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')));
  const youtubeId = isYoutube ? extractYouTubeId(rawUrl) : null;
  const fetchedTitle = useYouTubeTitle(isYoutube ? rawUrl : undefined);
  const currentTitle = isYoutube ? (fetchedTitle || (episode ? `${item.title}: ${episode.title}` : item.title)) : (episode ? `${item.title}: ${episode.title}` : item.title);

  // Media Capability Layer computation
  const baseCapability = useMemo(() => {
    return detectVideoCapability(rawUrl, item.quality, intrinsicVideoHeight);
  }, [rawUrl, item.quality, intrinsicVideoHeight]);

  const capability: VideoSourceCapability = useMemo(() => {
    if (baseCapability.provider === 'youtube') {
      if (ytAvailableQualities.length > 0) {
        const maxQual = ytAvailableQualities.reduce(
          (max, q) => ((q.height || 0) > (max.height || 0) ? q : max),
          ytAvailableQualities[0]
        );
        const maxResLabel = maxQual.label || '1080p';
        return {
          ...baseCapability,
          maxResolution: maxResLabel,
          maxHeight: maxQual.height || 1080,
          availableQualities: [
            { id: 'auto', label: 'Auto', subtitle: 'YouTube adaptive quality' },
            ...ytAvailableQualities,
          ],
          manualQualitySupported: ytManualSupported,
        };
      }
    }
    return baseCapability;
  }, [baseCapability, ytAvailableQualities, ytManualSupported]);

  // Handle user manual quality selection
  const handleSelectQuality = (qualityId: string) => {
    setSelectedQuality(qualityId);
    const label = qualityId === 'auto' ? `Auto (${activeEffectiveQuality})` : qualityId;
    setQualityToast(`Quality set: ${label}`);
    setTimeout(() => setQualityToast(null), 2500);

    if (isYoutube && ytPlayerRef.current) {
      if (qualityId === 'auto') {
        if (typeof ytPlayerRef.current.setPlaybackQuality === 'function') {
          ytPlayerRef.current.setPlaybackQuality('auto');
        }
      } else {
        const match = capability.availableQualities.find((q) => q.id === qualityId);
        const codeToSet =
          match?.ytCode ||
          (qualityId === '1080p'
            ? 'hd1080'
            : qualityId === '720p'
            ? 'hd720'
            : qualityId === '480p'
            ? 'large'
            : 'medium');
        if (typeof ytPlayerRef.current.setPlaybackQuality === 'function') {
          ytPlayerRef.current.setPlaybackQuality(codeToSet);
        }
        setActiveEffectiveQuality(qualityId);
      }
    } else {
      if (qualityId === 'auto') {
        setActiveEffectiveQuality(capability.maxResolution || '1080p');
      } else {
        setActiveEffectiveQuality(qualityId);
      }
    }
  };

  const initialStreamUrl = normalizeVideoUrl(rawUrl, item.category);
  const [videoSrc, setVideoSrc] = useState(initialStreamUrl);
  const [isBuffering, setIsBuffering] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Synchronize videoSrc with initialStreamUrl when props change (switching episodes/media)
  useEffect(() => {
    if (initialStreamUrl !== videoSrc) {
      setVideoSrc(initialStreamUrl);
      setHasError(false);
      setIsBuffering(true);
      setAutoplayBlocked(false);
    }
  }, [initialStreamUrl, videoSrc]);

  // Attempt initial playback and catch browser autoplay prevention
  useEffect(() => {
    if (!isYoutube && videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setAutoplayBlocked(false);
            setIsBuffering(false);
            isBufferingRef.current = false;
          })
          .catch((err) => {
            console.warn('Autoplay prevented by browser, waiting for user gesture:', err);
            setIsPlaying(false);
            setAutoplayBlocked(true);
            setIsBuffering(false);
            isBufferingRef.current = false;
          });
      }
    }
  }, [videoSrc, isYoutube]);

  // For YouTube streams, ensure initial buffering resolves once player mounts
  useEffect(() => {
    if (!isYoutube) return;
    const timer = setTimeout(() => {
      setIsBuffering(false);
      isBufferingRef.current = false;
    }, 1200);
    return () => clearTimeout(timer);
  }, [isYoutube, youtubeId]);

  const posterUrl = episode?.thumbnail || item.backdrop || item.thumbnail || item.poster || '';

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedWatchSecondsRef = useRef<number>(0);
  const totalWatchTimeSecondsRef = useRef<number>(0);
  const lastTickTimestampRef = useRef<number>(Date.now());
  const lastVideoPositionRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const isBufferingRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);
  const hasAwardedCompletionRef = useRef<boolean>(false);
  const lastXpFloatMilestoneRef = useRef<number>(0);
  const lastPeriodicSyncTotalRef = useRef<number>(0);
  const savedResumePositionRef = useRef<number>(initialResumePos);
  const hasAppliedInitialSeekRef = useRef<boolean>(initialResumePos <= 3);
  const hasLoadedProgressRef = useRef<boolean>(false);
  const ytPlayerRef = useRef<any>(null);

  // Reset controls timer
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in comment input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skipTime(10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skipTime(-10);
      } else if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen]);

  // Sync duration state on content change
  useEffect(() => {
    const rawDur = getVerifiedDuration(contentId, episode ? episode.duration : item.duration);
    const parsed = parseDurationToSeconds(rawDur);
    if (parsed > 0) {
      setDuration(parsed);
    }
  }, [contentId, episode?.id, episode?.duration, item.duration]);

  // Listen for YouTube iframe messages to capture exact duration and time updates
  useEffect(() => {
    if (!isYoutube) return;

    const handleYtMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && (data.event === 'infoDelivery' || data.info)) {
          const info = data.info || {};
          if (typeof info.duration === 'number' && info.duration > 0) {
            const ytDur = Math.round(info.duration);
            setDuration(ytDur);
            saveVerifiedDuration(contentId, ytDur);
            saveVerifiedDuration(item.id, ytDur);
            if (episode?.id) saveVerifiedDuration(episode.id, ytDur);
          }
          if (typeof info.currentTime === 'number') {
            const ytCurr = Math.round(info.currentTime);
            if (ytCurr > 0 || hasAppliedInitialSeekRef.current) {
              setCurrentTime(ytCurr);
              if (savedResumePositionRef.current > 3 && ytCurr >= savedResumePositionRef.current - 5) {
                hasAppliedInitialSeekRef.current = true;
              }
            }
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleYtMessage);
    return () => window.removeEventListener('message', handleYtMessage);
  }, [isYoutube, contentId, item.id, episode?.id]);

  // Construct current canonical progress doc
  const getCurrentProgressDoc = (): VideoWatchProgressDoc => {
    let curr = currentTime;
    let dur = duration || 100;

    if (isYoutube && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
        const ytCurr = ytPlayerRef.current.getCurrentTime();
        if (!isNaN(ytCurr) && ytCurr >= 0) curr = ytCurr;
      }
      if (typeof ytPlayerRef.current.getDuration === 'function') {
        const ytDur = ytPlayerRef.current.getDuration();
        if (!isNaN(ytDur) && ytDur > 0) dur = ytDur;
      }
    } else if (videoRef.current) {
      curr = videoRef.current.currentTime || 0;
      if (videoRef.current.duration > 0) dur = videoRef.current.duration;
    }

    // Safety guard: if saved position was e.g. 145s, but player hasn't seeked yet, don't overwrite with 0s
    const targetResume = savedResumePositionRef.current || initialResumePos;
    if (targetResume > 3 && !hasAppliedInitialSeekRef.current) {
      if (curr < targetResume - 5) {
        curr = targetResume;
      } else {
        hasAppliedInitialSeekRef.current = true;
      }
    }

    const validDur = isNaN(dur) || dur <= 0 ? 100 : dur;
    const pct = Math.min(100, Math.max(0, (curr / validDur) * 100));
    const isCompleted = isCompletedRef.current || pct >= 90;

    if (isCompleted && !isCompletedRef.current) {
      isCompletedRef.current = true;
    }

    return {
      videoId: normalizeVideoId(item.id, episode?.id),
      currentPositionSeconds: Number(curr.toFixed(1)),
      totalWatchTimeSeconds: Math.round(totalWatchTimeSecondsRef.current),
      videoDurationSeconds: Number(validDur.toFixed(1)),
      progressPercentage: Number(pct.toFixed(1)),
      completed: isCompleted,
      lastWatchedAt: Date.now(),
      mediaTitle: item.title,
      mediaThumbnail: episode?.thumbnail || item.thumbnail,
      episodeTitle: episode?.title,
      episodeId: episode?.id,
      mediaId: item.id,
    };
  };

  // 1. Initial Load: Load persistent watch progress from LocalStorage & Firestore once
  useEffect(() => {
    let isCancelled = false;
    hasLoadedProgressRef.current = false;

    // Synchronous initial check from LocalStorage/memory cache
    const localDoc = getLocalVideoWatchProgress(item.id, episode?.id, userId);
    if (localDoc) {
      if (localDoc.totalWatchTimeSeconds) {
        totalWatchTimeSecondsRef.current = localDoc.totalWatchTimeSeconds;
      }
      if (localDoc.completed) {
        isCompletedRef.current = true;
        hasAwardedCompletionRef.current = true;
        setHasAwardedCompletion(true);
      }
      const savedPos = localDoc.currentPositionSeconds;
      if (savedPos && savedPos > 3 && !localDoc.completed) {
        const dur = localDoc.videoDurationSeconds || 600;
        if (savedPos < dur - 5) {
          savedResumePositionRef.current = savedPos;
          setInitialResumePos(savedPos);
          setCurrentTime(savedPos);
          if (videoRef.current) {
            videoRef.current.currentTime = savedPos;
          }
          if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(savedPos, true);
          }
        }
      }
    }

    const loadProgress = async () => {
      try {
        const progressDoc = await loadVideoWatchProgress(item.id, episode?.id, userId);
        if (isCancelled || !progressDoc) return;

        if (progressDoc.totalWatchTimeSeconds) {
          totalWatchTimeSecondsRef.current = progressDoc.totalWatchTimeSeconds;
        }
        if (progressDoc.completed) {
          isCompletedRef.current = true;
          hasAwardedCompletionRef.current = true;
          setHasAwardedCompletion(true);
        }

        const savedPos = progressDoc.currentPositionSeconds;
        if (savedPos && savedPos > 3 && !progressDoc.completed) {
          const isAtEnd = progressDoc.videoDurationSeconds && savedPos >= (progressDoc.videoDurationSeconds - 5);
          if (!isAtEnd) {
            savedResumePositionRef.current = savedPos;
            setInitialResumePos(savedPos);
            setCurrentTime(savedPos);

            if (videoRef.current) {
              videoRef.current.currentTime = savedPos;
            }
            if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
              ytPlayerRef.current.seekTo(savedPos, true);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load watch progress:', err);
      } finally {
        if (!isCancelled) {
          hasLoadedProgressRef.current = true;
        }
      }
    };

    loadProgress();

    return () => {
      isCancelled = true;
    };
  }, [item.id, episode?.id, userId]);

  // 2. YouTube Iframe API initialization & state tracking
  useEffect(() => {
    if (!isYoutube || !youtubeId) return;

    let player: any = null;

    const initYT = () => {
      if (!(window as any).YT || !(window as any).YT.Player) return;
      try {
        player = new (window as any).YT.Player(`youtube-iframe-${youtubeId}`, {
          events: {
            onReady: (event: any) => {
              ytPlayerRef.current = event.target;
              setIsBuffering(false);
              isBufferingRef.current = false;
              const dur = event.target.getDuration();
              if (dur > 0) setDuration(dur);
              const targetPos = savedResumePositionRef.current || initialResumePos;
              if (targetPos > 3 && !isCompletedRef.current) {
                event.target.seekTo(targetPos, true);
                hasAppliedInitialSeekRef.current = true;
              }

              // Extract real available quality levels exposed by YouTube API
              try {
                const availableLevels = event.target.getAvailableQualityLevels ? event.target.getAvailableQualityLevels() : [];
                if (Array.isArray(availableLevels) && availableLevels.length > 0) {
                  const mappedOpts: QualityOption[] = [];
                  availableLevels.forEach((lvl: string) => {
                    const opt = mapYouTubeQualityCode(lvl);
                    if (opt && !mappedOpts.some((m) => m.id === opt.id)) {
                      mappedOpts.push(opt);
                    }
                  });
                  if (mappedOpts.length > 0) {
                    setYtAvailableQualities(mappedOpts);
                    setYtManualSupported(true);
                  }
                }
                const currentYTQuality = event.target.getPlaybackQuality ? event.target.getPlaybackQuality() : 'auto';
                const currentOpt = mapYouTubeQualityCode(currentYTQuality);
                if (currentOpt) {
                  setActiveEffectiveQuality(currentOpt.id);
                }
              } catch (err) {
                console.warn('YouTube quality query notice:', err);
              }
            },
            onPlaybackQualityChange: (event: any) => {
              const newQualityCode = event.data;
              const mapped = mapYouTubeQualityCode(newQualityCode);
              if (mapped) {
                setActiveEffectiveQuality(mapped.id);
              }
            },
            onStateChange: (event: any) => {
              // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
              if (event.data === 1) {
                setIsPlaying(true);
                setIsBuffering(false);
                isBufferingRef.current = false;
                isSeekingRef.current = false;
                lastTickTimestampRef.current = Date.now();
                lastVideoPositionRef.current = event.target.getCurrentTime ? event.target.getCurrentTime() : 0;
              } else if (event.data === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
                isBufferingRef.current = false;
                syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
              } else if (event.data === 0) {
                setIsPlaying(false);
                setIsBuffering(false);
                isBufferingRef.current = false;
                isCompletedRef.current = true;
                if (!hasAwardedCompletionRef.current) {
                  hasAwardedCompletionRef.current = true;
                  setHasAwardedCompletion(true);
                  recordCompletedWatch(item.id, currentTitle);
                  markSagaMediaCompleted(item.id, undefined, currentTitle);
                }
                syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
              } else if (event.data === 3) {
                setIsBuffering(true);
                isBufferingRef.current = true;
              }
            },
          },
        });
      } catch (e) {
        console.warn('YouTube API init notice:', e);
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initYT;
    } else {
      initYT();
    }

    return () => {
      if (player && player.destroy) {
        try { player.destroy(); } catch {}
      }
      ytPlayerRef.current = null;
    };
  }, [isYoutube, youtubeId]);

  // 3. Real-time watch-time calculation ticker:
  // - Tracks only when actively playing
  // - Rejects seek jumps from watch-time accumulation
  // - Updates local storage continuously
  // - Throttles Firestore writes to 30-40 seconds
  useEffect(() => {
    const ticker = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;

      let currentPos = 0;
      let currentDur = duration;
      let isActivelyPlaying = false;

      if (isYoutube) {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getPlayerState === 'function') {
          const state = ytPlayerRef.current.getPlayerState();
          isActivelyPlaying = state === 1; // 1 = PLAYING
          if (isActivelyPlaying) {
            setIsPlaying(true);
            setIsBuffering(false);
            isBufferingRef.current = false;
          }
          if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
            currentPos = ytPlayerRef.current.getCurrentTime() || 0;
            setCurrentTime(currentPos);
          }
          if (typeof ytPlayerRef.current.getDuration === 'function') {
            const ytDur = ytPlayerRef.current.getDuration();
            if (ytDur > 0) {
              currentDur = ytDur;
              setDuration(ytDur);
            }
          }
        } else {
          isActivelyPlaying = isPlaying;
          currentPos = currentTime;
          if (isActivelyPlaying) {
            setIsBuffering(false);
            isBufferingRef.current = false;
          }
        }
      } else {
        const video = videoRef.current;
        if (video && !video.paused && !video.seeking && !video.ended && video.readyState >= 2 && !isSeekingRef.current) {
          isActivelyPlaying = true;
          currentPos = video.currentTime;
          if (video.duration > 0) currentDur = video.duration;
          // As long as the video is advancing and not paused, clear buffering state continuously
          setIsBuffering(false);
          isBufferingRef.current = false;
          setIsPlaying(true);
        }
      }

      if (!isActivelyPlaying) {
        lastTickTimestampRef.current = Date.now();
        lastVideoPositionRef.current = currentPos;
        return;
      }

      const now = Date.now();
      const wallDelta = (now - lastTickTimestampRef.current) / 1000;
      const positionDelta = currentPos - lastVideoPositionRef.current;

      // Anti-seeking validation: Only count playback delta when progress matches normal wall-clock rate
      const isNormalPlayback = positionDelta >= 0 && positionDelta <= 2.5 && wallDelta > 0 && wallDelta <= 2.5;

      if (isNormalPlayback) {
        const realWatchDelta = Math.min(wallDelta, positionDelta + 0.1);
        totalWatchTimeSecondsRef.current += realWatchDelta;
        accumulatedWatchSecondsRef.current += realWatchDelta;
        setSessionWatchSeconds(Math.floor(accumulatedWatchSecondsRef.current));

        // Real XP & Achievements update in local state
        recordWatchTimeSeconds(item.id, realWatchDelta, true);

        // Watch-to-Earn Rewards (XP)
        if (userId && userId !== 'guest') {
          RewardService.addWatchTime(userId, realWatchDelta).catch(() => {});
        }

        // Check 30-second session milestone for XP toast pop
        const currentSessionSecs = Math.floor(accumulatedWatchSecondsRef.current);
        if (currentSessionSecs > 0 && currentSessionSecs % 30 === 0 && currentSessionSecs !== lastXpFloatMilestoneRef.current) {
          lastXpFloatMilestoneRef.current = currentSessionSecs;
          setSessionXpEarned((prev) => prev + 5);
          setShowXpFloat(true);
          setTimeout(() => setShowXpFloat(false), 2200);
        }
      }

      lastTickTimestampRef.current = now;
      lastVideoPositionRef.current = currentPos;

      // Completion check: 90%
      if (currentDur > 0) {
        const progressRatio = currentPos / currentDur;
        if (progressRatio >= 0.90 && !isCompletedRef.current) {
          isCompletedRef.current = true;
          if (!hasAwardedCompletionRef.current) {
            hasAwardedCompletionRef.current = true;
            setHasAwardedCompletion(true);
            recordCompletedWatch(item.id, currentTitle);
            markSagaMediaCompleted(item.id, undefined, currentTitle);
          }
        }
      }

      // Save local progress on every active second, ONLY after progress has been loaded
      if (hasLoadedProgressRef.current) {
        const progressDoc = getCurrentProgressDoc();
        saveVideoProgressLocally(progressDoc, userId);

        // Periodic Firestore sync: Every 35 seconds of cumulative playback
        const currentTotalSecs = Math.floor(totalWatchTimeSecondsRef.current);
        if (currentTotalSecs > 0 && currentTotalSecs % 35 === 0 && currentTotalSecs !== lastPeriodicSyncTotalRef.current) {
          lastPeriodicSyncTotalRef.current = currentTotalSecs;
          syncVideoProgressToFirestore(progressDoc, false, userId);
        }
      }
    }, 1000);

    return () => {
      clearInterval(ticker);
    };
  }, [isPlaying, isYoutube, item.id, episode?.id, userId, currentTitle, duration]);

  // 4. Page Lifecycle & Unmount Flush:
  // Saves locally & syncs to Firestore on pause, backgrounding, tab close, or modal unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (hasLoadedProgressRef.current) {
          syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
        }
      } else {
        lastTickTimestampRef.current = Date.now();
        if (videoRef.current) {
          lastVideoPositionRef.current = videoRef.current.currentTime;
        }
      }
    };

    const handleBeforeUnload = () => {
      if (hasLoadedProgressRef.current) {
        saveVideoProgressLocally(getCurrentProgressDoc(), userId);
        syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Modal unmount flush
      if (hasLoadedProgressRef.current) {
        const doc = getCurrentProgressDoc();
        if (doc.currentPositionSeconds > 0) {
          saveVideoProgressLocally(doc, userId);
          syncVideoProgressToFirestore(doc, true, userId);
        }
      }
    };
  }, [item.id, episode?.id, userId]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(curr);
    if (dur && dur > 0) setDuration(dur);
    
    // Live playback state: If video is playing and progressing, continuously clear buffering
    if (!videoRef.current.paused) {
      setIsPlaying(true);
      setIsBuffering(false);
      isBufferingRef.current = false;
    }
  };

  const handleVideoClick = () => {
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimeout();
    }
  };

  const togglePlay = () => {
    if (isYoutube && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.getPlayerState === 'function' && typeof ytPlayerRef.current.pauseVideo === 'function' && typeof ytPlayerRef.current.playVideo === 'function') {
        const state = ytPlayerRef.current.getPlayerState();
        if (state === 1) { // 1 = playing
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } else {
        setIsPlaying((prev) => !prev);
      }
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        lastTickTimestampRef.current = Date.now();
        lastVideoPositionRef.current = videoRef.current.currentTime;
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
      }
    }
    resetControlsTimeout();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(newTime, true);
      lastVideoPositionRef.current = newTime;
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      lastVideoPositionRef.current = newTime;
    }
    resetControlsTimeout();
  };

  const skipTime = (seconds: number) => {
    let currentPos = currentTime;
    if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      currentPos = ytPlayerRef.current.getCurrentTime() || 0;
    } else if (videoRef.current) {
      currentPos = videoRef.current.currentTime;
    }

    const newTime = Math.max(0, Math.min(duration, currentPos + seconds));
    setCurrentTime(newTime);

    if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(newTime, true);
      lastVideoPositionRef.current = newTime;
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      lastVideoPositionRef.current = newTime;
    }
    resetControlsTimeout();
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (isYoutube && ytPlayerRef.current) {
      if (newMuted) {
        if (typeof ytPlayerRef.current.mute === 'function') ytPlayerRef.current.mute();
      } else {
        if (typeof ytPlayerRef.current.unMute === 'function') ytPlayerRef.current.unMute();
      }
    } else if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const newMuted = val === 0;
    setIsMuted(newMuted);

    if (isYoutube && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.setVolume === 'function') ytPlayerRef.current.setVolume(val * 100);
      if (typeof ytPlayerRef.current.mute === 'function') {
        if (newMuted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      }
    } else if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = newMuted;
    }
  };

  const changeSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setPlaybackSpeed(newSpeed);
    if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackRate === 'function') {
      ytPlayerRef.current.setPlaybackRate(newSpeed);
    } else if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
    resetControlsTimeout();
  };

  const toggleFullscreen = () => {
    const target = playerBoxRef.current || containerRef.current;
    if (!target) return;

    if (!document.fullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else if ((target as any).webkitRequestFullscreen) {
        (target as any).webkitRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const handleVideoError = () => {
    console.warn('Video stream error for:', videoSrc);
    setIsBuffering(false);
    if (videoSrc !== DEMO_TRAILER_URLS.action) {
      setVideoSrc(DEMO_TRAILER_URLS.action);
    } else {
      setHasError(true);
    }
  };

  const handleRetryStream = () => {
    setHasError(false);
    setIsBuffering(true);
    const freshUrl = normalizeVideoUrl(rawUrl, item.category);
    const separator = freshUrl.includes('?') ? '&' : '?';
    setVideoSrc(`${freshUrl}${separator}_t=${Date.now()}`);
  };

  // Toggle SheetDB Like for active content item
  const handleToggleLikeDb = async () => {
    if (isGuest) {
      setLikeError('Sign in to like content.');
      setTimeout(() => setLikeError(null), 3000);
      return;
    }
    if (isLikeTransitioning) return;
    setIsLikeTransitioning(true);
    setLikeError(null);

    const previousLiked = dbUserLiked;
    const previousCount = dbLikesCount;
    
    // Optimistic UI update
    setDbUserLiked(!previousLiked);
    setDbLikesCount((prev) => previousLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      const result = await toggleLikeInDb(contentId, userId);
      setDbUserLiked(result.active);
      setDbLikesCount(result.likesCount);
    } catch (err) {
      // Revert optimistic update on failure
      setDbUserLiked(previousLiked);
      setDbLikesCount(previousCount);
      setLikeError('Could not sync like. Please try again.');
      setTimeout(() => setLikeError(null), 3000);
    } finally {
      setIsLikeTransitioning(false);
    }
  };

  // Post SheetDB Comment
  const handlePostCommentDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      setCommentError('Sign in to post reviews.');
      setTimeout(() => setCommentError(null), 3000);
      return;
    }
    const trimmed = newCommentText.trim();
    if (!trimmed) return;

    const tempCommentId = `temp-${Date.now()}`;
    const optimisticComment: SheetDbComment = {
      commentId: tempCommentId,
      contentId,
      userId,
      username,
      avatar,
      text: trimmed,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      userLiked: false,
    };

    // Optimistic UI Update
    setDbComments((prev) => [optimisticComment, ...prev]);
    setNewCommentText('');
    setIsCommentSubmitting(true);
    setCommentError(null);

    try {
      const created = await addCommentToDb(contentId, userId, username, avatar, trimmed);
      // Replace optimistic comment with real one from server
      setDbComments((prev) => prev.map(c => c.commentId === tempCommentId ? created : c));
      
      // Award XP for engaging in comments
      awardXp('Shared Cinema Review Comment', 15, 'engagement');
    } catch (err) {
      // Revert on error
      setDbComments((prev) => prev.filter(c => c.commentId !== tempCommentId));
      setCommentError('Failed to post review. Please try again.');
      setTimeout(() => setCommentError(null), 3000);
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  // Delete SheetDB Comment (Only own comments)
  const handleDeleteCommentDb = async (commentId: string) => {
    const commentToDelete = dbComments.find((c) => c.commentId === commentId);
    if (!commentToDelete) return;

    if (commentToDelete.userId !== userId) {
      alert('Unauthorized: You cannot delete another user\'s comment.');
      return;
    }

    const previousComments = dbComments;

    // Optimistic UI removal
    setDbComments((prev) => prev.filter((c) => c.commentId !== commentId));

    try {
      const success = await deleteCommentFromDb(commentId, userId, contentId);
      if (!success) {
        throw new Error('Deletion failed.');
      }
    } catch (err) {
      // Rollback on failure
      setDbComments(previousComments);
      setCommentError('Failed to delete comment. Please try again.');
      setTimeout(() => setCommentError(null), 3000);
    }
  };

  // Toggle Comment Like (Persistent in Turso)
  const handleToggleCommentLike = async (commentId: string) => {
    if (isGuest) {
      setCommentError('Sign in to like reviews & comments.');
      setTimeout(() => setCommentError(null), 3000);
      return;
    }
    if (commentLikeTransitions[commentId]) return;

    setCommentLikeTransitions((prev) => ({ ...prev, [commentId]: true }));
    setCommentError(null);

    const target = dbComments.find((c) => c.commentId === commentId);
    const prevLiked = Boolean(target?.userLiked);
    const prevCount = target?.likesCount || 0;

    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    // Optimistic UI update
    setDbComments((prev) =>
      prev.map((c) =>
        c.commentId === commentId
          ? { ...c, userLiked: nextLiked, likesCount: nextCount }
          : c
      )
    );

    try {
      const res = await toggleCommentLikeInDb(commentId, contentId, userId);
      setDbComments((prev) =>
        prev.map((c) =>
          c.commentId === commentId
            ? { ...c, userLiked: res.active, likesCount: res.likesCount }
            : c
        )
      );
    } catch (err) {
      // Rollback on failure
      setDbComments((prev) =>
        prev.map((c) =>
          c.commentId === commentId
            ? { ...c, userLiked: prevLiked, likesCount: prevCount }
            : c
        )
      );
      setCommentError('Failed to sync comment like. Please try again.');
      setTimeout(() => setCommentError(null), 3000);
    } finally {
      setCommentLikeTransitions((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  // Post Reply to a Comment
  const handlePostReply = async (parentCommentId: string) => {
    if (isGuest) {
      setCommentError('Sign in to post replies.');
      setTimeout(() => setCommentError(null), 3000);
      return;
    }
    const trimmed = replyText.trim();
    if (!trimmed) return;

    const tempCommentId = `temp-rep-${Date.now()}`;
    const optimisticReply: SheetDbComment = {
      commentId: tempCommentId,
      contentId,
      userId,
      username,
      avatar,
      text: trimmed,
      parentCommentId,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      userLiked: false,
    };

    // Optimistically add reply and auto-expand thread
    setDbComments((prev) => [...prev, optimisticReply]);
    setExpandedReplyThreads((prev) => ({ ...prev, [parentCommentId]: true }));
    setReplyText('');
    setReplyingToCommentId(null);
    setIsReplySubmitting(true);
    setCommentError(null);

    try {
      const created = await addCommentToDb(contentId, userId, username, avatar, trimmed, parentCommentId);
      setDbComments((prev) => prev.map((c) => (c.commentId === tempCommentId ? created : c)));
      awardXp('Shared Cinema Review Reply', 15, 'engagement');
    } catch (err) {
      setDbComments((prev) => prev.filter((c) => c.commentId !== tempCommentId));
      setCommentError('Failed to post reply. Please try again.');
      setTimeout(() => setCommentError(null), 3000);
    } finally {
      setIsReplySubmitting(false);
    }
  };

  // Top-level comments and their replies
  const { topLevelComments, repliesByParent } = useMemo(() => {
    const topLevel: SheetDbComment[] = [];
    const repliesMap = new Map<string, SheetDbComment[]>();

    // Separate top-level and replies
    dbComments.forEach((c) => {
      if (c.parentCommentId) {
        const existing = repliesMap.get(c.parentCommentId) || [];
        existing.push(c);
        repliesMap.set(c.parentCommentId, existing);
      } else {
        topLevel.push(c);
      }
    });

    // Sort top level comments
    topLevel.sort((a, b) => {
      if (commentSort === 'top') {
        const likeDiff = (b.likesCount || 0) - (a.likesCount || 0);
        if (likeDiff !== 0) return likeDiff;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    // Sort replies chronologically (oldest first)
    repliesMap.forEach((repliesList) => {
      repliesList.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    });

    return { topLevelComments: topLevel, repliesByParent: repliesMap };
  }, [dbComments, commentSort]);

  // Share action
  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `FARUKAT - ${currentTitle}`,
          text: `Streaming ${currentTitle} in 4K HDR on FARUKAT Cinema!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  const isSavedInWatchlist = watchlist.includes(item.id);
  const isLikedByMe = likes.includes(item.id);
  const isDownloaded = downloads.includes(item.id);
  const isSagaItem = false;

  // Truncation check
  const fullDesc = episode?.description || item.description || '';
  const needsTruncation = fullDesc.length > 150;
  const displayedDesc = !needsTruncation || isOverviewExpanded
    ? fullDesc
    : `${fullDesc.slice(0, 150)}...`;

  const similarItems = useMemo(() => {
    return MEDIA_CATALOG.filter((m) => m.id !== item.id).slice(0, 4);
  }, [item.id]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col overflow-y-auto pb-32 selection:bg-[#e2b14c] selection:text-black ${
        isTheaterDimmed ? 'brightness-90' : ''
      }`}
    >
      {/* 1. WATCH PAGE HEADER - Anchored top bar with distinct border and shadow */}
      <header className="sticky top-0 z-40 w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.7)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/80 hover:text-white border border-white/15 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95 shadow-sm"
            aria-label="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xs font-semibold text-white/90 truncate max-w-[220px] sm:max-w-md">
              {currentTitle}
            </span>
          </div>
        </div>
        
        {/* Right side is intentionally minimal, keeping it ultra-clean */}
        <div className="w-10 h-10" />
      </header>

      {/* Main Watch Flow Container - Tightened top padding to seamlessly connect to header */}
      <main className="w-full max-w-4xl mx-auto px-4 pt-2.5 pb-20 flex flex-col gap-4">
        
        {/* ============================================================== */}
        {/* 2. CINEMATIC 16:9 VIDEO PLAYER CONTAINER - Clean, sharp borders, no bleeding glow */}
        {/* ============================================================== */}
        <section
          ref={playerBoxRef}
          onMouseMove={resetControlsTimeout}
          onTouchStart={resetControlsTimeout}
          className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.85)] group flex items-center justify-center select-none"
        >
          {/* HTML5 Video Element or YouTube Iframe */}
          {isYoutube && youtubeId ? (
            <div className="relative w-full h-full" onClick={handleVideoClick}>
              <iframe
                id={`youtube-iframe-${youtubeId}`}
                src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=0${(savedResumePositionRef.current || initialResumePos) > 3 ? `&start=${Math.floor(savedResumePositionRef.current || initialResumePos)}` : ''}&origin=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => {
                  setIsBuffering(false);
                  isBufferingRef.current = false;
                }}
              />
              {/* Invisible click interceptor overlay when controls are hidden */}
              {!showControls && (
                <div className="absolute inset-0 bg-transparent cursor-pointer" />
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoSrc || undefined}
              autoPlay
              playsInline
              preload="auto"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  if (videoRef.current.videoHeight) {
                    const h = videoRef.current.videoHeight;
                    setIntrinsicVideoHeight(h);
                    const detectedLabel = getHeightQualityLabel(h);
                    setActiveEffectiveQuality(detectedLabel);
                  }
                  const dur = Math.round(videoRef.current.duration);
                  if (dur && dur > 0) {
                    setDuration(dur);
                    saveVerifiedDuration(contentId, dur);
                    saveVerifiedDuration(item.id, dur);
                    if (episode?.id) saveVerifiedDuration(episode.id, dur);
                  }
                  const targetPos = savedResumePositionRef.current || initialResumePos;
                  if (targetPos > 3 && !isCompletedRef.current) {
                    videoRef.current.currentTime = targetPos;
                    hasAppliedInitialSeekRef.current = true;
                  }
                }
              }}
              onLoadedData={() => {
                setIsBuffering(false);
                isBufferingRef.current = false;
              }}
              onCanPlay={() => {
                setIsBuffering(false);
                isBufferingRef.current = false;
                const targetPos = savedResumePositionRef.current || initialResumePos;
                if (targetPos > 3 && videoRef.current && videoRef.current.currentTime < targetPos - 2) {
                  videoRef.current.currentTime = targetPos;
                  hasAppliedInitialSeekRef.current = true;
                }
              }}
              onCanPlayThrough={() => {
                setIsBuffering(false);
                isBufferingRef.current = false;
              }}
              onPlay={() => {
                setIsPlaying(true);
                setIsBuffering(false);
                setAutoplayBlocked(false);
                isBufferingRef.current = false;
                lastTickTimestampRef.current = Date.now();
                if (videoRef.current) lastVideoPositionRef.current = videoRef.current.currentTime;
              }}
              onPause={() => {
                setIsPlaying(false);
                syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
              }}
              onWaiting={() => {
                setStalledCount((prev) => {
                  const next = prev + 1;
                  if (next >= 2) {
                    setNetworkQuality('constrained');
                    if (selectedQuality === 'auto') {
                      setActiveEffectiveQuality('480p');
                    }
                  }
                  return next;
                });
                if (videoRef.current && (videoRef.current.readyState < 3 || videoRef.current.paused)) {
                  setIsBuffering(true);
                  isBufferingRef.current = true;
                }
              }}
              onStalled={() => {
                setStalledCount((prev) => {
                  const next = prev + 1;
                  if (next >= 2) {
                    setNetworkQuality('constrained');
                    if (selectedQuality === 'auto') {
                      setActiveEffectiveQuality('480p');
                    }
                  }
                  return next;
                });
                if (videoRef.current && videoRef.current.readyState < 3 && !videoRef.current.paused) {
                  setIsBuffering(true);
                  isBufferingRef.current = true;
                }
              }}
              onPlaying={() => {
                setIsPlaying(true);
                setIsBuffering(false);
                setAutoplayBlocked(false);
                isBufferingRef.current = false;
                lastTickTimestampRef.current = Date.now();
                if (videoRef.current) {
                  lastVideoPositionRef.current = videoRef.current.currentTime;
                  if (videoRef.current.buffered.length > 0) {
                    const bufEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
                    if (bufEnd - videoRef.current.currentTime > 8) {
                      setNetworkQuality('excellent');
                      setStalledCount(0);
                      if (selectedQuality === 'auto') {
                        setActiveEffectiveQuality(capability.maxResolution || '1080p');
                      }
                    }
                  }
                }
              }}
              onSeeking={() => {
                isSeekingRef.current = true;
                if (videoRef.current) lastVideoPositionRef.current = videoRef.current.currentTime;
              }}
              onSeeked={() => {
                isSeekingRef.current = false;
                lastTickTimestampRef.current = Date.now();
                if (videoRef.current) {
                  lastVideoPositionRef.current = videoRef.current.currentTime;
                  setCurrentTime(videoRef.current.currentTime);
                  saveVideoProgressLocally(getCurrentProgressDoc(), userId);
                  if (!videoRef.current.paused) {
                    setIsBuffering(false);
                    isBufferingRef.current = false;
                  }
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                setIsBuffering(false);
                isBufferingRef.current = false;
                isCompletedRef.current = true;
                if (!hasAwardedCompletionRef.current) {
                  hasAwardedCompletionRef.current = true;
                  setHasAwardedCompletion(true);
                  recordCompletedWatch(item.id, currentTitle);
                  markSagaMediaCompleted(item.id, undefined, currentTitle);
                }
                syncVideoProgressToFirestore(getCurrentProgressDoc(), true, userId);
              }}
              onTimeUpdate={handleTimeUpdate}
              onError={handleVideoError}
              onClick={handleVideoClick}
              className={`w-full h-full cursor-pointer transition-opacity duration-500 ${
                isBuffering ? 'opacity-0' : 'opacity-100'
              } ${isFitCover ? 'object-cover' : 'object-contain'}`}
            />
          )}

          {/* Premium Cinematic Loading & Error State (No Poster) */}
          <CinematicPlayerLoader
            isLoading={
              isBuffering &&
              !hasError &&
              !autoplayBlocked &&
              !(
                !isYoutube
                  ? videoRef.current && !videoRef.current.paused && (videoRef.current.currentTime > 0 || isPlaying)
                  : isPlaying
              )
            }
            hasError={hasError}
            onRetry={handleRetryStream}
            errorMessage="Unable to play video"
          />

          {/* Mobile Tap-to-Play Overlay (when autoplay was blocked by browser) */}
          {autoplayBlocked && !isPlaying && !hasError && !isBuffering && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs cursor-pointer select-none"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#e2b14c] hover:brightness-110 text-black shadow-2xl flex items-center justify-center cursor-pointer transform hover:scale-105 active:scale-95 transition-all">
                <Play className="w-7 h-7 fill-black ml-1" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 uppercase tracking-wider bg-black/70 px-3 py-1 rounded-full border border-white/10">
                Tap to Play
              </span>
            </div>
          )}

          {/* Floating Quality Change Toast */}
          {qualityToast && (
            <div className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-xl bg-black/85 border border-[#e2b14c]/50 text-[#e2b14c] text-xs font-bold font-mono shadow-xl animate-fadeIn flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-[#e2b14c]" />
              <span>{qualityToast}</span>
            </div>
          )}

          {/* Floating Animated XP Earned Badge */}
          {showXpFloat && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex items-center gap-2 bg-[#e2b14c] text-black font-black px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(226,177,76,0.5)] animate-bounce text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>+5 XP Earned</span>
            </div>
          )}

          {/* Center Play/Pause Splash & Skips on Click */}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-[var(--bg-main)]/40 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={handleVideoClick}
          >
            <div className="flex items-center gap-6 sm:gap-10" onClick={(e) => e.stopPropagation()}>
              {/* Rewind 10s */}
              <button
                onClick={() => skipTime(-10)}
                className="w-12 h-12 rounded-full bg-[var(--bg-main)]/50 hover:bg-[#e2b14c] hover:text-black text-[var(--text-primary)]/80 flex items-center justify-center transition border border-white/10 hover:border-transparent cursor-pointer"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Central Play / Pause */}
              <button
                onClick={togglePlay}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[var(--bg-main)]/70 hover:bg-[#e2b14c] text-[var(--text-primary)] hover:text-black border border-white/10 hover:border-transparent flex items-center justify-center transition transform hover:scale-105 shadow-2xl backdrop-blur-md cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              {/* Fast Forward 10s */}
              <button
                onClick={() => skipTime(10)}
                className="w-12 h-12 rounded-full bg-[var(--bg-main)]/50 hover:bg-[#e2b14c] hover:text-black text-[var(--text-primary)]/80 flex items-center justify-center transition border border-white/10 hover:border-transparent cursor-pointer"
                title="Forward 10 seconds"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* VIDEO CONTROLS BAR (Auto-Hides during playback) */}
          {/* ============================================================== */}
          <div
            className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 sm:p-4 pt-10 flex flex-col gap-2 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Interactive Seek Bar */}
            <div className="relative w-full group/seek flex items-center">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/20 hover:h-1.5 rounded-lg appearance-none cursor-pointer accent-[#e2b14c] transition-all"
              />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between pt-1">
              {/* Left Controls: Play, Skips, Volume, Timers */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="p-1 rounded hover:bg-white/10 text-[var(--text-primary)] transition cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                </button>

                {/* Volume slider */}
                <div className="flex items-center gap-1.5 group/vol">
                  <button
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="p-1 rounded hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-[#e2b14c]" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume slider"
                    className="w-12 sm:w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#e2b14c]"
                  />
                </div>

                {/* Current Time on Left */}
                <span className="text-[10px] sm:text-xs font-mono text-[var(--text-primary)]/90">
                  {formatTime(currentTime)}
                </span>
              </div>

              {/* Right Controls: Quality, Playback speed, Duration, Fullscreen */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Functional Video Quality Control Button */}
                <button
                  onClick={() => setIsQualityMenuOpen(true)}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white hover:text-[#e2b14c] transition flex items-center gap-1 cursor-pointer border border-white/10"
                  title="Video Quality Settings"
                >
                  <Settings className="w-3 h-3 text-[#e2b14c]" />
                  <span>{selectedQuality === 'auto' ? `Auto (${activeEffectiveQuality})` : selectedQuality}</span>
                </button>

                {/* Speed Switcher */}
                <button
                  onClick={changeSpeed}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-[#e2b14c] transition cursor-pointer"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>

                {/* Duration Label */}
                <span className="text-[10px] sm:text-xs font-mono text-[var(--text-secondary)]">
                  {formatTime(duration)}
                </span>

                {/* Fullscreen Toggle DIRECTLY on the RIGHT */}
                <button
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="p-1 rounded hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4 text-[#e2b14c]" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3. MOVIE INFORMATION SECTION */}
        {/* ============================================================== */}
        <section className="flex flex-col gap-2 mt-1 px-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {currentTitle}
          </h1>

          {/* Unified metadata row: badges + clean muted metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Rating Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-white/90 font-bold text-[11px]">
              <Star className="w-3 h-3 text-[#e2b14c] fill-[#e2b14c]" />
              <span>{item.rating || '8.4'}</span>
            </div>

            {/* Category / Section Badge */}
            <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-white/90 text-[11px] font-bold uppercase tracking-wider">
              {item.category || 'Specials'}
            </span>

            {/* Quality Badge */}
            <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-white/90 text-[10px] font-bold">
              {item.quality || '4K'}
            </span>

            <span className="text-white/30">•</span>

            {/* Plain Muted Secondary Details */}
            <span className="text-white/60 font-medium text-[11px]">{item.year || '2024'}</span>

            <span className="text-white/30">•</span>

            <span className="text-white/60 font-medium text-[11px]">
              {getVerifiedDuration(contentId, episode ? episode.duration : item.duration)}
            </span>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 4. ACTIONS ROW (My List, Like, Share, Watch Together) */}
        {/* ============================================================== */}
        {!isSagaItem && (
          <div className={`grid gap-2 py-2 px-2 rounded-xl bg-white/[0.03] border border-white/10 ${watchPartyEnabled ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {/* My List */}
            <button
              id="watch-action-watchlist"
              onClick={() => onToggleWatchlist && onToggleWatchlist(item.id)}
              className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer min-h-[42px]"
              title="Add to My List"
            >
              {isSavedInWatchlist ? (
                <Check className="w-4 h-4 text-[#e2b14c]" />
              ) : (
                <Bookmark className="w-4 h-4 text-white/80" />
              )}
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                {isSavedInWatchlist ? 'In List' : 'My List'}
              </span>
            </button>

            {/* Watch Together */}
            {watchPartyEnabled && (
              <button
                id="watch-action-together"
                onClick={() => setIsWatchTogetherOpen(true)}
                className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer min-h-[42px]"
                title="Watch Together with Friends"
              >
                <Users className="w-4 h-4 text-[#e2b14c]" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                  Together
                </span>
              </button>
            )}

            {/* Like */}
            <button
              id="watch-action-like"
              onClick={() => {
                if (isGuest) {
                  alert('Guests cannot like items. Please register for an account.');
                  return;
                }
                handleToggleLikeDb();
              }}
              disabled={isLikeTransitioning || isGuest}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer min-h-[42px] ${
                isLikeTransitioning ? 'opacity-70 cursor-wait' : ''
              } ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`}
              title="Like Title"
            >
              <ThumbsUp
                className={`w-4 h-4 ${
                  dbUserLiked ? 'fill-[#e2b14c] text-[#e2b14c]' : 'text-white/80'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                {dbLikesCount > 0 ? `${dbLikesCount} Likes` : 'Like'}
              </span>
            </button>

            {/* Share */}
            <button
              id="watch-action-share"
              onClick={handleShare}
              className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer relative min-h-[42px]"
              title="Share Title"
            >
              <Share2 className="w-4 h-4 text-white/80" />
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                Share
              </span>
              {shareToast && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#e2b14c] text-black text-[10px] font-bold rounded shadow-lg whitespace-nowrap">
                  Link Copied!
                </span>
              )}
            </button>
          </div>
        )}

        {/* Watch Together Invite Modal */}
        {watchPartyEnabled && (
          <WatchTogetherInviteModal
            isOpen={isWatchTogetherOpen}
            onClose={() => setIsWatchTogetherOpen(false)}
            media={item}
            episode={episode}
          />
        )}

        {/* ============================================================== */}
        {/* 5. OVERVIEW SECTION (With Read More controller) */}
        {/* ============================================================== */}
        <section className="bg-[#0b0b0b] border border-[#141414] p-4 rounded-2xl flex flex-col gap-1 px-4">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Overview</h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {displayedDesc}
          </p>
          {needsTruncation && (
            <button
              onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
              className="text-xs font-bold text-[#e2b14c] hover:underline self-start mt-1 cursor-pointer"
            >
              {isOverviewExpanded ? 'Read Less' : 'Read More'}
            </button>
          )}
        </section>

        {/* Episode Selector for Series */}
        {item.isSeries && item.episodes && item.episodes.length > 0 && (
          <section className="flex flex-col gap-3 mt-1 px-1">
            <button
              onClick={() => setShowEpisodes(!showEpisodes)}
              className="flex items-center justify-between w-full p-3 rounded-2xl bg-[#0b0b0b] border border-[#141414] hover:bg-[var(--bg-card)] transition-all group cursor-pointer"
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5 group-hover:text-[var(--text-primary)] transition-colors">
                <Film className="w-3.5 h-3.5 text-[#e2b14c]" />
                <span>Season Episodes ({item.episodes.length})</span>
              </h3>
              {showEpisodes ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
              )}
            </button>

            {showEpisodes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                {item.episodes.map((ep) => {
                  const isSelected = episode?.id === ep.id;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => onSelectEpisode && onSelectEpisode(item, ep)}
                      className={`p-2.5 rounded-xl border flex gap-3 cursor-pointer transition ${
                        isSelected
                          ? 'bg-[var(--bg-card)] border-[#e2b14c] shadow-lg'
                          : 'bg-[#090909] border-[#161616] hover:border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-main)]">
                        <img
                          src={ep.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                          alt={ep.title}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-[var(--bg-main)]/60 flex items-center justify-center">
                            <Play className="w-5 h-5 fill-[#e2b14c] text-[#e2b14c]" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-center">
                        <span className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">{ep.title}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">{getVerifiedDuration(ep.id, ep.duration)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* 6. REVIEWS & FEED */}
        {/* ============================================================== */}
        {!isSagaItem && (
          <section className="flex flex-col gap-3.5 bg-[#090909] border border-white/5 p-4 rounded-2xl">
            {/* Section Header - Clickable to toggle comments visibility */}
            <div 
              onClick={() => setIsCommentsOpen(!isCommentsOpen)}
              className="flex items-center justify-between cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 group-hover:text-white transition flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#e2b14c]" />
                  <span>Comments ({dbComments.length})</span>
                </h3>
                {isCommentsLoading && (
                  <span className="text-[10px] text-[#e2b14c] animate-pulse font-mono">Syncing...</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#e2b14c] font-medium flex items-center gap-1">
                  <span>{isCommentsOpen ? 'Hide Comments' : 'Show Comments'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCommentsOpen ? 'rotate-180' : ''}`} />
                </span>
              </div>
            </div>

            {/* Collapsible Comments Content */}
            {isCommentsOpen && (
              <div className="flex flex-col gap-3.5 pt-1 animate-fadeIn">
                {/* Comment Sort Controls */}
                {topLevelComments.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
                      {commentSort === 'top' ? 'Top 10 Most Liked' : 'Newest First'}
                    </span>
                    <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCommentSort('top'); setShowAllComments(false); }}
                        className={`min-h-[32px] px-2.5 py-1 rounded-md text-[10px] font-bold transition select-none cursor-pointer ${
                          commentSort === 'top'
                            ? 'bg-[#e2b14c] text-black shadow-sm'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Top Likes
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCommentSort('newest'); setShowAllComments(false); }}
                        className={`min-h-[32px] px-2.5 py-1 rounded-md text-[10px] font-bold transition select-none cursor-pointer ${
                          commentSort === 'newest'
                            ? 'bg-[#e2b14c] text-black shadow-sm'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Newest
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Comment Input */}
                {isGuest ? (
                  <div className="py-2.5 px-4 rounded-xl bg-black/40 border border-white/10 text-xs text-white/40 text-center cursor-not-allowed">
                    Guests cannot comment. Please register for an account.
                  </div>
                ) : (
                  <form onSubmit={handlePostCommentDb} className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      disabled={isCommentSubmitting}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#e2b14c] disabled:opacity-50 min-h-[42px]"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim() || isCommentSubmitting}
                      className="px-4 py-2.5 rounded-xl bg-[#e2b14c] text-black font-bold text-xs hover:brightness-110 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer min-h-[42px]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isCommentSubmitting ? 'Sending' : 'Send'}</span>
                    </button>
                  </form>
                )}

                {commentError && (
                  <div className="text-xs text-red-400 font-medium px-1 animate-pulse">
                    {commentError}
                  </div>
                )}

                {/* Contained Scrollable Comments Feed */}
                <div 
                  className="flex flex-col gap-3 max-h-[420px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar"
                  style={{ touchAction: 'pan-y' }}
                >
                  {isCommentsLoading && dbComments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-white/50 flex flex-col items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#e2b14c] border-t-transparent rounded-full animate-spin"></div>
                      <span>Syncing comments...</span>
                    </div>
                  ) : topLevelComments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-white/40">
                      No comments yet. Be the first to share your thoughts!
                    </div>
                  ) : (
                    <>
                      {(showAllComments ? topLevelComments : topLevelComments.slice(0, 10)).map((c) => {
                        const isMyComment = c.userId === userId;
                        const isTransitioning = Boolean(commentLikeTransitions[c.commentId]);
                        const replies = repliesByParent.get(c.commentId) || [];
                        const hasReplies = replies.length > 0;
                        const isThreadExpanded = Boolean(expandedReplyThreads[c.commentId]);
                        const isReplyingToThis = replyingToCommentId === c.commentId;

                        // Format relative time
                        let relativeTime = 'Just now';
                        try {
                          const now = new Date();
                          const past = new Date(c.createdAt);
                          const diffMs = now.getTime() - past.getTime();
                          if (!isNaN(diffMs) && diffMs >= 0) {
                            const diffSecs = Math.floor(diffMs / 1000);
                            if (diffSecs >= 60) {
                              const diffMins = Math.floor(diffSecs / 60);
                              if (diffMins < 60) {
                                relativeTime = `${diffMins}m ago`;
                              } else {
                                const diffHrs = Math.floor(diffMins / 60);
                                if (diffHrs < 24) {
                                  relativeTime = `${diffHrs}h ago`;
                                } else {
                                  const diffDays = Math.floor(diffHrs / 24);
                                  relativeTime = `${diffDays}d ago`;
                                }
                              }
                            }
                          }
                        } catch {}

                        return (
                          <div
                            key={c.commentId}
                            id={`comment-${c.commentId}`}
                            className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition flex flex-col gap-2"
                          >
                            {/* Top Level Comment Item */}
                            <div className="flex items-start gap-2.5">
                              <img
                                src={c.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(c.username || 'user')}`}
                                alt={c.username}
                                className="w-7 h-7 rounded-full object-cover bg-white/10 border border-white/10 shrink-0 mt-0.5"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(c.username || 'user')}`;
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-semibold text-white/90 truncate">
                                    {c.username || 'Cinema Member'}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-white/40 font-mono">{relativeTime}</span>
                                    {isMyComment && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCommentDb(c.commentId)}
                                        className="text-[10px] text-white/30 hover:text-red-400 transition cursor-pointer p-0.5"
                                        title="Delete comment"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-white/80 leading-relaxed break-words whitespace-pre-wrap">
                                  {c.text}
                                </p>

                                {/* Actions: Like, Reply, and View Replies Toggle */}
                                <div className="flex items-center gap-3 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCommentLike(c.commentId)}
                                    disabled={isTransitioning || isGuest}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer min-h-[32px] ${
                                      c.userLiked
                                        ? 'text-[#e2b14c] bg-[#e2b14c]/10'
                                        : 'text-white/50 hover:text-white hover:bg-white/5'
                                    } ${isTransitioning ? 'opacity-70 cursor-wait' : ''} ${isGuest ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <Heart className={`w-3.5 h-3.5 ${c.userLiked ? 'fill-current text-[#e2b14c]' : ''}`} />
                                    <span>{c.likesCount || 0}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingToCommentId(c.commentId);
                                      setReplyTargetUsername(c.username || 'Cinema Member');
                                      setReplyText('');
                                      setExpandedReplyThreads((prev) => ({ ...prev, [c.commentId]: true }));
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition cursor-pointer min-h-[32px]"
                                  >
                                    <Reply className="w-3.5 h-3.5" />
                                    <span>Reply</span>
                                  </button>

                                  {hasReplies && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedReplyThreads((prev) => ({
                                          ...prev,
                                          [c.commentId]: !prev[c.commentId],
                                        }))
                                      }
                                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#e2b14c] hover:bg-[#e2b14c]/10 transition cursor-pointer min-h-[32px] ml-auto"
                                    >
                                      <CornerDownRight className="w-3 h-3" />
                                      <span>{isThreadExpanded ? 'Hide' : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}</span>
                                      <ChevronDown className={`w-3 h-3 transition-transform ${isThreadExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Inline Reply Form for Top-Level Comment */}
                            {isReplyingToThis && (
                              <div className="mt-1 pl-4 ml-3.5 border-l-2 border-[#e2b14c]/40 flex flex-col gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between text-[11px] text-white/60">
                                  <span>Replying to <strong className="text-white/90">@{replyTargetUsername}</strong></span>
                                  <button
                                    type="button"
                                    onClick={() => setReplyingToCommentId(null)}
                                    className="text-white/40 hover:text-white text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-main)] border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#e2b14c] min-h-[38px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handlePostReply(c.commentId);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handlePostReply(c.commentId)}
                                    disabled={!replyText.trim() || isReplySubmitting}
                                    className="px-3 py-1.5 rounded-lg bg-[#e2b14c] text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 transition cursor-pointer min-h-[38px] flex items-center gap-1"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>{isReplySubmitting ? '...' : 'Reply'}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Nested Replies */}
                            {hasReplies && isThreadExpanded && (
                              <div className="pl-4 ml-3.5 border-l-2 border-white/10 flex flex-col gap-2.5 mt-1 pt-1">
                                {replies.map((r) => {
                                  const isMyReply = r.userId === userId;
                                  const isReplyTransitioning = Boolean(commentLikeTransitions[r.commentId]);
                                  const isReplyingToThisReply = replyingToCommentId === r.commentId;

                                  let replyRelativeTime = 'Just now';
                                  try {
                                    const now = new Date();
                                    const past = new Date(r.createdAt);
                                    const diffMs = now.getTime() - past.getTime();
                                    if (!isNaN(diffMs) && diffMs >= 0) {
                                      const diffSecs = Math.floor(diffMs / 1000);
                                      if (diffSecs >= 60) {
                                        const diffMins = Math.floor(diffSecs / 60);
                                        if (diffMins < 60) {
                                          replyRelativeTime = `${diffMins}m ago`;
                                        } else {
                                          const diffHrs = Math.floor(diffMins / 60);
                                          if (diffHrs < 24) {
                                            replyRelativeTime = `${diffHrs}h ago`;
                                          } else {
                                            const diffDays = Math.floor(diffHrs / 24);
                                            replyRelativeTime = `${diffDays}d ago`;
                                          }
                                        }
                                      }
                                    }
                                  } catch {}

                                  return (
                                    <div
                                      key={r.commentId}
                                      id={`comment-${r.commentId}`}
                                      className="flex flex-col gap-1.5 p-2 rounded-lg bg-white/[0.015] border border-white/5 transition"
                                    >
                                      <div className="flex items-start gap-2">
                                        <img
                                          src={r.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(r.username || 'user')}`}
                                          alt={r.username}
                                          className="w-5 h-5 rounded-full object-cover bg-white/10 border border-white/10 shrink-0 mt-0.5"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(r.username || 'user')}`;
                                          }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="text-[11px] font-semibold text-white/90 truncate">
                                              {r.username || 'Cinema Member'}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <span className="text-[9px] text-white/40 font-mono">{replyRelativeTime}</span>
                                              {isMyReply && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteCommentDb(r.commentId)}
                                                  className="text-[9px] text-white/30 hover:text-red-400 transition cursor-pointer p-0.5"
                                                  title="Delete reply"
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <p className="text-xs text-white/75 leading-relaxed break-words whitespace-pre-wrap">
                                            {r.text}
                                          </p>

                                          {/* Reply Actions: Like & Reply */}
                                          <div className="flex items-center gap-2.5 mt-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleToggleCommentLike(r.commentId)}
                                              disabled={isReplyTransitioning || isGuest}
                                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer min-h-[28px] ${
                                                r.userLiked
                                                  ? 'text-[#e2b14c] bg-[#e2b14c]/10'
                                                  : 'text-white/50 hover:text-white hover:bg-white/5'
                                              } ${isReplyTransitioning ? 'opacity-70 cursor-wait' : ''} ${isGuest ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                              <Heart className={`w-3 h-3 ${r.userLiked ? 'fill-current text-[#e2b14c]' : ''}`} />
                                              <span>{r.likesCount || 0}</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReplyingToCommentId(r.commentId);
                                                setReplyTargetUsername(r.username || 'Cinema Member');
                                                setReplyText(`@${r.username} `);
                                              }}
                                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition cursor-pointer min-h-[28px]"
                                            >
                                              <Reply className="w-3 h-3" />
                                              <span>Reply</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Inline Reply Box for this nested reply */}
                                      {isReplyingToThisReply && (
                                        <div className="mt-1 pl-3 border-l-2 border-[#e2b14c]/40 flex flex-col gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
                                          <div className="flex items-center justify-between text-[10px] text-white/60">
                                            <span>Replying to <strong className="text-white/90">@{replyTargetUsername}</strong></span>
                                            <button
                                              type="button"
                                              onClick={() => setReplyingToCommentId(null)}
                                              className="text-white/40 hover:text-white text-[9px] cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                          <div className="flex gap-2">
                                            <input
                                              type="text"
                                              value={replyText}
                                              onChange={(e) => setReplyText(e.target.value)}
                                              placeholder={`Reply to @${replyTargetUsername}...`}
                                              className="flex-1 px-2.5 py-1 rounded-md bg-[var(--bg-main)] border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#e2b14c] min-h-[34px]"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                  e.preventDefault();
                                                  handlePostReply(c.commentId);
                                                }
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handlePostReply(c.commentId)}
                                              disabled={!replyText.trim() || isReplySubmitting}
                                              className="px-2.5 py-1 rounded-md bg-[#e2b14c] text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 transition cursor-pointer min-h-[34px] flex items-center gap-1"
                                            >
                                              <Send className="w-3 h-3" />
                                              <span>{isReplySubmitting ? '...' : 'Reply'}</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Show More / Show Less Button if > 10 comments */}
                      {topLevelComments.length > 10 && (
                        <button
                          type="button"
                          onClick={() => setShowAllComments(!showAllComments)}
                          className="w-full py-2.5 mt-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-[#e2b14c] transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
                        >
                          <span>{showAllComments ? 'Show Top 10 Only' : `Show More Comments (${topLevelComments.length - 10} more)`}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllComments ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* 7. MORE LIKE THIS */}
        {/* ============================================================== */}
        <section className="flex flex-col gap-3 mt-1 px-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-[#e2b14c]" />
            <span>More Like This</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {similarItems.map((rec) => (
              <div
                key={rec.id}
                onClick={() => {
                  if (onPlayMedia) {
                    onPlayMedia(rec);
                  }
                }}
                className="group cursor-pointer flex flex-col gap-2 bg-[var(--bg-surface)] border border-[#151515] hover:border-[var(--border-subtle)] p-2 rounded-xl transition"
              >
                <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-[var(--bg-main)]/40">
                  <img
                    src={rec.thumbnail || rec.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                    alt={rec.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-1.5 right-1.5 bg-[var(--bg-main)]/70 px-1.5 py-0.5 rounded text-[9px] font-black text-[#e2b14c] flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 text-[#e2b14c] fill-[#e2b14c]" />
                    <span>{rec.rating}</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] group-hover:text-[#e2b14c] transition line-clamp-1">
                    {rec.title}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                    {rec.category} · {getVerifiedDuration(rec.id, rec.duration)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* ============================================================== */}
      {/* 8. INTEGRATED BOTTOM NAVIGATION BAR */}
      {/* ============================================================== */}
      <BottomNav
        activeTab={activeTab || 'home'}
        onSelectTab={onSelectTab || (() => {})}
        watchlistCount={watchlist.length}
        account={account || getXpAccount()}
        onOpenMembership={onOpenMembership || (() => {})}
      />

      {/* Real Functional Quality Control Modal Sheet */}
      <QualityMenuModal
        isOpen={isQualityMenuOpen}
        onClose={() => setIsQualityMenuOpen(false)}
        capability={capability}
        selectedQuality={selectedQuality}
        activeEffectiveQuality={activeEffectiveQuality}
        onSelectQuality={handleSelectQuality}
        networkQuality={networkQuality}
      />
    </div>
  );
};
