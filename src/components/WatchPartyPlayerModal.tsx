import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Send,
  Users,
  MessageSquare,
  Sparkles,
  LogOut,
  Maximize,
  Minimize,
  RefreshCw,
  Tv,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Film,
  Power,
  Settings,
} from 'lucide-react';
import { QualityMenuModal } from './QualityMenuModal';
import {
  detectVideoCapability,
  mapYouTubeQualityCode,
  getHeightQualityLabel,
  QualityOption,
  VideoSourceCapability,
} from '../utils/mediaQualityManager';
import { MediaItem, Episode } from '../types';
import {
  WatchPartyDoc,
  WatchPartyMessage,
  subscribeToWatchParty,
  subscribeToPartyMessages,
  updatePartyPlayerState,
  sendPartyMessage,
  leaveWatchParty,
  endWatchParty,
  addViewerToParty,
  removeViewerFromParty,
  savePartyReplay,
  saveLocalJoinedPartyId,
  removeLocalJoinedPartyId,
  calculatePartyCurrentPosition,
} from '../utils/watchPartyManager';
import { getTursoWatchPartyStateClient } from '../utils/tursoClient';
import { getCurrentUserPublicProfile } from '../utils/memberSystem';
import { MEDIA_CATALOG } from '../data/mediaData';
import { WatchTogetherInviteModal } from './WatchTogetherInviteModal';
import { normalizeVideoUrl, DEMO_TRAILER_URLS } from '../utils/mediaUtils';
import { extractYouTubeId } from '../utils/youtubeUtils';
import { getXpAccount } from '../utils/xpSystem';

interface WatchPartyPlayerModalProps {
  partyData: WatchPartyDoc;
  onClose: () => void;
}

export const WatchPartyPlayerModal: React.FC<WatchPartyPlayerModalProps> = ({
  partyData: initialParty,
  onClose,
}) => {
  const initialCalc = calculatePartyCurrentPosition(initialParty.playerState, initialParty);
  const [party, setParty] = useState<WatchPartyDoc>(initialParty);
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(initialCalc.isPlaying);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(initialCalc.hasStarted);
  const [needsUserGestureToPlay, setNeedsUserGestureToPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialCalc.currentPosition);
  const [duration, setDuration] = useState(600);
  const [showChatOverlay, setShowChatOverlay] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dialog States
  const [showSaveReplayConfirm, setShowSaveReplayConfirm] = useState(false);
  const [showEndPartyConfirm, setShowEndPartyConfirm] = useState(false);
  const [showPartyEndedModal, setShowPartyEndedModal] = useState(false);
  const [isSavingReplay, setIsSavingReplay] = useState(false);

  // Quality Control State
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [activeEffectiveQuality, setActiveEffectiveQuality] = useState<string>('1080p');
  const [intrinsicVideoHeight, setIntrinsicVideoHeight] = useState<number | undefined>(undefined);
  const [ytAvailableQualities, setYtAvailableQualities] = useState<QualityOption[]>([]);
  const [ytManualSupported, setYtManualSupported] = useState<boolean>(false);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'constrained'>('excellent');
  const [qualityToast, setQualityToast] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const lastLocalActionTimeRef = useRef<number>(0);
  const maxWatchedPositionRef = useRef<number>(initialParty.playerState?.currentTime || 0);

  const currentUser = getCurrentUserPublicProfile();
  const myUid = currentUser.userId || currentUser.cardNumber;
  const isHost = myUid === party.hostUid;

  const handlePlaybackEnded = () => {
    setIsPlaying(false);
    setShowPartyEndedModal(true);
    if (isHost) {
      endWatchParty(party.partyId).catch(() => {});
    }
  };

  // Save to local joined parties list for seamless rejoining from top of Home screen
  useEffect(() => {
    if (party.partyId) {
      saveLocalJoinedPartyId(party.partyId);
    }
  }, [party.partyId]);

  // Sync live viewers in Firestore
  useEffect(() => {
    if (!party.partyId) return;
    const viewerObj = {
      uid: myUid,
      name: currentUser.name,
      avatar: currentUser.avatarUrl,
    };
    addViewerToParty(party.partyId, viewerObj);

    return () => {
      removeViewerFromParty(party.partyId, myUid);
    };
  }, [party.partyId, myUid]);

  // Helper to render viewers circular avatars
  const renderViewerAvatars = () => {
    const viewers = party.viewers || [];
    if (viewers.length === 0) return null;
    const maxAvatars = 5;
    const displayedViewers = viewers.slice(0, maxAvatars);
    const extraCount = viewers.length - maxAvatars;

    return (
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 py-1 rounded">
        <div className="flex -space-x-1.5 overflow-hidden">
          {displayedViewers.map((v) => (
            <img
              key={v.uid}
              src={v.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
              alt={v.name}
              referrerPolicy="no-referrer"
              className="w-4 h-4 rounded-full border border-black object-cover"
              title={v.name}
            />
          ))}
          {extraCount > 0 && (
            <div className="w-4 h-4 rounded-full bg-neutral-800 border border-black flex items-center justify-center text-[7px] font-bold text-[#e2b14c]">
              +{extraCount}
            </div>
          )}
        </div>
        <span className="text-[9px] font-bold font-mono text-[var(--text-muted)]">
          {viewers.length} WATCHING
        </span>
      </div>
    );
  };

  // Immediate Turso Room Playback Query for zero-viewer or late-rejoin state recovery
  useEffect(() => {
    if (!party.partyId) return;

    getTursoWatchPartyStateClient(party.partyId).then((tursoParty) => {
      if (tursoParty && tursoParty.started_at) {
        const calc = calculatePartyCurrentPosition(
          {
            started_at: tursoParty.started_at,
            is_playing: Boolean(tursoParty.is_playing),
            last_state_change_at: tursoParty.last_state_change_at,
            total_paused_duration: tursoParty.total_paused_duration || 0,
            currentTime: tursoParty.current_position || 0,
          },
          undefined,
          duration
        );

        if (calc.hasStarted) {
          setCurrentTime(calc.currentPosition);
          setHasStartedPlayback(true);
          setIsPlaying(calc.isPlaying);

          if (isYoutube && ytPlayerRef.current) {
            if (typeof ytPlayerRef.current.seekTo === 'function') {
              ytPlayerRef.current.seekTo(calc.currentPosition, true);
            }
            if (calc.isPlaying && typeof ytPlayerRef.current.playVideo === 'function') {
              ytPlayerRef.current.playVideo();
            }
          } else if (videoRef.current) {
            videoRef.current.currentTime = calc.currentPosition;
            if (calc.isPlaying) {
              videoRef.current.play().catch(() => setNeedsUserGestureToPlay(true));
            }
          }
        }
      }
    }).catch(() => {});
  }, [party.partyId, duration]);

  // Toggle true Fullscreen
  const toggleFullscreen = () => {
    const target = playerBoxRef.current;
    if (!target) return;

    if (!document.fullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else if ((target as any).webkitRequestFullscreen) {
        (target as any).webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        setIsFullscreen(true);
      }

      // Try to lock orientation to landscape on mobile
      try {
        if ((screen as any).orientation && (screen as any).orientation.lock) {
          (screen as any).orientation.lock('landscape').catch(() => {});
        }
      } catch {}
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);

      // Unlock orientation
      try {
        if ((screen as any).orientation && (screen as any).orientation.unlock) {
          (screen as any).orientation.unlock();
        }
      } catch {}
    }
  };

  // Sync state on fullscreen changes
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

  // Resolve media details
  const mediaItem: MediaItem | undefined = MEDIA_CATALOG.find((m) => m.id === party.mediaId) || MEDIA_CATALOG[0];
  const episode: Episode | undefined = mediaItem?.episodes?.find((e) => e.id === party.episodeId);

  const rawVideoUrl = episode?.videoUrl || mediaItem?.videoUrl || DEMO_TRAILER_URLS.action;
  const normalizedVideoUrl = normalizeVideoUrl(rawVideoUrl, mediaItem?.category);
  const [videoSrc, setVideoSrc] = useState<string>(normalizedVideoUrl);
  const isYoutube = Boolean((videoSrc || normalizedVideoUrl) && ((videoSrc || normalizedVideoUrl).includes('youtube.com') || (videoSrc || normalizedVideoUrl).includes('youtu.be')));
  const youtubeId = isYoutube ? extractYouTubeId(videoSrc || normalizedVideoUrl) : null;

  const rawUrl = rawVideoUrl;

  const capability = React.useMemo(() => {
    const base = detectVideoCapability(rawUrl, mediaItem?.quality, intrinsicVideoHeight);
    if (base.provider === 'youtube' && ytAvailableQualities.length > 0) {
      const maxQual = ytAvailableQualities.reduce(
        (max, q) => ((q.height || 0) > (max.height || 0) ? q : max),
        ytAvailableQualities[0]
      );
      return {
        ...base,
        maxResolution: maxQual.label || '1080p',
        maxHeight: maxQual.height || 1080,
        availableQualities: [
          { id: 'auto', label: 'Auto', subtitle: 'YouTube adaptive quality' },
          ...ytAvailableQualities,
        ],
        manualQualitySupported: ytManualSupported,
      };
    }
    return base;
  }, [rawUrl, mediaItem?.quality, intrinsicVideoHeight, ytAvailableQualities, ytManualSupported]);

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

  const posterUrl = party.mediaThumbnail || episode?.thumbnail || mediaItem?.backdrop || mediaItem?.thumbnail || mediaItem?.poster || '';

  useEffect(() => {
    setVideoSrc(normalizedVideoUrl);
  }, [normalizedVideoUrl]);

  // 1. Subscribe to Party Document updates
  useEffect(() => {
    const unsubscribe = subscribeToWatchParty(party.partyId, (updatedParty) => {
      if (!updatedParty) return;

      const calc = calculatePartyCurrentPosition(updatedParty.playerState, updatedParty, duration);

      if (updatedParty.status === 'ended' || calc.hasEnded) {
        removeLocalJoinedPartyId(party.partyId);
        setIsPlaying(false);
        setShowPartyEndedModal(true);
        if (isHost && updatedParty.status !== 'ended') {
          endWatchParty(party.partyId).catch(() => {});
        }
        return;
      }

      setParty(updatedParty);

      if (updatedParty.playerState?.isPlaying) {
        setHasStartedPlayback(true);
      }

      // Handle Remote Playhead Sync if state was updated by partner or host
      if (updatedParty.playerState && updatedParty.playerState.lastActionBy !== myUid) {
        const remoteState = updatedParty.playerState;
        const now = Date.now();
        // Ignore remote actions within 1.2s of a local action to avoid feedback loops
        if (now - lastLocalActionTimeRef.current > 1200) {
          const calc = calculatePartyCurrentPosition(remoteState, updatedParty, duration);
          const expectedTime = calc.currentPosition;

          // Sync Play/Pause
          setIsPlaying(calc.isPlaying);
          if (calc.hasStarted) {
            setHasStartedPlayback(true);
          }

          if (isYoutube) {
            if (ytPlayerRef.current) {
              if (calc.isPlaying) {
                if (typeof ytPlayerRef.current.playVideo === 'function') ytPlayerRef.current.playVideo();
              } else {
                if (typeof ytPlayerRef.current.pauseVideo === 'function') ytPlayerRef.current.pauseVideo();
              }

              // Sync Time if drift > 2.5s
              if (typeof ytPlayerRef.current.getCurrentTime === 'function' && typeof ytPlayerRef.current.seekTo === 'function') {
                const currentPos = ytPlayerRef.current.getCurrentTime();
                if (Math.abs(currentPos - expectedTime) > 2.5) {
                  ytPlayerRef.current.seekTo(expectedTime, true);
                }
              }
            }
          } else if (videoRef.current) {
            if (calc.isPlaying && videoRef.current.paused) {
              videoRef.current.play().catch(() => {
                setNeedsUserGestureToPlay(true);
              });
            } else if (!calc.isPlaying && !videoRef.current.paused) {
              videoRef.current.pause();
            }

            // Sync Time if drift > 2s
            if (Math.abs(videoRef.current.currentTime - expectedTime) > 2) {
              videoRef.current.currentTime = expectedTime;
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [party.partyId, myUid, isYoutube, isHost, onClose, duration]);

  // 2. Subscribe to Party Messages
  useEffect(() => {
    const unsubscribe = subscribeToPartyMessages(party.partyId, (newMessages) => {
      setMessages(newMessages);

      // Scroll to bottom of chat
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [party.partyId]);

  // 3. Periodic Host-to-Guest Playhead Synchronization
  useEffect(() => {
    if (!isHost || !isPlaying || !hasStartedPlayback) return;

    const interval = setInterval(() => {
      let currentPos = currentTime;
      let isPlayingNow: boolean = isPlaying;

      if (isYoutube) {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          currentPos = ytPlayerRef.current.getCurrentTime();
          isPlayingNow = ytPlayerRef.current.getPlayerState() === 1;
        }
      } else {
        if (videoRef.current) {
          currentPos = videoRef.current.currentTime;
          isPlayingNow = !videoRef.current.paused;
        }
      }

      if (isPlayingNow) {
        const now = Date.now();
        const startedAt = party.playerState?.started_at ?? party.started_at ?? (now - Math.round(currentPos * 1000));
        const totalPaused = party.playerState?.total_paused_duration ?? party.total_paused_duration ?? 0;

        updatePartyPlayerState(party.partyId, {
          currentTime: currentPos,
          isPlaying: true,
          is_playing: true,
          started_at: startedAt,
          total_paused_duration: totalPaused,
          last_state_change_at: party.playerState?.last_state_change_at ?? now,
          actionType: 'sync',
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHost, isPlaying, hasStartedPlayback, isYoutube, party.partyId, currentTime, party.playerState, party.started_at, party.total_paused_duration]);

  // 4. YouTube Iframe API initialization & state tracking for Watch Party
  useEffect(() => {
    if (!isYoutube || !youtubeId) return;

    let player: any = null;

    const initYT = () => {
      if (!(window as any).YT || !(window as any).YT.Player) return;
      try {
        player = new (window as any).YT.Player(`youtube-iframe-party-${youtubeId}`, {
          events: {
            onReady: (event: any) => {
              ytPlayerRef.current = event.target;
              const dur = event.target.getDuration();
              if (dur > 0) setDuration(dur);
              
              // Apply initial position if party has started (for late joiners or rejoiners)
              const calc = calculatePartyCurrentPosition(party.playerState, party, dur > 0 ? dur : undefined);
              if (calc.hasStarted) {
                event.target.seekTo(calc.currentPosition, true);
                setCurrentTime(calc.currentPosition);
                setHasStartedPlayback(true);
                if (calc.isPlaying) {
                  event.target.playVideo();
                  setIsPlaying(true);
                } else {
                  event.target.pauseVideo();
                  setIsPlaying(false);
                }
              } else {
                // Strict no autoplay before host starts
                event.target.pauseVideo();
                setIsPlaying(false);
                setHasStartedPlayback(false);
              }
            },
            onStateChange: (event: any) => {
              // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
              if (event.data === 0) {
                // Video ENDED
                handlePlaybackEnded();
              } else if (event.data === 1) {
                if (!hasStartedPlayback && isHost) {
                  event.target.pauseVideo();
                  return;
                }
                setIsPlaying(true);
                if (isHost) {
                  const now = Date.now();
                  const prevStartedAt = party.playerState?.started_at ?? party.started_at;
                  const prevTotalPaused = party.playerState?.total_paused_duration ?? party.total_paused_duration ?? 0;
                  const prevLastChange = party.playerState?.last_state_change_at ?? party.last_state_change_at ?? now;

                  let newStartedAt = prevStartedAt || now;
                  let newTotalPaused = prevTotalPaused;
                  if (prevStartedAt) {
                    const pauseDuration = Math.max(0, (now - prevLastChange) / 1000);
                    newTotalPaused = prevTotalPaused + pauseDuration;
                  }

                  updatePartyPlayerState(party.partyId, {
                    currentTime: event.target.getCurrentTime(),
                    isPlaying: true,
                    is_playing: true,
                    started_at: newStartedAt,
                    last_state_change_at: now,
                    total_paused_duration: newTotalPaused,
                    actionType: 'play',
                  });
                }
              } else if (event.data === 2) {
                setIsPlaying(false);
                if (isHost) {
                  const now = Date.now();
                  const prevStartedAt = party.playerState?.started_at ?? party.started_at;
                  const prevTotalPaused = party.playerState?.total_paused_duration ?? party.total_paused_duration ?? 0;

                  updatePartyPlayerState(party.partyId, {
                    currentTime: event.target.getCurrentTime(),
                    isPlaying: false,
                    is_playing: false,
                    started_at: prevStartedAt,
                    last_state_change_at: now,
                    total_paused_duration: prevTotalPaused,
                    actionType: 'pause',
                  });
                }
              }
            },
          },
        });
      } catch (e) {
        console.warn('YouTube WatchParty notice:', e);
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
  }, [isYoutube, youtubeId, isHost, party.partyId, hasStartedPlayback]);

  // Listen for YouTube iframe messages for Watch Party to capture exact duration and time updates
  useEffect(() => {
    if (!isYoutube) return;

    const handleYtMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && (data.event === 'infoDelivery' || data.info)) {
          const info = data.info || {};
          if (typeof info.duration === 'number' && info.duration > 0) {
            setDuration(Math.round(info.duration));
          }
          if (typeof info.currentTime === 'number') {
            const t = Math.round(info.currentTime);
            setCurrentTime(t);
            if (isPlaying) {
              maxWatchedPositionRef.current = Math.max(maxWatchedPositionRef.current, t);
            }
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleYtMessage);
    return () => window.removeEventListener('message', handleYtMessage);
  }, [isYoutube, isPlaying]);

  // Host manually starts video playback (visible only to host, works even with 0 other viewers!)
  const handleStartPlayback = () => {
    if (!isHost) return;
    const now = Date.now();
    setHasStartedPlayback(true);
    setIsPlaying(true);
    setNeedsUserGestureToPlay(false);
    lastLocalActionTimeRef.current = now;

    let currentPos = currentTime;
    if (isYoutube) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        ytPlayerRef.current.playVideo();
        if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
          currentPos = ytPlayerRef.current.getCurrentTime() || 0;
        }
      }
    } else if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('Playback gesture error:', err);
      });
      currentPos = videoRef.current.currentTime || 0;
    }

    const effectiveStartedAt = now - Math.round(currentPos * 1000);

    updatePartyPlayerState(party.partyId, {
      currentTime: currentPos,
      isPlaying: true,
      is_playing: true,
      started_at: effectiveStartedAt,
      last_state_change_at: now,
      total_paused_duration: 0,
      actionType: 'play',
    });

    sendPartyMessage(party.partyId, `${party.hostName} started the video`, 'system');
  };

  // Toggle Play / Pause locally & push state to party
  const handleTogglePlay = () => {
    if (!hasStartedPlayback && isHost) {
      handleStartPlayback();
      return;
    }

    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    const now = Date.now();
    lastLocalActionTimeRef.current = now;

    let currentPos = currentTime;

    if (isYoutube) {
      if (ytPlayerRef.current) {
        if (nextPlaying) {
          if (typeof ytPlayerRef.current.playVideo === 'function') ytPlayerRef.current.playVideo();
        } else {
          if (typeof ytPlayerRef.current.pauseVideo === 'function') ytPlayerRef.current.pauseVideo();
        }
        if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
          currentPos = ytPlayerRef.current.getCurrentTime();
        }
      }
    } else if (videoRef.current) {
      if (nextPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
      currentPos = videoRef.current.currentTime;
    }

    const prevStartedAt = party.playerState?.started_at ?? party.started_at;
    const prevTotalPaused = party.playerState?.total_paused_duration ?? party.total_paused_duration ?? 0;
    const prevLastChange = party.playerState?.last_state_change_at ?? party.last_state_change_at ?? now;

    let newStartedAt = prevStartedAt || (now - Math.round(currentPos * 1000));
    let newTotalPaused = prevTotalPaused;

    if (nextPlaying) {
      const pauseDuration = Math.max(0, (now - prevLastChange) / 1000);
      newTotalPaused = prevTotalPaused + pauseDuration;
    }

    updatePartyPlayerState(party.partyId, {
      currentTime: currentPos,
      isPlaying: nextPlaying,
      is_playing: nextPlaying,
      started_at: newStartedAt,
      last_state_change_at: now,
      total_paused_duration: newTotalPaused,
      actionType: nextPlaying ? 'play' : 'pause',
    });
  };

  // Handle local video seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    const now = Date.now();
    lastLocalActionTimeRef.current = now;

    if (isYoutube) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        ytPlayerRef.current.seekTo(target, true);
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = target;
    }

    const effectiveStartedAt = now - Math.round(target * 1000);

    updatePartyPlayerState(party.partyId, {
      currentTime: target,
      isPlaying,
      is_playing: isPlaying,
      started_at: effectiveStartedAt,
      last_state_change_at: now,
      total_paused_duration: 0,
      actionType: 'seek',
    });
  };

  // Skip / Rewind playback (Host only)
  const handleSkipTime = (seconds: number) => {
    if (!isHost) return;
    let currentPos = currentTime;
    if (isYoutube) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        currentPos = ytPlayerRef.current.getCurrentTime();
      }
    } else if (videoRef.current) {
      currentPos = videoRef.current.currentTime;
    }

    const newTime = Math.max(0, Math.min(duration, currentPos + seconds));
    setCurrentTime(newTime);
    const now = Date.now();
    lastLocalActionTimeRef.current = now;

    if (isYoutube) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        ytPlayerRef.current.seekTo(newTime, true);
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }

    const effectiveStartedAt = now - Math.round(newTime * 1000);

    updatePartyPlayerState(party.partyId, {
      currentTime: newTime,
      isPlaying,
      is_playing: isPlaying,
      started_at: effectiveStartedAt,
      last_state_change_at: now,
      total_paused_duration: 0,
      actionType: 'seek',
    });
  };

  // Send Chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendPartyMessage(party.partyId, chatInput.trim(), 'chat', currentTime);
    setChatInput('');
  };

  // Leave Party (does NOT terminate the party; other viewers continue watching normally)
  const handleLeaveParty = async () => {
    try {
      await leaveWatchParty(party.partyId, myUid);
      (window as any).__showFcmToast?.(
        isHost
          ? 'You left the watch party. The party remains active for other viewers.'
          : 'You left the watch party. Other viewers can continue watching.',
        'info'
      );
    } catch (err) {
      console.warn('Error leaving party:', err);
    } finally {
      onClose();
    }
  };

  // Explicitly End Party for Everyone (Host only)
  const confirmEndParty = async (shouldSave: boolean) => {
    setIsSavingReplay(true);
    try {
      if (shouldSave) {
        // Saved replay must only cover the portion actually played back during the session
        const actualWatchedDuration = Math.max(10, Math.round(maxWatchedPositionRef.current || currentTime || 10));
        await savePartyReplay(party, actualWatchedDuration);
      }
      await endWatchParty(party.partyId);
      removeLocalJoinedPartyId(party.partyId);
      (window as any).__showFcmToast?.(
        shouldSave ? 'Watch party ended & replay saved.' : 'Watch party ended.',
        'info'
      );
    } catch (err) {
      console.warn('Error ending party:', err);
    } finally {
      setIsSavingReplay(false);
      setShowEndPartyConfirm(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black text-white flex flex-col select-none overflow-hidden font-sans">
      {/* Top Navigation Bar - Reorganized into two rows with consistent spacing */}
      {!isFullscreen && (
        <div className="bg-[var(--bg-main)]/95 backdrop-blur-lg border-b border-white/10 p-4 flex flex-col gap-3.5 shrink-0 z-30">
          {/* Row 1: Show Title + Episode */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#e2b14c]/20 text-[#e2b14c] flex items-center justify-center shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-white leading-tight tracking-wide truncate">
                {party.mediaTitle}
              </h1>
            </div>
          </div>

          {/* Row 2: Sync Status Badge + Party Code Chip + Leave Button */}
          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sync Badge */}
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>IN SYNC</span>
              </span>

              {/* Live viewers Display */}
              {renderViewerAvatars()}

              {/* Party Code Chip */}
              {myUid === party.guestUid ? (
                <span className="text-[10px] font-mono text-[var(--text-muted)] bg-white/5 border border-white/10 px-2 py-1 rounded">
                  GUEST · <span className="font-mono text-[#e2b14c] font-black">{party.roomCode}</span>
                </span>
              ) : (
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-2 py-1 bg-[#e2b14c]/10 hover:bg-[#e2b14c]/20 text-[#e2b14c] font-mono font-black text-[9px] uppercase tracking-wider rounded border border-[#e2b14c]/20 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="View and Share Party Code Info"
                >
                  <Users className="w-2.5 h-2.5" />
                  <span>Party: {party.roomCode}</span>
                </button>
              )}
            </div>

            {/* Action Buttons: Host End Party + Leave */}
            <div className="flex items-center gap-2 shrink-0">
              {isHost && (
                <button
                  onClick={() => setShowEndPartyConfirm(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30 transition-all shrink-0 cursor-pointer active:scale-95"
                  title="End watch party for all viewers"
                >
                  <Power className="w-3 h-3 text-amber-400" />
                  <span>End Party</span>
                </button>
              )}

              <button
                onClick={handleLeaveParty}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider border border-red-500/20 transition-all shrink-0 cursor-pointer active:scale-95"
              >
                <LogOut className="w-3 h-3" />
                <span>Leave</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container - Video + Chat (Separated cleanly by divider borders) */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
        {/* Video Player Container */}
        <div
          ref={playerBoxRef}
          className={`${
            isFullscreen
              ? 'fixed inset-0 z-[100000] bg-black flex flex-col items-center justify-center'
              : 'w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden shrink-0 border-b border-white/10'
          }`}
        >
          {/* Player Media */}
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Host Start Video Button Overlay (works even with 0 other participants!) */}
            {isHost && (!hasStartedPlayback || !isPlaying) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4">
                <button
                  onClick={handleStartPlayback}
                  className="px-6 py-3.5 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95 transition-all border border-amber-300"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Start Video</span>
                </button>
                <p className="text-[11px] font-mono text-white/70 mt-2.5 text-center">
                  {party.viewers && party.viewers.length > 1
                    ? `${party.viewers.length} viewers joined · Start when ready`
                    : 'You are host · You can start anytime'}
                </p>
              </div>
            )}

            {/* Guest Waiting Overlay */}
            {!isHost && (!hasStartedPlayback || !isPlaying) && !needsUserGestureToPlay && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm pointer-events-none select-none p-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 text-center max-w-xs shadow-xl">
                  <div className="w-9 h-9 rounded-full bg-[#e2b14c]/10 text-[#e2b14c] flex items-center justify-center animate-pulse">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <p className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Waiting for Host to Start Video
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono leading-relaxed">
                    Playback will begin automatically once {party.hostName} starts the party.
                  </p>
                </div>
              </div>
            )}

            {/* Guest Autoplay Gesture Fallback Overlay */}
            {!isHost && needsUserGestureToPlay && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm pointer-events-auto p-4">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.play().catch(() => {});
                    }
                    if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
                      ytPlayerRef.current.playVideo();
                    }
                    setNeedsUserGestureToPlay(false);
                  }}
                  className="px-5 py-3 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl active:scale-95 cursor-pointer border border-amber-300"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Tap to Join Playback</span>
                </button>
              </div>
            )}

            {isYoutube && youtubeId ? (
              <div className="relative w-full h-full">
                <iframe
                  id={`youtube-iframe-party-${youtubeId}`}
                  ref={ytIframeRef}
                  src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&controls=0&modestbranding=1&rel=0&origin=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`}
                  className="w-full h-full border-0 pointer-events-auto"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                {/* Overlay blocker for guests to prevent manual touch interruption */}
                {!isHost && (
                  <div className="absolute inset-0 bg-transparent z-10 cursor-not-allowed" />
                )}
              </div>
            ) : (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  src={videoSrc || normalizedVideoUrl}
                  autoPlay={false}
                  playsInline
                  preload="auto"
                  onError={() => {
                    console.warn('Watch party video source failed, falling back to backup trailer URL');
                    setVideoSrc(DEMO_TRAILER_URLS.action);
                  }}
                  onPlay={() => {
                    if (!hasStartedPlayback && isHost) {
                      videoRef.current?.pause();
                      return;
                    }
                    setIsPlaying(true);
                  }}
                  onPause={() => setIsPlaying(false)}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      const dur = videoRef.current.duration || 600;
                      setDuration(dur);
                      // Initial sync for late joiners or rejoiners
                      const calc = calculatePartyCurrentPosition(party.playerState, party, dur);
                      if (calc.hasStarted) {
                        videoRef.current.currentTime = calc.currentPosition;
                        setCurrentTime(calc.currentPosition);
                        setHasStartedPlayback(true);
                        if (calc.isPlaying) {
                          videoRef.current.play().catch(() => {
                            setNeedsUserGestureToPlay(true);
                          });
                          setIsPlaying(true);
                        } else {
                          videoRef.current.pause();
                          setIsPlaying(false);
                        }
                      } else {
                        // Strictly paused until host begins playback
                        videoRef.current.pause();
                        videoRef.current.currentTime = 0;
                        setIsPlaying(false);
                        setHasStartedPlayback(false);
                      }
                    }
                  }}
                  onEnded={() => {
                    handlePlaybackEnded();
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      const t = videoRef.current.currentTime;
                      const dur = videoRef.current.duration || duration;
                      setCurrentTime(t);
                      if (isPlaying) {
                        maxWatchedPositionRef.current = Math.max(maxWatchedPositionRef.current, t);
                      }
                      if (dur > 5 && t >= dur - 0.5) {
                        handlePlaybackEnded();
                      }
                    }
                  }}
                  className="w-full h-full object-contain"
                />
                {/* Overlay blocker for guests to prevent manual touch interruption */}
                {!isHost && (
                  <div className="absolute inset-0 bg-transparent z-10 cursor-not-allowed" />
                )}
              </div>
            )}
          </div>

          {/* Custom Sync Player Overlay Controls */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col gap-2.5 z-10">
            {/* Timeline Bar */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={isHost ? handleSeek : undefined}
              disabled={!isHost}
              className={`w-full h-1 bg-white/20 rounded-lg appearance-none accent-[#e2b14c] ${
                isHost ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 pointer-events-none'
              }`}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Rewind 10s */}
                <button
                  onClick={isHost ? () => handleSkipTime(-10) : undefined}
                  disabled={!isHost}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isHost
                      ? 'bg-white/10 text-white hover:bg-white/20 hover:text-[#e2b14c] cursor-pointer'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                  title={isHost ? 'Rewind 10 seconds' : 'Controlled by Host'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Central Play / Pause */}
                <button
                  onClick={isHost ? handleTogglePlay : undefined}
                  disabled={!isHost}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isHost
                      ? 'bg-[#e2b14c] text-black hover:brightness-110 cursor-pointer'
                      : 'bg-white/10 text-white/50 cursor-not-allowed'
                  }`}
                  title={isHost ? 'Play/Pause' : 'Controlled by Host'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                {/* Host Start Video Button in Controls bar */}
                {isHost && (!hasStartedPlayback || !isPlaying) && (
                  <button
                    onClick={handleStartPlayback}
                    className="px-2.5 py-1 rounded bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow"
                  >
                    <Play className="w-2.5 h-2.5 fill-black" />
                    <span>Start</span>
                  </button>
                )}

                {/* Fast Forward 10s */}
                <button
                  onClick={isHost ? () => handleSkipTime(10) : undefined}
                  disabled={!isHost}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isHost
                      ? 'bg-white/10 text-white hover:bg-white/20 hover:text-[#e2b14c] cursor-pointer'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                  title={isHost ? 'Forward 10 seconds' : 'Controlled by Host'}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                {!isHost && (
                  <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1 select-none">
                    <span>Synced with Host</span>
                  </span>
                )}

                <span className="text-xs font-mono text-white/80">
                  {Math.floor(currentTime / 60)}:
                  {Math.floor(currentTime % 60)
                    .toString()
                    .padStart(2, '0')}{' '}
                  / {Math.floor(duration / 60)}:
                  {Math.floor(duration % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
              </div>

              {/* Right Side Controls: Quality Control + Chat View Toggle + Fullscreen */}
              <div className="flex items-center gap-2">
                {/* Functional Quality Button */}
                <button
                  onClick={() => setIsQualityMenuOpen(true)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 cursor-pointer border border-white/10 font-mono"
                  title="Video Quality Settings"
                >
                  <Settings className="w-3.5 h-3.5 text-[#e2b14c]" />
                  <span>{selectedQuality === 'auto' ? `Auto (${activeEffectiveQuality})` : selectedQuality}</span>
                </button>

                <button
                  onClick={() => setShowChatOverlay((prev) => !prev)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#e2b14c]" />
                  <span>{showChatOverlay ? 'Hide Chat' : 'Show Chat'}</span>
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 cursor-pointer"
                  title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize className="w-3.5 h-3.5 text-[#e2b14c]" />
                      <span>Exit Full Screen</span>
                    </>
                  ) : (
                    <>
                      <Maximize className="w-3.5 h-3.5 text-[#e2b14c]" />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Top Fullscreen Header Overlay (Visible only in Fullscreen) */}
          {isFullscreen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between z-30 pointer-events-auto"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wider shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>IN SYNC</span>
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[200px]">
                  {party.mediaTitle}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowChatOverlay((prev) => !prev)}
                  className="px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3 text-[#e2b14c]" />
                  <span>{showChatOverlay ? 'Hide Chat' : 'Show Chat'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded bg-black/60 backdrop-blur-md border border-white/20 text-white hover:text-[#e2b14c] cursor-pointer"
                  title="Exit Fullscreen"
                >
                  <Minimize className="w-4 h-4 text-[#e2b14c]" />
                </button>
              </div>
            </div>
          )}

          {/* Fullscreen Twitch-Style Transparent Chat Overlay */}
          {isFullscreen && showChatOverlay && (
            <div
              id="twitch-chat-fullscreen-overlay"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="absolute bottom-16 right-2 sm:right-4 z-40 w-[92%] max-w-[320px] max-h-[50vh] flex flex-col justify-end pointer-events-auto select-auto"
            >
              {/* Twitch-style floating transparent messages */}
              <div className="overflow-y-auto max-h-[180px] p-2 flex flex-col gap-1.5 scrollbar-thin">
                {messages.length === 0 ? (
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white/70 text-[11px]">
                    Live party connected. Type a comment below!
                  </div>
                ) : (
                  messages
                    .slice(-12)
                    .map((msg) => {
                      if (msg.type === 'system') {
                        return (
                          <div
                            key={msg.id}
                            className="text-[10px] font-mono text-[#e2b14c]/80 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded self-center border border-white/10"
                          >
                            • {msg.text} •
                          </div>
                        );
                      }
                      const isMe = msg.senderUid === myUid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl text-xs backdrop-blur-md border max-w-[95%] shadow-md ${
                            isMe
                              ? 'ml-auto bg-[#e2b14c]/90 text-black border-amber-300 font-medium'
                              : 'mr-auto bg-black/70 text-white border-white/15'
                          }`}
                        >
                          <span
                            className={`font-bold font-mono text-[10px] shrink-0 ${
                              isMe ? 'text-black/80' : 'text-[#e2b14c]'
                            }`}
                          >
                            {msg.senderName}:
                          </span>
                          <span className="break-words leading-tight">{msg.text}</span>
                        </div>
                      );
                    })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Fullscreen Chat Input Form */}
              <form
                onSubmit={handleSendMessage}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 bg-black/80 backdrop-blur-md rounded-xl border border-white/20 flex items-center gap-1.5 shadow-2xl"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  placeholder="Comment in fullscreen..."
                  className="flex-1 bg-white/15 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white placeholder-white/50 focus:outline-none focus:border-[#e2b14c]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="p-1.5 bg-[#e2b14c] hover:brightness-110 disabled:opacity-40 text-black rounded-lg font-bold transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Live Chat Section (Standard view when not in fullscreen) */}
        {!isFullscreen && showChatOverlay && (
          <div
            className="flex-1 md:w-80 bg-[var(--bg-main)] border-t border-white/10 md:border-t-0 md:border-l border-white/10 flex flex-col min-h-0"
          >
            {/* Chat Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0 font-sans">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <MessageSquare className="w-4 h-4 text-[#e2b14c]" />
                <span>Party Live Chat</span>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 min-h-0">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-[var(--text-muted)] gap-1.5">
                  <Sparkles className="w-6 h-6 opacity-40 text-[#e2b14c]" />
                  <p className="text-xs font-medium">Room connected!</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Type a comment below to chat in real-time.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderUid === myUid;
                  const isSystem = msg.type === 'system';

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="text-[10px] font-mono text-center text-[var(--text-muted)] py-1.5 px-4 my-1 select-none tracking-wide"
                      >
                        • {msg.text} •
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-0.5 max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <span className="text-[10px] text-[var(--text-muted)] font-mono px-1">
                        {msg.senderName}
                      </span>
                      <div
                        className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#e2b14c] text-black font-medium rounded-br-none'
                            : 'bg-white/10 text-white rounded-bl-none border border-white/10'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-2.5 border-t border-white/10 bg-white/5 flex gap-2 shrink-0"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something to your friend..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[#e2b14c]"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 bg-[#e2b14c] hover:brightness-110 disabled:opacity-40 text-black rounded-xl font-bold transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {isInviteModalOpen && mediaItem && (
        <WatchTogetherInviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          media={mediaItem}
          episode={episode}
          existingParty={party}
        />
      )}

      {/* Watch Party Ended Modal Dialog (Save Replay or Exit) */}
      {showPartyEndedModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[1000000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-[var(--bg-main)] border border-[#e2b14c]/40 p-6 rounded-2xl w-full max-w-sm text-center flex flex-col gap-4 shadow-2xl shadow-black">
            <div className="w-12 h-12 rounded-xl bg-[#e2b14c]/15 text-[#e2b14c] flex items-center justify-center mx-auto border border-[#e2b14c]/30">
              <Film className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Watch Party Ended</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                The video playback for <span className="text-white font-semibold">{party.mediaTitle}</span> has finished. Would you like to save this replay and synced chat history to your library?
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => confirmEndParty(true)}
                disabled={isSavingReplay}
                className="w-full min-h-[44px] bg-[#e2b14c] hover:brightness-110 disabled:bg-white/5 disabled:text-[var(--text-muted)] text-black font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-[#e2b14c]/20"
              >
                {isSavingReplay ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Replay...</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Save Replay & Exit</span>
                  </>
                )}
              </button>
              <button
                onClick={() => confirmEndParty(false)}
                disabled={isSavingReplay}
                className="w-full min-h-[44px] border border-white/10 hover:bg-white/5 text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>Exit Without Saving</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit End Watch Party Confirmation Dialog (Host only) */}
      {showEndPartyConfirm && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[1000000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-main)] border border-white/10 p-6 rounded-2xl w-full max-w-sm text-center flex flex-col gap-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <Power className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">End Watch Party?</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Ending this watch party will terminate the live session for all viewers. You can choose to save a replay covering the portion watched ({Math.floor(currentTime / 60)}m {Math.floor(currentTime % 60)}s).
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => confirmEndParty(true)}
                disabled={isSavingReplay}
                className="w-full min-h-[44px] bg-[#e2b14c] hover:brightness-110 disabled:bg-white/5 disabled:text-[var(--text-muted)] text-black font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                {isSavingReplay ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Replay...</span>
                  </>
                ) : (
                  <span>End Party & Save Replay</span>
                )}
              </button>
              <button
                onClick={() => confirmEndParty(false)}
                disabled={isSavingReplay}
                className="w-full min-h-[44px] border border-white/10 hover:bg-white/5 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                End Without Saving
              </button>
              <button
                onClick={() => setShowEndPartyConfirm(false)}
                disabled={isSavingReplay}
                className="w-full min-h-[44px] text-[var(--text-muted)] hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quality Control Bottom Sheet Modal */}
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
