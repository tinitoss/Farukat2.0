import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Info,
  Film,
  Tv,
  X,
  Check,
  Star,
  RotateCcw,
  History,
  Lock,
  Unlock,
  Shield,
  Layers,
  Home,
  Compass,
} from 'lucide-react';
import { UniverseItem, SAGA_INFO_DETAILS } from './UniversesSection';
import { MediaItem, Episode } from '../types';
import { normalizeVideoUrl } from '../utils/mediaUtils';
import { auth } from '../firebase';
import {
  getSagaCompletions,
  markSagaMediaCompleted,
  getSagaItemsForUniverse,
  calculateSagaTotalDuration,
} from '../utils/sagaManager';
import { getVerifiedDuration } from '../utils/durationStore';
import { batchFetchSagaYouTubeDurations } from '../utils/youtubeDurationService';
import { useTranslation } from '../i18n/LanguageContext';

interface SagaViewProps {
  saga: UniverseItem;
  activeCatalog: MediaItem[];
  onBack: () => void;
  onPlayMedia: (media: MediaItem, episode?: Episode) => void;
  onOpenDetail: (media: MediaItem) => void;
  watchlist?: string[];
  onToggleWatchlist?: (id: string) => void;
}

export function getSagaItems(sagaId: string, catalog: MediaItem[]): MediaItem[] {
  return getSagaItemsForUniverse(sagaId, catalog);
}

function getShortDescription(sagaId: string, fallback: string, t: any): string {
  switch (sagaId) {
    case 'dardi-ladi':
      return t('sagas.dardi_ladi_description', undefined, 'The complete chronological saga of BANESA.');
    case 'scifi-saga':
      return t('sagas.scifi_saga_description', undefined, 'An epic interstellar journey across futuristic dimensions and battles.');
    case 'deleted-scenes':
      return t('sagas.deleted_scenes_description', undefined, 'The official vault of rare deleted scenes, alternate cuts, and unseen stories.');
    default:
      return fallback ? fallback.split('.')[0] + '.' : t('sagas.watchCompleteSaga', undefined, 'Watch the complete saga online.');
  }
}

export const SagaView: React.FC<SagaViewProps> = ({
  saga,
  activeCatalog,
  onBack,
  onOpenDetail,
}) => {
  const { t } = useTranslation();
  const topRef = useRef<HTMLDivElement>(null);
  const playerSectionRef = useRef<HTMLDivElement>(null);

  // In-page playback item state
  const [activePlayingItem, setActivePlayingItem] = useState<MediaItem | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);

  // User session details
  const sessionRaw = typeof window !== 'undefined' ? localStorage.getItem('farukat_current_session_v2') : null;
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;
  const userId = auth.currentUser?.uid || session?.uid || 'usr_guest';
  const username = auth.currentUser?.displayName || session?.displayName || 'Cinema Member';
  const avatar = auth.currentUser?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';

  // Saved Watch Progress state for this saga
  const [savedProgress, setSavedProgress] = useState<{ mediaId: string; episodeId?: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('farukat_saga_progress_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed[saga.id] || null;
    } catch {
      return null;
    }
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Completed episode/media item IDs for this saga
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    return getSagaCompletions(saga.id);
  });

  const [lockedToast, setLockedToast] = useState<string | null>(null);
  const [completionToast, setCompletionToast] = useState<{ title: string; message: string } | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const currentSagaInfoDetails = useMemo(() => {
    const detail = SAGA_INFO_DETAILS[saga.id];
    if (detail) {
      if (saga.id === 'dardi-ladi') {
        return {
          ...detail,
          title: t('sagas.dardi_ladi_name', undefined, 'BANESA'),
          subtitle: t('sagas.dardi_ladi_subtitle_detailed', undefined, detail.subtitle),
          overview: t('sagas.dardi_ladi_overview_detailed', undefined, detail.overview),
          pillars: detail.pillars?.map((p, i) => ({
            ...p,
            title: t(`sagas.dardi_ladi_pillar_${i}_title`, undefined, p.title),
            description: t(`sagas.dardi_ladi_pillar_${i}_description`, undefined, p.description),
          })),
        };
      } else if (saga.id === 'scifi-saga') {
        return {
          ...detail,
          title: t('sagas.scifi_saga_name', undefined, 'THE END'),
          subtitle: t('sagas.scifi_saga_subtitle', undefined, detail.subtitle),
          overview: t('sagas.scifi_saga_overview_detailed', undefined, detail.overview),
        };
      } else if (saga.id === 'deleted-scenes') {
        return {
          ...detail,
          title: t('sagas.deleted_scenes_name', undefined, 'Deleted Scenes & Vault'),
          subtitle: t('sagas.deleted_scenes_subtitle', undefined, detail.subtitle),
          overview: t('sagas.deleted_scenes_overview_detailed', undefined, detail.overview),
        };
      }
      return detail;
    }
    return {
      title: saga.name,
      subtitle: saga.subtitle,
      overview: saga.description,
    };
  }, [saga.id, saga.name, saga.subtitle, saga.description, t]);

  // Re-sync saved progress & completions when saga changes or storage updates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawProg = localStorage.getItem('farukat_saga_progress_v1');
      if (rawProg) {
        const parsed = JSON.parse(rawProg);
        setSavedProgress(parsed[saga.id] || null);
      } else {
        setSavedProgress(null);
      }
    } catch {
      setSavedProgress(null);
    }
    setCompletedIds(getSagaCompletions(saga.id));
  }, [saga.id]);

  useEffect(() => {
    const handleSync = () => {
      setCompletedIds(getSagaCompletions(saga.id));
    };
    window.addEventListener('saga_completion_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('saga_completion_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [saga.id]);

  // Mark a media item as completed via centralized sagaManager
  const markAsCompleted = (mediaId: string, mediaTitle?: string) => {
    const res = markSagaMediaCompleted(mediaId, saga.id, mediaTitle, activeCatalog);
    setCompletedIds(res.completions);
    return res;
  };

  const prevSagaIdRef = useRef<string | null>(null);

  // Reset scroll position to 0 ONLY when switching to a DIFFERENT saga
  useEffect(() => {
    if (prevSagaIdRef.current !== null && prevSagaIdRef.current !== saga.id) {
      const forceScrollTop = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;

        const scrollables = document.querySelectorAll(
          '.overflow-y-auto, .overflow-auto, [class*="overflow-y"], main'
        );
        scrollables.forEach((el) => {
          el.scrollTop = 0;
        });
      };

      forceScrollTop();
      const timer = setTimeout(forceScrollTop, 50);
      return () => clearTimeout(timer);
    }
    prevSagaIdRef.current = saga.id;
  }, [saga.id]);

  // Get saga titles in chronological watch order
  const sagaMedia = useMemo(() => {
    return getSagaItems(saga.id, activeCatalog);
  }, [saga.id, activeCatalog]);

  const [durationVerifications, setDurationVerifications] = useState(0);

  // Automatically fetch & verify real YouTube durations for all titles in the saga
  useEffect(() => {
    if (sagaMedia.length > 0) {
      batchFetchSagaYouTubeDurations(sagaMedia).then(() => {
        setDurationVerifications((prev) => prev + 1);
      });
    }

    const handleDurationVerified = () => {
      setDurationVerifications((prev) => prev + 1);
    };

    window.addEventListener('farukat_duration_verified', handleDurationVerified);
    return () => {
      window.removeEventListener('farukat_duration_verified', handleDurationVerified);
    };
  }, [saga.id, sagaMedia]);

  const totalSagaDuration = useMemo(() => {
    return calculateSagaTotalDuration(sagaMedia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sagaMedia, durationVerifications]);

  const firstMedia = sagaMedia[0];
  const activeContentId = activeEpisode ? activeEpisode.id : activePlayingItem?.id;

  // Complete currently active playing item and trigger unlock flow
  const handleCompleteActiveMedia = (targetId?: string) => {
    const mediaToComplete = targetId
      ? sagaMedia.find((m) => m.id === targetId) || activePlayingItem
      : activePlayingItem;

    if (!mediaToComplete) return;
    const currentId = mediaToComplete.id;
    markAsCompleted(currentId, mediaToComplete.title);

    const currentIndex = sagaMedia.findIndex((m) => m.id === currentId);
    const nextItem = sagaMedia[currentIndex + 1];

    if (nextItem) {
      setCompletionToast({
        title: `Part #${String(currentIndex + 1).padStart(2, '0')} Completed!`,
        message: `Part #${String(currentIndex + 2).padStart(2, '0')} (${nextItem.title}) is now unlocked!`,
      });
    } else {
      setCompletionToast({
        title: `Saga Complete!`,
        message: `You have completed all titles in ${saga.name}!`,
      });
    }

    setTimeout(() => {
      setCompletionToast(null);
    }, 4500);
  };

  const rawVideoUrl = activeEpisode?.videoUrl || activePlayingItem?.videoUrl || '';
  const isYoutube = rawVideoUrl.includes('youtube.com') || rawVideoUrl.includes('youtu.be');
  const youtubeId = isYoutube
    ? rawVideoUrl.split('v=')[1]?.split('&')[0] || rawVideoUrl.split('/').pop()
    : null;
  const processedVideoSrc = normalizeVideoUrl(rawVideoUrl, activePlayingItem?.category);

  // YouTube handshake when active item mounts to ensure event communication works
  useEffect(() => {
    if (activePlayingItem && isYoutube) {
      const timer = setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'listening' }),
            '*'
          );
        } catch {
          // ignore
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activePlayingItem, isYoutube]);

  // YouTube & Video Message Event Listener to catch ended event automatically
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== 'object') return;

        // Check Youtube API end state (0 = ENDED)
        const isEnded =
          (data.event === 'infoDelivery' && data.info && data.info.playerState === 0) ||
          (data.event === 'onStateChange' && (data.info === 0 || data.info?.playerState === 0)) ||
          (data.info && data.info.playerState === 0) ||
          data.playerState === 0;

        if (isEnded && activePlayingItem) {
          handleCompleteActiveMedia();
        }
      } catch {
        // ignore errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activePlayingItem, sagaMedia, completedIds]);

  const isDeletedSaga = saga.id === 'deleted-scenes' || saga.id?.includes('deleted');

  // Saved progress target media item & episode
  const continueMediaTarget = useMemo(() => {
    if (sagaMedia.length === 0) return null;

    // 1. Find the first unlocked item that is NOT completed
    const firstUnfinishedIndex = sagaMedia.findIndex((m, idx) => {
      const isComp = completedIds.includes(m.id);
      const isUnl = isDeletedSaga || idx === 0 || completedIds.includes(sagaMedia[idx - 1]?.id) || isComp;
      return isUnl && !isComp;
    });

    let targetItem: MediaItem | undefined;
    if (firstUnfinishedIndex !== -1) {
      targetItem = sagaMedia[firstUnfinishedIndex];
    } else if (savedProgress?.mediaId) {
      targetItem = sagaMedia.find((m) => m.id === savedProgress.mediaId);
    } else {
      targetItem = sagaMedia[0];
    }

    if (!targetItem) return null;

    const episode =
      targetItem.episodes?.find((e) => e.id === savedProgress?.episodeId) ||
      (targetItem.episodes ? targetItem.episodes[0] : undefined);
    const itemIndex = sagaMedia.findIndex((m) => m.id === targetItem!.id);

    return {
      item: targetItem,
      episode,
      orderNum: itemIndex !== -1 ? String(itemIndex + 1).padStart(2, '0') : '01',
      isCompleted: completedIds.includes(targetItem.id),
    };
  }, [savedProgress, sagaMedia, completedIds]);

  // Determine current position and next target in chronological order
  const currentSagaIndex = useMemo(() => {
    if (!activePlayingItem) return -1;
    return sagaMedia.findIndex((m) => m.id === activePlayingItem.id);
  }, [sagaMedia, activePlayingItem]);

  const nextSagaTarget = useMemo(() => {
    if (!activePlayingItem) return null;

    // 1. If active item is a series and has remaining episodes
    if (activePlayingItem.episodes && activePlayingItem.episodes.length > 0 && activeEpisode) {
      const epIndex = activePlayingItem.episodes.findIndex((e) => e.id === activeEpisode.id);
      if (epIndex !== -1 && epIndex < activePlayingItem.episodes.length - 1) {
        const nextEp = activePlayingItem.episodes[epIndex + 1];
        return {
          item: activePlayingItem,
          episode: nextEp,
          title: nextEp.title,
          thumbnail: activePlayingItem.thumbnail || activePlayingItem.poster,
          typeLabel: `NEXT EPISODE`,
        };
      }
    }

    // 2. Otherwise, advance to the next MediaItem in chronological order
    if (currentSagaIndex !== -1 && currentSagaIndex < sagaMedia.length - 1) {
      const nextItem = sagaMedia[currentSagaIndex + 1];
      const nextEp = nextItem.episodes ? nextItem.episodes[0] : undefined;
      return {
        item: nextItem,
        episode: nextEp,
        title: nextItem.title,
        thumbnail: nextItem.thumbnail || nextItem.poster,
        typeLabel: `UP NEXT (PART #${String(currentSagaIndex + 2).padStart(2, '0')})`,
      };
    }

    return null;
  }, [activePlayingItem, activeEpisode, currentSagaIndex, sagaMedia]);

  // Handle playing an item inside this Saga page with Lock enforcement
  const handleSelectMediaToPlay = (media: MediaItem, episode?: Episode) => {
    const mediaIndex = sagaMedia.findIndex((m) => m.id === media.id);
    const isItemCompleted = completedIds.includes(media.id);
    const isItemUnlocked =
      isDeletedSaga || mediaIndex === 0 || completedIds.includes(sagaMedia[mediaIndex - 1]?.id) || isItemCompleted;

    if (!isItemUnlocked && mediaIndex > 0) {
      const prevNum = String(mediaIndex).padStart(2, '0');
      const targetNum = String(mediaIndex + 1).padStart(2, '0');
      setLockedToast(t('sagas.partLockedMessage', { targetNum, prevNum }, `Part #${targetNum} is locked. Finish Part #${prevNum} first!`));
      setTimeout(() => setLockedToast(null), 3500);
      return;
    }

    setActivePlayingItem(media);
    const epToPlay = episode || (media.episodes ? media.episodes[0] : null);
    setActiveEpisode(epToPlay);

    // Persist progress to LocalStorage for this saga
    try {
      const raw = localStorage.getItem('farukat_saga_progress_v1');
      const parsed = raw ? JSON.parse(raw) : {};
      const newProgress = {
        mediaId: media.id,
        episodeId: epToPlay?.id,
        updatedAt: Date.now(),
      };
      parsed[saga.id] = newProgress;
      localStorage.setItem('farukat_saga_progress_v1', JSON.stringify(parsed));
      setSavedProgress(newProgress);
    } catch (e) {
      console.warn('Failed to save saga progress:', e);
    }

    // Scroll smoothly to player section at top
    setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div
      ref={topRef}
      className="min-h-screen bg-[var(--bg-base)] text-white pb-24 w-full animate-fadeIn select-none"
    >
      {/* Locked Episode Toast */}
      {lockedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-[#1a1111] border border-red-500/50 text-white font-bold text-xs shadow-2xl flex items-center gap-3 animate-slideUp max-w-sm w-[90vw]">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-red-400 font-black uppercase text-[10px] tracking-wider">{t('sagas.lockedEpisode', undefined, 'Locked Episode')}</p>
            <p className="text-gray-200 text-xs">{lockedToast}</p>
          </div>
          <button onClick={() => setLockedToast(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Episode Unlocked Toast */}
      {completionToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-[#0f1f18] border border-emerald-500/50 text-white font-bold text-xs shadow-2xl flex items-center gap-3 animate-slideUp max-w-sm w-[90vw]">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg">
            <Check className="w-5 h-5 text-black stroke-[3]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-400 font-black uppercase text-[10px] tracking-wider">{completionToast.title}</p>
            <p className="text-gray-200 text-xs line-clamp-2">{completionToast.message}</p>
          </div>
          <button onClick={() => setCompletionToast(null)} className="p-1 text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 16:9 HERO BANNER (Clean, Fully Visible 16:9 Poster Artwork)    */}
      {/* ============================================================== */}
      {!activePlayingItem && (
        <div className="relative w-full aspect-video bg-[var(--bg-base)] overflow-hidden rounded-b-2xl border-b border-white/10 shadow-2xl">
          {/* 16:9 Poster image - fully visible with no title overlay */}
          <img
            src={saga.bgImage || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1200'}
            alt={saga.name}
            className="w-full h-full object-contain object-center"
            referrerPolicy="no-referrer"
          />

          {/* Simple Icon-Only Back Arrow floating top-left */}
          <button
            onClick={onBack}
            className="absolute top-3 left-3 z-20 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white hover:bg-black flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xl"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Single Info Icon Button floating top-right */}
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-[#e2b14c]/50 text-[#e2b14c] hover:bg-black hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xl min-h-[40px] min-w-[40px] touch-manipulation"
            title="Saga Information"
            aria-label="Saga Information"
          >
            <Info className="w-5 h-5 text-[#e2b14c]" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-4 sm:px-6 max-w-4xl mx-auto space-y-6 pt-4">
        {/* ============================================================== */}
        {/* IN-PAGE VIDEO PLAYER SECTION (When playing a title)            */}
        {/* ============================================================== */}
        {activePlayingItem && (
          <div ref={playerSectionRef} className="space-y-3">
            {/* Header Back Button when player is active — returns to Saga list page, not Home */}
            <div className="flex items-center justify-between pb-2">
              <button
                onClick={() => {
                  setActivePlayingItem(null);
                  setActiveEpisode(null);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/10 text-white text-xs font-bold hover:bg-[#252525] transition cursor-pointer active:scale-95 min-h-[40px] touch-manipulation"
                title={t('sagas.backToSaga', undefined, 'Back to Saga')}
              >
                <ArrowLeft className="w-4 h-4 text-[#e2b14c]" />
                <span>{t('sagas.backToSaga', undefined, 'Back to Saga')}</span>
              </button>

              <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                {t('sagas.sagaPlayer', undefined, 'Saga Player')}
              </span>
            </div>

            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
              {isYoutube && youtubeId ? (
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activePlayingItem.title}
                />
              ) : (
                <video
                  src={processedVideoSrc}
                  controls
                  autoPlay
                  playsInline
                  onEnded={() => handleCompleteActiveMedia()}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Playing Info & Completion Bar */}
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-wider block">
                    {t('sagas.nowPlaying', undefined, 'Now Playing')}
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                    {activePlayingItem.title}
                    {activeEpisode && (
                      <span className="text-gray-400 font-normal ml-2 text-sm">
                        — {activeEpisode.title}
                      </span>
                    )}
                  </h2>
                </div>

                {/* Completion Status Indicator */}
                {completedIds.includes(activePlayingItem.id) && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1.5 shrink-0">
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    <span>{t('sagas.completed', undefined, 'Completed')}</span>
                  </span>
                )}
              </div>

              {/* Clean Video Description Only */}
              {(activeEpisode?.description || activePlayingItem.description) && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {activeEpisode?.description || activePlayingItem.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BELOW HERO: Description & Continue Watching Card               */}
        {/* ============================================================== */}
        {!activePlayingItem && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {saga.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mt-1">
                {getShortDescription(saga.id, saga.subtitle || saga.description, t)}
              </p>
            </div>

            {/* Continue Where You Left Off Banner */}
            {continueMediaTarget ? (
              <div className="p-3.5 rounded-2xl bg-[#121212] border border-[#e2b14c]/50 space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#e2b14c]/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#e2b14c]" />
                    <span>{t('sagas.continueWhereLeft', undefined, 'Continue Where You Left Off')}</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                    {t('sagas.partNum', { num: continueMediaTarget.orderNum }, `Part #${continueMediaTarget.orderNum}`)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    onClick={() => handleSelectMediaToPlay(continueMediaTarget.item, continueMediaTarget.episode)}
                    className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer group border border-white/10 shadow-md"
                  >
                    <img
                      src={continueMediaTarget.item.thumbnail || continueMediaTarget.item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                      alt={continueMediaTarget.item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-[#e2b14c] flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                        <Play className="w-3.5 h-3.5 fill-black ml-0.5 text-black" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white line-clamp-1">
                      {continueMediaTarget.item.title}
                    </h3>
                    {continueMediaTarget.episode && (
                      <p className="text-xs text-[#e2b14c] font-medium line-clamp-1 mt-0.5">
                        {continueMediaTarget.episode.title}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5 leading-tight">
                      {continueMediaTarget.item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSelectMediaToPlay(continueMediaTarget.item, continueMediaTarget.episode)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-black font-mono text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[42px] touch-manipulation active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>{t('sagas.resumePartNum', { num: continueMediaTarget.orderNum }, `Resume Part #${continueMediaTarget.orderNum}`)}</span>
                  </button>

                  {firstMedia && (
                    <button
                      onClick={() => handleSelectMediaToPlay(firstMedia)}
                      className="py-2.5 px-3 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 text-gray-300 hover:text-white font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] touch-manipulation active:scale-95"
                      title={t('sagas.startOver', undefined, 'Start Over')}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                      <span className="hidden sm:inline">{t('sagas.startOver', undefined, 'Start Over')}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              firstMedia && (
                <button
                  onClick={() => handleSelectMediaToPlay(firstMedia)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#e2b14c] hover:brightness-110 text-black font-black font-mono text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[48px] touch-manipulation active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>{t('sagas.startWatching', undefined, 'Start Watching')}</span>
                </button>
              )
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* WATCH ORDER LIST (Strictly horizontal, titles to the side)    */}
        {/* ============================================================== */}
        <div className="pt-2">
          <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>{t('sagas.sagaWatchOrder', { count: sagaMedia.length }, `Saga Watch Order (${sagaMedia.length} titles)`)}</span>
            <span className="text-[#e2b14c]">{t('sagas.totalDuration', { duration: totalSagaDuration }, `Total Duration: ${totalSagaDuration}`)}</span>
          </h2>

          {sagaMedia.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Film className="w-8 h-8 text-gray-600 mx-auto" />
              <p className="text-sm font-bold text-gray-400">{t('sagas.noTitlesFound', undefined, 'No titles found for this Saga.')}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10 border-t border-b border-white/10">
              {sagaMedia.map((item, index) => {
                const orderNum = String(index + 1).padStart(2, '0');
                const isCurrentlyPlaying = activePlayingItem?.id === item.id;
                const isLastWatched = savedProgress?.mediaId === item.id;

                const isCompleted = completedIds.includes(item.id);
                const isUnlocked =
                  isDeletedSaga || index === 0 || completedIds.includes(sagaMedia[index - 1]?.id) || isCompleted;
                const isLocked = !isUnlocked;
                const isNextUp = isUnlocked && !isCompleted;

                return (
                  <div
                    key={item.id}
                    className={`group py-3 flex flex-row items-start gap-3 transition duration-200 ${
                      isCurrentlyPlaying
                        ? 'bg-[#e2b14c]/10 -mx-2 px-2 rounded-xl'
                        : isLastWatched
                        ? 'bg-white/[0.03] -mx-2 px-2 rounded-xl border-l-2 border-[#e2b14c]'
                        : ''
                    }`}
                  >
                    {/* Left: Thumbnail Preview */}
                    <div
                      onClick={() => handleSelectMediaToPlay(item)}
                      className={`relative w-32 sm:w-48 aspect-video rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer transition shadow-md ${
                        isLocked ? 'opacity-60 grayscale-[30%]' : 'group-hover:brightness-110'
                      }`}
                    >
                      <img
                        src={item.thumbnail || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {/* Play / Lock / Check overlay icon */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        {isLocked ? (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/80 border border-white/20 flex items-center justify-center shadow-lg">
                            <Lock className="w-4 h-4 text-gray-300" />
                          </div>
                        ) : isCompleted ? (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 text-black stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#e2b14c] flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black ml-0.5 text-black" />
                          </div>
                        )}
                      </div>

                      {/* Badge Metadata Overlay */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-white uppercase flex items-center gap-1">
                        {item.isSeries ? (
                          <Tv className="w-2.5 h-2.5 text-[#e2b14c]" />
                        ) : (
                          <Film className="w-2.5 h-2.5 text-[#e2b14c]" />
                        )}
                        <span>{item.isSeries ? t('sagas.series', undefined, 'Series') : t('sagas.movie', undefined, 'Movie')}</span>
                      </div>

                      <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono text-gray-300">
                        {getVerifiedDuration(item.id, item.duration || `${item.year}`)}
                      </div>
                    </div>

                    {/* Right: Title & Metadata Details (SIDE BY SIDE) */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch space-y-1">
                      <div>
                        {/* Order Number, Rating & Locking Badge */}
                        <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono mb-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[#e2b14c] font-black uppercase tracking-wider">
                              #{orderNum}
                            </span>
                            {isCompleted ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                                <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                                <span>{t('sagas.completed', undefined, 'Completed')}</span>
                              </span>
                            ) : isNextUp ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#e2b14c]/20 border border-[#e2b14c]/50 text-[#e2b14c] text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                                <Unlock className="w-2.5 h-2.5" />
                                <span>{t('sagas.nextUp', undefined, 'Next Up')}</span>
                              </span>
                            ) : isLocked ? (
                              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>{t('sagas.locked', undefined, 'Locked')}</span>
                              </span>
                            ) : null}
                          </div>
                          <span className="text-gray-400 flex items-center gap-1 font-bold">
                            <Star className="w-3 h-3 text-[#e2b14c] fill-[#e2b14c]" />
                            {item.rating}
                          </span>
                        </div>

                        {/* Title - Beside the video thumbnail */}
                        <h3
                          onClick={() => handleSelectMediaToPlay(item)}
                          className={`text-sm sm:text-base font-black transition cursor-pointer line-clamp-1 leading-snug ${
                            isLocked
                              ? 'text-gray-400 hover:text-white'
                              : 'text-white group-hover:text-[#e2b14c]'
                          }`}
                        >
                          {item.title}
                        </h3>

                        {/* Synopsis */}
                        <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-2 mt-0.5 leading-tight">
                          {item.description}
                        </p>
                      </div>

                      {/* Action Bar: Watch and Details */}
                      <div className="flex items-center gap-1.5 pt-1 shrink-0">
                        {isLocked ? (
                          <button
                            onClick={() => handleSelectMediaToPlay(item)}
                            className="h-[28px] px-2.5 rounded-md bg-white/5 border border-white/10 text-gray-500 font-bold text-[10px] flex items-center gap-1 cursor-not-allowed shrink-0"
                          >
                            <Lock className="w-2.5 h-2.5 text-gray-500" />
                            <span>{t('sagas.locked', undefined, 'Locked')}</span>
                          </button>
                        ) : isCompleted ? (
                          <button
                            onClick={() => handleSelectMediaToPlay(item)}
                            className="h-[28px] px-2.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 font-bold text-[10px] transition flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95 shrink-0"
                          >
                            <Play className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
                            <span>{t('sagas.watch', undefined, 'Watch')}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectMediaToPlay(item)}
                            className="h-[28px] px-2.5 rounded-md bg-[#e2b14c] hover:brightness-110 text-black font-black text-[10px] transition flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95 shrink-0"
                          >
                            <Play className="w-2.5 h-2.5 fill-black text-black" />
                            <span>{t('sagas.watch', undefined, 'Watch')}</span>
                          </button>
                        )}

                        <button
                          onClick={() => onOpenDetail(item)}
                          className="h-[28px] px-2.5 rounded-md bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 text-gray-300 hover:text-white font-medium text-[10px] transition flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95 shrink-0"
                        >
                          <Info className="w-2.5 h-2.5 text-gray-400" />
                          <span>{t('sagas.details', undefined, 'Details')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Saga Info Modal */}
      {isInfoModalOpen && currentSagaInfoDetails && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pb-24 sm:pb-6 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#111111] border border-white/15 rounded-xl max-w-md w-full max-h-[70vh] flex flex-col shadow-2xl overflow-hidden mb-4 sm:mb-0">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-[#161616] shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest block">
                  {t('sagas.sagaDossier', undefined, 'Saga Dossier')}
                </span>
                <h3 className="text-base font-black text-white leading-tight mt-0.5">
                  {currentSagaInfoDetails.title}
                </h3>
                {currentSagaInfoDetails.subtitle && (
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">
                    {currentSagaInfoDetails.subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
                title={t('common.close', undefined, 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Clean Editorial Typography */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-300 leading-relaxed font-sans">
              {/* Overview */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest">
                  <Film className="w-3 h-3" />
                  <span>{t('sagas.overviewLore', undefined, 'Overview & Universe Lore')}</span>
                </div>
                <p className="text-gray-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  {currentSagaInfoDetails.overview}
                </p>
              </div>

              {/* Character Groups (if available) */}
              {currentSagaInfoDetails.characterGroups && currentSagaInfoDetails.characterGroups.length > 0 ? (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest">
                    <Shield className="w-3 h-3" />
                    <span>{t('sagas.charactersEnsemble', undefined, 'Characters & Universe Ensemble')}</span>
                  </div>
                  <div className="space-y-2.5">
                    {currentSagaInfoDetails.characterGroups.map((grp, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-white tracking-tight">
                            {grp.name}
                          </span>
                          {grp.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#e2b14c]/10 text-[#e2b14c] border border-[#e2b14c]/20">
                              {grp.badge}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {grp.characters.map((charName, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300 text-[10px] font-medium"
                            >
                              {charName}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : currentSagaInfoDetails.characters && currentSagaInfoDetails.characters.length > 0 ? (
                <div className="space-y-1.5 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest">
                    <Shield className="w-3 h-3" />
                    <span>{t('sagas.featuredCharacters', undefined, 'Featured Characters')}</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed font-sans">
                    {currentSagaInfoDetails.characters.join(' • ')}
                  </p>
                </div>
              ) : null}

              {/* Connected Sagas & Standalone Pillars (if present) */}
              {currentSagaInfoDetails.pillars && currentSagaInfoDetails.pillars.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest">
                    <Layers className="w-3 h-3" />
                    <span>{t('sagas.connectedSagas', undefined, 'Connected Sagas & Distinct Threads')}</span>
                  </div>
                  <div className="space-y-2">
                    {currentSagaInfoDetails.pillars.map((pillar, pIdx) => (
                      <div key={pIdx} className="p-3 rounded-lg bg-[#151515] border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-white">
                            {pillar.title}
                          </h4>
                          {pillar.tag && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-white/10 text-gray-300">
                              {pillar.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          {pillar.description}
                        </p>
                        {pillar.characters && pillar.characters.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {pillar.characters.map((c, ci) => (
                              <span
                                key={ci}
                                className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-gray-400 font-mono"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronology */}
              {currentSagaInfoDetails.chronologyText && (
                <div className="space-y-1.5 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest">
                    <Compass className="w-3 h-3" />
                    <span>{t('sagas.chronologicalOrder', undefined, 'Chronological Order & Timeline')}</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-line">
                    {currentSagaInfoDetails.chronologyText}
                  </p>
                </div>
              )}

              {/* Climax */}
              {currentSagaInfoDetails.climaxText && (
                <div className="p-3 bg-[#181818] border-l-2 border-[#e2b14c] rounded-r-lg space-y-1.5 mt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#e2b14c] uppercase tracking-widest">
                    <Home className="w-3 h-3 text-[#e2b14c]" />
                    <span>{t('sagas.crossoverBanesa', undefined, 'The Crossover (“Banesa”)')}</span>
                  </div>
                  <p className="text-gray-200 text-xs leading-relaxed">
                    {currentSagaInfoDetails.climaxText}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-white/10 bg-[#161616] flex items-center justify-end shrink-0">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#e2b14c] hover:brightness-110 text-black font-bold text-xs transition cursor-pointer min-h-[40px] touch-manipulation active:scale-95 shadow-md"
              >
                {t('common.close', undefined, 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
