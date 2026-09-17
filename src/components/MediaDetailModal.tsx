import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Plus,
  Check,
  Star,
  ThumbsUp,
  Download,
  Share2,
  ChevronDown,
  X,
  Sparkles,
  Users,
  Calendar,
} from 'lucide-react';
import { WatchTogetherInviteModal } from './WatchTogetherInviteModal';
import confetti from 'canvas-confetti';
import { MediaItem, Episode } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';
import { recordDownloadAction, awardXp, getXpAccount } from '../utils/xpSystem';
import { subscribeToActivePartiesForTitle, subscribeToScheduledPartiesForTitle, joinPublicWatchParty, createWatchPartyByHost, startScheduledPartyLive, toggleInterestInScheduledParty } from '../utils/watchPartyManager';
import { fetchLikesForContent, toggleLikeInDb } from '../utils/sheetdbSocial';
import { isItemInAnySaga } from '../utils/sagaManager';
import { getVerifiedDuration, useVerifiedDuration } from '../utils/durationStore';
import { syncItemYouTubeDuration } from '../utils/youtubeDurationService';
import { auth } from '../firebase';
import { CinematicPoster } from './CinematicPoster';
import { getOptimizedBackdropImageUrl, getOptimizedCardImageUrl } from '../utils/imageOptimizer';
import { useTranslation } from '../i18n/LanguageContext';

interface MediaDetailModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: Episode) => void;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
  likes: string[];
  onToggleLike: (id: string) => void;
  ratings?: Record<string, number>;
  onRate?: (mediaId: string, stars: number) => void;
  downloads?: string[];
  onToggleDownload?: (id: string) => void;
  isGuest?: boolean;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  item,
  onClose,
  onPlay,
  watchlist,
  onToggleWatchlist,
  likes,
  onToggleLike,
  ratings = {},
  onRate,
  downloads = [],
  onToggleDownload,
  isGuest,
}) => {
  const { t } = useTranslation();
  if (!item) return null;

  const [activeTab, setActiveTab] = useState<'episodes' | 'more' | 'bts' | 'details'>(
    item.isSeries && item.episodes && item.episodes.length > 0 ? 'episodes' : 'details'
  );
  const [copiedShare, setCopiedShare] = useState(false);

  // Derive backdrop (16:9) and poster (9:16) with fallbacks for existing single-image titles
  const rawBackdrop = item.backdropImageUrl || item.backdrop || item.posterImageUrl || item.poster || item.thumbnail;
  const backdropSource = getOptimizedBackdropImageUrl(rawBackdrop);
  const posterSource = item.posterImageUrl || item.poster || item.backdropImageUrl || item.backdrop || item.thumbnail;

  // Ratings
  const currentRating = ratings[item.id] || 0;
  const [userRating, setUserRating] = useState<number>(currentRating);
  const isAlreadyRated = currentRating > 0;

  // Downloads simulation
  const isDownloaded = downloads.includes(item.id);
  const [downloading, setDownloading] = useState(false);

  const inWatchlist = watchlist.includes(item.id);
  const isLiked = likes.includes(item.id);
  const isSagaItem = false;
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);

  // Watch party feature detection
  const isWatchPartyHidden = Boolean(
    getXpAccount().stats?.hideWatchParty || getXpAccount().stats?.watchPartyEnabled === false
  );
  const watchPartyEnabled = !isWatchPartyHidden;
  const [activePartiesForTitle, setActivePartiesForTitle] = useState<any[]>([]);
  const [upcomingPartiesForTitle, setUpcomingPartiesForTitle] = useState<any[]>([]);
  const myUid = auth.currentUser?.uid || 'usr_anonymous';

  useEffect(() => {
    if (!item.id || !watchPartyEnabled) {
      setActivePartiesForTitle([]);
      setUpcomingPartiesForTitle([]);
      return;
    }
    const unsubActive = subscribeToActivePartiesForTitle(item.id, (parties) => {
      setActivePartiesForTitle(parties);
    });
    const unsubUpcoming = subscribeToScheduledPartiesForTitle(item.id, (parties) => {
      setUpcomingPartiesForTitle(parties);
    });
    return () => {
      unsubActive();
      unsubUpcoming();
    };
  }, [item.id, watchPartyEnabled]);

  // SheetDB persistent likes
  const [dbLikesCount, setDbLikesCount] = useState<number>(0);
  const [dbUserLiked, setDbUserLiked] = useState<boolean>(isLiked);
  const [isLikeTransitioning, setIsLikeTransitioning] = useState<boolean>(false);

  // Parse active session userId
  const sessionRaw = localStorage.getItem('farukat_current_session_v2');
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;
  const currentAccount = getXpAccount();
  const userId = auth.currentUser?.uid || session?.uid || currentAccount?.profile?.memberId || 'usr_anonymous';

  const activeDuration = useVerifiedDuration(item.id, item.duration);

  React.useEffect(() => {
    if (item.videoUrl && (item.videoUrl.includes('youtube.com') || item.videoUrl.includes('youtu.be'))) {
      syncItemYouTubeDuration(item);
    }
  }, [item.id, item.videoUrl]);

  React.useEffect(() => {
    if (!item) return;
    let isMounted = true;
    async function loadLikes() {
      try {
        const { likesCount, userLiked } = await fetchLikesForContent(item.id, userId);
        if (isMounted) {
          setDbLikesCount(likesCount);
          setDbUserLiked(userLiked);
        }
      } catch (err) {
        console.warn('Failed to load likes in detail modal:', err);
      }
    }
    loadLikes();
    return () => { isMounted = false; };
  }, [item?.id, userId]);

  const handleToggleLikeDb = async () => {
    if (!item) return;
    if (isGuest) {
      alert('Sign in to interact with community features like Likes & Comments.');
      return;
    }
    if (isLikeTransitioning) return;
    setIsLikeTransitioning(true);

    const previousLiked = dbUserLiked;
    const previousCount = dbLikesCount;
    setDbUserLiked(!previousLiked);
    setDbLikesCount((prev) => previousLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      const result = await toggleLikeInDb(item.id, userId);
      setDbUserLiked(result.active);
      setDbLikesCount(result.likesCount);
      onToggleLike(item.id);
    } catch (err) {
      setDbUserLiked(previousLiked);
      setDbLikesCount(previousCount);
    } finally {
      setIsLikeTransitioning(false);
    }
  };

  const handleRate = (stars: number) => {
    if (isAlreadyRated || userRating > 0) return;
    setUserRating(stars);
    if (onRate) {
      onRate(item.id, stars);
    }
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#e2b14c', '#ffffff'],
      });
    } catch {
      // Ignore
    }
  };

  const handleDownload = () => {
    if (isDownloaded) {
      if (onToggleDownload) onToggleDownload(item.id);
      return;
    }
    setDownloading(true);
    setTimeout(() => {
      if (onToggleDownload) onToggleDownload(item.id);
      setDownloading(false);
      recordDownloadAction(downloads.length + 1);
    }, 1200);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${item.title} on FARUKAT Cinema`,
      text: `Stream "${item.title}" on FARUKAT Cinema!`,
      url: window.location.href,
    };
    awardXp('Shared Cinema Title', 15, 'share');
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User dismissed
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const relatedItems = MEDIA_CATALOG.filter(
    (m) => m.id !== item.id && (m.category === item.category || m.originalSection === item.originalSection)
  ).slice(0, 6);

  const btsItems = MEDIA_CATALOG.filter(
    (m) => m.category === 'behind' || m.category === 'deleted'
  ).slice(0, 4);

  return (
    <div
      id="media-detail-modal"
      className="fixed inset-0 z-50 bg-[var(--bg-base)] overflow-y-auto overflow-x-hidden transition-all animate-fadeIn select-none flex flex-col"
    >
      {/* 1. BACKDROP HERO BANNER (16:9 Wide, atmospheric scene) */}
      <div className="relative w-full aspect-[16/9] max-h-[38vh] sm:max-h-[46vh] flex-shrink-0 bg-[var(--bg-base)] overflow-hidden">
        <img
          src={backdropSource}
          alt={item.title}
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80';
          }}
        />

        {/* Ambient dark bottom fade for seamless transition to page canvas */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/70 to-transparent pointer-events-none" />

        {/* Small dark circular back / close button floating in the top corner */}
        <button
          id="detail-modal-close-btn"
          onClick={onClose}
          className="absolute top-3.5 left-3.5 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-black/80 hover:bg-black text-white backdrop-blur-md transition-transform active:scale-90 cursor-pointer border border-white/20 shadow-lg"
          title="Back to Cinema"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* 2. OVERLAPPING POSTER + TITLE & METADATA STACK + CONTENT AREA */}
      <div className="relative z-30 px-4 sm:px-6 -mt-14 sm:-mt-18 pb-16 space-y-4 max-w-2xl mx-auto w-full flex-1">
        
        {/* ROW: Overlapping 9:16 Poster Thumbnail Card + Title & Single Unified Metadata Row */}
        <div className="flex items-end gap-3.5 sm:gap-4">
          
          {/* POSTER CARD (9:16 Portrait, clean drop shadow, rounded corners, sits naturally on backdrop seam) */}
          <div className="relative w-[30%] min-w-[100px] max-w-[130px] aspect-[9/16] rounded-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.85)] border border-white/15 bg-[var(--bg-surface)] flex-shrink-0 z-20">
            <CinematicPoster
              src={posterSource}
              alt={item.title}
              aspectRatioClass="w-full h-full"
              fadeHeightPercent={0}
              priority={true}
              objectFit="contain"
            />
          </div>

          {/* IDENTITY & METADATA STACK NEXT TO POSTER */}
          <div className="flex-1 pb-1 min-w-0 space-y-2">
            {/* Title: dominant visual focal point */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug line-clamp-2 drop-shadow-md">
              {item.title}
            </h1>

            {/* Unified Single-Row Metadata Badges: Match % • Age rating • Quality • Type/Genre • Rating */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-white/70">
              {/* Match Score (Consistent Gold / Amber Accent) */}
              <span className="px-1.5 py-0.5 rounded bg-[#e2b14c]/15 border border-[#e2b14c]/30 text-[#e2b14c] font-black tracking-wide">
                {item.matchScore || 98}% Match
              </span>

              {/* Age / Content Rating */}
              <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white/90 font-bold">
                {item.ageRating || '13+'}
              </span>

              {/* Quality */}
              <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white/90 font-bold">
                {item.quality || '4K'}
              </span>

              {/* Type / Genre */}
              <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white/90 font-bold uppercase tracking-wider">
                {item.isSeries ? t('detailModal.series', undefined, 'Series') : t('detailModal.film', undefined, 'Film')}
              </span>

              {/* Rating Star Badge */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white/90 font-bold">
                <Star className="w-3 h-3 fill-[#e2b14c] text-[#e2b14c]" />
                <span>{item.rating}</span>
              </div>
            </div>

            {/* Release Year & Duration / Episode Count in single quiet secondary row */}
            <div className="flex items-center gap-2 text-[11px] text-white/50 font-medium">
              <span>{item.year}</span>
              <span>•</span>
              <span>{item.isSeries && item.episodes?.length ? t('detailModal.episodesCount', { count: item.episodes.length }, `${item.episodes.length} Episodes`) : activeDuration}</span>
            </div>
          </div>
        </div>

        {/* Active Live Watch Party Banner */}
        {watchPartyEnabled && activePartiesForTitle.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[11px] font-mono font-black text-red-400 uppercase tracking-wider">
                {activePartiesForTitle.reduce((acc, curr) => acc + (curr.viewers?.length || 1), 0)} Watching Now
              </span>
            </div>
            <button
              onClick={async () => {
                const targetParty = activePartiesForTitle[0];
                const res = await joinPublicWatchParty(targetParty.partyId);
                if (res.success && res.partyData) {
                  onClose();
                  if (typeof (window as any).__setActiveWatchParty === 'function') {
                    (window as any).__setActiveWatchParty(res.partyData);
                  }
                } else {
                  alert(res.message || 'Failed to join watch party.');
                }
              }}
              className="px-2.5 py-1 bg-red-500 text-black text-[9px] font-mono font-black uppercase tracking-wider rounded transition-all active:scale-95 cursor-pointer"
            >
              Join Party
            </button>
          </div>
        )}

        {/* Upcoming Scheduled Watch Parties Section */}
        {watchPartyEnabled && upcomingPartiesForTitle.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-black text-white uppercase tracking-tight mb-3 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-[#e2b14c]" />
              Upcoming Sessions
            </h2>
            <div className="space-y-3">
              {upcomingPartiesForTitle.map((p) => {
                const isHost = myUid === p.hostUid;
                const hasInterested = p.interestedUids?.includes(myUid);
                const displayTime = new Date(p.scheduledTime).toLocaleDateString([], {
                  month: 'short', day: 'numeric'
                }) + ' @ ' + new Date(p.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={p.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{displayTime}</p>
                      <p className="text-[10px] text-white/60">Hosted by {p.hostName}</p>
                    </div>
                    {isHost ? (
                      <button
                        onClick={async () => {
                          const res = await createWatchPartyByHost(item, undefined, p.isPublic);
                          if (res.success && res.partyData) {
                            await startScheduledPartyLive(p.id, res.partyData.partyId);
                            onClose();
                            if (typeof (window as any).__setActiveWatchParty === 'function') {
                                (window as any).__setActiveWatchParty(res.partyData);
                            }
                          }
                        }}
                        className="bg-[#e2b14c] text-black text-[10px] font-black uppercase px-2 py-1.5 rounded-lg shrink-0"
                      >
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleInterestInScheduledParty(p.id, !hasInterested)}
                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg shrink-0 ${hasInterested ? 'bg-[#e2b14c]/20 text-[#e2b14c]' : 'bg-white/10 text-white'}`}
                      >
                        {hasInterested ? 'Interested' : 'RSVP'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. PRIMARY ACTION: PROMINENT FULL-WIDTH PLAY BUTTON (Strongest visual action element) */}
        <button
          id="detail-primary-play-btn"
          onClick={() => onPlay(item)}
          className="w-full flex items-center justify-center gap-2.5 h-[52px] px-6 rounded-xl bg-[var(--accent-gold)] hover:brightness-110 text-[var(--text-on-accent)] font-black text-sm tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-[0_4px_24px_rgba(226,177,76,0.35)]"
        >
          <Play className="w-5 h-5 fill-black text-black" />
          <span>{item.isSeries ? t('detailModal.playS1E1', undefined, 'Play S1:E1') : t('detailModal.playTitle', undefined, 'Play Title')}</span>
        </button>

        {/* 4. ACTION BUTTONS ROW (My List, Watch Together, Like, Share) */}
        {!isSagaItem && (
          <div className={`grid gap-2 py-2 px-2 rounded-xl bg-white/[0.03] border border-white/10 ${watchPartyEnabled ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {/* My List */}
            <button
              id="detail-action-watchlist"
              onClick={() => onToggleWatchlist(item.id)}
              className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer min-h-[42px]"
              title={t('detailModal.addToWatchlist', undefined, 'Add to My List')}
            >
              {inWatchlist ? (
                <Check className="w-4 h-4 text-[#e2b14c]" />
              ) : (
                <Plus className="w-4 h-4 text-white/80" />
              )}
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                {inWatchlist ? t('detailModal.inList', undefined, 'In List') : t('detailModal.myList', undefined, 'My List')}
              </span>
            </button>

            {/* Watch Together */}
            {watchPartyEnabled && (
              <button
                id="detail-action-together"
                onClick={() => setIsWatchTogetherOpen(true)}
                className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer min-h-[42px]"
                title={t('detailModal.watchTogether', undefined, 'Watch Together with Friends')}
              >
                <Users className="w-4 h-4 text-[#e2b14c]" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                  {t('detailModal.together', undefined, 'Together')}
                </span>
              </button>
            )}

            {/* Like */}
            <button
              id="detail-action-like"
              onClick={() => {
                if (isGuest) {
                  alert(t('detailModal.guestLikeNotice', undefined, 'Guests cannot like items. Please register.'));
                  return;
                }
                handleToggleLikeDb();
              }}
              disabled={isLikeTransitioning || isGuest}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer min-h-[42px] ${
                isLikeTransitioning ? 'opacity-70 cursor-wait' : ''
              } ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`}
              title={t('detailModal.likeTitle', undefined, 'Like Title')}
            >
              <ThumbsUp
                className={`w-4 h-4 ${
                  dbUserLiked ? 'fill-[#e2b14c] text-[#e2b14c]' : 'text-white/80'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                {dbLikesCount > 0 ? t('detailModal.likesCount', { count: dbLikesCount }, `${dbLikesCount} Likes`) : t('detailModal.like', undefined, 'Like')}
              </span>
            </button>

            {/* Share */}
            <button
              id="detail-action-share"
              onClick={handleShare}
              className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg hover:bg-white/5 transition active:scale-95 cursor-pointer relative min-h-[42px]"
              title={t('detailModal.shareTitle', undefined, 'Share Title')}
            >
              <Share2 className="w-4 h-4 text-white/80" />
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">
                {t('detailModal.share', undefined, 'Share')}
              </span>
              {copiedShare && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#e2b14c] text-black text-[10px] font-bold rounded shadow-lg whitespace-nowrap">
                  {t('detailModal.linkCopied', undefined, 'Link Copied!')}
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
          />
        )}

        {/* 5. SYNOPSIS DESCRIPTION */}
        <p className="text-xs sm:text-sm text-white/75 leading-relaxed font-normal pt-0.5">
          {item.description}
        </p>

        {/* 6. NAVIGATION TABS (Episodes / More Details / Related) */}
        <div className="pt-2">
          <div className="flex items-center gap-6 border-b border-white/10 overflow-x-auto scrollbar-none whitespace-nowrap">
            {item.isSeries && item.episodes && item.episodes.length > 0 && (
              <button
                id="detail-tab-episodes"
                onClick={() => setActiveTab('episodes')}
                className={`pb-3 text-sm font-bold transition-colors relative px-1 cursor-pointer min-h-[40px] flex items-center ${
                  activeTab === 'episodes' ? 'text-white' : 'text-white/40 hover:text-white/80'
                }`}
              >
                {t('detailModal.tabEpisodes', undefined, 'Episodes')}
                {activeTab === 'episodes' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
              </button>
            )}

            <button
              id="detail-tab-details"
              onClick={() => setActiveTab('details')}
              className={`pb-3 text-sm font-bold transition-colors relative px-1 cursor-pointer min-h-[40px] flex items-center ${
                activeTab === 'details' ? 'text-white' : 'text-white/40 hover:text-white/80'
              }`}
            >
              {t('detailModal.tabDetails', undefined, 'More Details')}
              {activeTab === 'details' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
            </button>

            <button
              id="detail-tab-related"
              onClick={() => setActiveTab('more')}
              className={`pb-3 text-sm font-bold transition-colors relative px-1 cursor-pointer min-h-[40px] flex items-center ${
                activeTab === 'more' ? 'text-white' : 'text-white/40 hover:text-white/80'
              }`}
            >
              {t('detailModal.tabRelated', undefined, 'Related')}
              {activeTab === 'more' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
            </button>
          </div>

          {/* TAB 1: EPISODES LIST */}
          {activeTab === 'episodes' && item.episodes && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  {t('detailModal.season1', undefined, 'Season 1')}
                  <ChevronDown className="w-4 h-4 text-white/50" />
                </h3>
              </div>

              <div className="flex flex-col gap-3">
                {item.episodes.map((ep, idx) => (
                  <div
                    key={ep.id || idx}
                    onClick={() => onPlay(item, ep)}
                    className="group flex flex-row gap-3 p-2.5 -mx-1.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer items-center"
                  >
                    {/* Episode Thumbnail */}
                    <div className="relative w-28 sm:w-32 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/15 shadow-md">
                      <img
                        src={getOptimizedCardImageUrl(ep.thumbnail || item.thumbnail, 400)}
                        alt={ep.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 contrast-[1.05] brightness-[1.02] saturate-[1.05]"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=400';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/40 shadow">
                          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-gray-300 transition-colors truncate">
                        <span className="text-white/50 mr-1.5">{idx + 1}.</span>
                        {ep.title}
                      </h4>
                      <span className="text-[10px] font-mono text-white/50 mt-0.5 mb-1 block">
                        {getVerifiedDuration(ep.id, ep.duration)}
                      </span>
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed font-normal">
                        {ep.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CAST & MORE DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-6 text-xs pt-4">
              <div className="space-y-4">
                <div>
                  <span className="text-white/50 block text-[11px] uppercase font-bold tracking-wider mb-1">{t('detailModal.cast', undefined, 'Cast')}</span>
                  <p className="text-white/90 leading-relaxed">
                    {item.cast?.join(', ') || 'Dardi, Ladi, Selajdin, Ramiz, FARUKAT Ensemble'}
                  </p>
                </div>
                <div>
                  <span className="text-white/50 block text-[11px] uppercase font-bold tracking-wider mb-1">{t('detailModal.director', undefined, 'Director')}</span>
                  <p className="text-white/90 leading-relaxed">{item.director || 'FARUKAT Production Team'}</p>
                </div>
                
                {/* User 5-Star Rating Widget */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white block mb-0.5">
                      {isAlreadyRated || userRating > 0 ? t('detailModal.yourRating', undefined, 'Your Rating') : t('detailModal.rateThisTitle', undefined, 'Rate this title')}
                    </span>
                    <span className="text-[10px] text-white/50 block">
                      {isAlreadyRated || userRating > 0
                        ? t('detailModal.youRated', { rating: userRating }, `You rated this ${userRating}/5 Stars (Locked)`)
                        : t('detailModal.earnXpForRating', undefined, 'Earn +15 XP for rating')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        disabled={isAlreadyRated || userRating > 0}
                        onClick={() => handleRate(star)}
                        className={`p-1 transition ${
                          isAlreadyRated || userRating > 0
                            ? 'cursor-not-allowed opacity-90'
                            : 'hover:scale-110 active:scale-95 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center'
                        }`}
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= userRating ? 'fill-[#e2b14c] text-[#e2b14c]' : 'text-white/20'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-white/50 block text-[11px] uppercase font-bold tracking-wider mb-1.5">{t('detailModal.genres', undefined, 'Genres')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags?.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-[11px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-white/50 block text-[11px] uppercase font-bold tracking-wider mb-1">{t('detailModal.audioSubtitles', undefined, 'Audio & Subtitles')}</span>
                  <p className="text-white/90">{item.audioLanguage || t('detailModal.defaultAudioSub', undefined, 'Albanian HQ, English Subtitles')}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RELATED / MORE LIKE THIS */}
          {activeTab === 'more' && (
            <div className="grid grid-cols-2 gap-3 pt-4">
              {relatedItems.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => onPlay(rel)}
                  className="group cursor-pointer space-y-1.5"
                >
                  <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black border border-white/10">
                    <CinematicPoster
                      src={rel.posterImageUrl || rel.poster || rel.backdrop}
                      alt={rel.title}
                      aspectRatioClass="w-full h-full"
                      fadeHeightPercent={0}
                      objectFit="contain"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Play className="w-8 h-8 fill-white text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <h5 className="text-xs font-bold text-white group-hover:text-gray-300 transition-colors line-clamp-1">
                    {rel.title}
                  </h5>
                  <span className="text-[10px] text-white/50 block">{rel.year} • {getVerifiedDuration(rel.id, rel.duration)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
