import { RewardService } from "./utils/rewardService";
import { useTranslation } from './i18n/LanguageContext';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  MediaCategory,
  ActiveTab,
  MediaItem,
  Episode,
  WatchProgress,
  XpAccount,
  PublicMemberProfile,
} from './types';
import { MEDIA_CATALOG, FEATURED_HERO_ITEMS, getMediaByCategory } from './data/mediaData';
import { BottomNav } from './components/BottomNav';
import { HeroBanner } from './components/HeroBanner';
import { MovieRow } from './components/MovieRow';
import { ContinueWatchingRow } from './components/ContinueWatchingRow';
import { BecauseYouWatchedRow } from './components/BecauseYouWatchedRow';
import { MediaDetailModal } from './components/MediaDetailModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { SearchModal } from './components/SearchModal';
import { SeriesView } from './components/SeriesView';
import { MoviesView } from './components/MoviesView';
import { MyListView } from './components/MyListView';
import { BehindTheScenesHub } from './components/BehindTheScenesHub';
import { MembershipCardModal } from './components/MembershipCardModal';
import { Navbar } from './components/Navbar';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { fetchInAppNotifications, subscribeToNotificationUpdates, syncRealActivityNotifications, getLocalCachedNotifications } from './utils/inAppNotificationSystem';
import { AdminView } from './components/AdminView';
import { UniversesSection, UniverseItem } from './components/UniversesSection';
import { SagaView } from './components/SagaView';
import { ShieldCheck, Eye, LogOut } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { FarukatLogo, FarukatRotatingLoader } from './components/FarukatLogo';
import { getManagedCatalog, getCustomSections, SectionConfig, isAdminSession, isAdminEmail, setAdminSession, syncCatalogFromTurso } from './utils/mediaCatalogStore';
import { triggerHaptic } from './utils/haptics';
import { globalSynth } from './utils/audioSynth';
import { XpNotifications } from './components/XpNotifications';
import { FcmToast } from './components/FcmToast';
import { AuthScreen } from './components/AuthScreen';
import { auth, onAuthStateChanged, User } from './firebase';
import {
  getStoredWatchlist,
  toggleStoredWatchlist,
  getStoredLikes,
  toggleStoredLike,
  getWatchHistory,
  getDownloadedIds,
  toggleDownload,
  getUserRatings,
  saveUserRating,
  getActiveUserId,
  clearMediaUtilsCache,
} from './utils/mediaUtils';
import { loadUserDataTable } from './utils/firestoreStorage';
import { getTursoWatchProgressList } from './utils/tursoClient';
import { fetchUserLikes, clearSocialCache } from './utils/sheetdbSocial';
import { useImagePreloader, extractMediaImageUrls } from './utils/imagePreloader';
import {
  getXpAccount,
  subscribeToXpAccount,
  recordDailyLogin,
  recordWatchlistAction,
  recordRatingAction,
  syncXpAccountWithBackend,
  clearXpCache,
} from './utils/xpSystem';
import { initSyncDaemon, getPendingQueue } from './utils/queueManager';
import { syncFirebaseUserToAccount, isFollowing, followMember, unfollowMember, syncCommunityWithBackend } from './utils/memberSystem';
import { AchievementsView } from './components/AchievementsView';
import { LeaderboardView } from './components/LeaderboardView';
import { HistoryView } from './components/HistoryView';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { VerifyCardPage } from './components/VerifyCardPage';
import { WatchPartyInviteToast } from './components/WatchPartyInviteToast';
import { WatchPartyEndedToast } from './components/WatchPartyEndedToast';
import { WatchPartyPlayerModal } from './components/WatchPartyPlayerModal';
import { WatchPartyReplayPlayerModal } from './components/WatchPartyReplayPlayerModal';
import {
  WatchPartyDoc,
  ScheduledWatchPartyDoc,
  SavedWatchPartyDoc,
  WatchPartyMessage,
  subscribeToLivePublicParties,
  subscribeToScheduledParties,
  toggleInterestInScheduledParty,
  joinPublicWatchParty,
  joinWatchPartyByCode,
  cancelScheduledWatchParty,
  createWatchPartyByHost,
  startScheduledPartyLive,
} from './utils/watchPartyManager';
import { JoinWatchPartyModal } from './components/JoinWatchPartyModal';
import { SavedReplaysSection } from './components/SavedReplaysSection';
import { PreviouslyJoinedPartiesBanner } from './components/PreviouslyJoinedPartiesBanner';
import { useFirebaseQuota, resetQuotaExceeded } from './utils/quotaHelper';
import {
  Coins,
  Shield,
  Sparkles,
  Tv,
  Film,
  Star,
  Play,
  Lock,
  ShoppingBag,
  Calendar,
  Check,
} from 'lucide-react';


export interface PageNavState {
  scrollTop: number;
  selectedUniverse?: UniverseItem | null;
  activeCategory?: MediaCategory;
  selectedMedia?: MediaItem | null;
  playingMedia?: MediaItem | null;
  playingEpisode?: Episode | undefined;
}

const getInitialNavStates = (): Record<string, PageNavState> => {
  try {
    const raw = sessionStorage.getItem('farukat_nav_state_v2');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

/**
 * Extracts any requested verification cardId from the URL (Path, Query, or Hash)
 */
const getVerifyCardIdFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  // 1. Direct path: /verify/:cardId
  const path = window.location.pathname;
  const match = path.match(/^\/verify\/(.+)$/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1]).trim();
  }
  // 2. Query param: ?verify=:cardId
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const verifyParam = searchParams.get('verify');
    if (verifyParam) return verifyParam.trim();
  } catch {}

  // 3. Hash: #/verify/:cardId or #verify=:cardId
  try {
    const hash = window.location.hash;
    const hashMatch = hash.match(/#\/?verify\/(.+)$/i);
    if (hashMatch && hashMatch[1]) {
      return decodeURIComponent(hashMatch[1]).trim();
    }
  } catch {}

  return null;
};

export default function App() {
  const { t } = useTranslation();
  const isMarketLocked = useFirebaseQuota();
  
  // Authentication State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Digital Pass Verification & Referral Routing
  const [verifyCardId, setVerifyCardId] = useState<string | null>(getVerifyCardIdFromUrl);
  const [isSigningUpWithRef, setIsSigningUpWithRef] = useState<string | null>(null);
  const [inspectedMember, setInspectedMember] = useState<PublicMemberProfile | null>(null);

  // Persistent Client-Side Navigation State Store
  const initialStatesRef = useRef<Record<string, PageNavState>>(getInitialNavStates());
  const isRestoringScrollRef = useRef<boolean>(false);
  const [pageReloadKeys, setPageReloadKeys] = useState<Record<string, number>>({});

  const initialHomeState = initialStatesRef.current['home'];

  // Navigation State
  const [activeCategory, setActiveCategory] = useState<MediaCategory>(
    initialHomeState?.activeCategory || 'all'
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedUniverse, setSelectedUniverse] = useState<UniverseItem | null>(
    initialHomeState?.selectedUniverse || null
  );

  // Modals & Active Media
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(
    initialHomeState?.selectedMedia || null
  );
  const [playingMedia, setPlayingMedia] = useState<MediaItem | null>(
    initialHomeState?.playingMedia || null
  );
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>(
    initialHomeState?.playingEpisode || undefined
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeWatchParty, setActiveWatchParty] = useState<WatchPartyDoc | null>(null);
  const [isJoinWatchPartyOpen, setIsJoinWatchPartyOpen] = useState(false);
  const [autoFillCode, setAutoFillCode] = useState('');

  // Watch Party Features States
  const [livePublicParties, setLivePublicParties] = useState<WatchPartyDoc[]>([]);
  const [upcomingParties, setUpcomingParties] = useState<ScheduledWatchPartyDoc[]>([]);
  const [savedReplays, setSavedReplays] = useState<SavedWatchPartyDoc[]>([]);

  // Replay playhead states (solo playback mode)
  const [activeReplay, setActiveReplay] = useState<SavedWatchPartyDoc | null>(null);

  // User Local Storage State
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [downloads, setDownloads] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  // Admin App State
  const [isPreviewConsumer, setIsPreviewConsumer] = useState<boolean>(false);
  const isUserAdmin = Boolean(
    currentUser?.email && isAdminEmail(currentUser.email)
  );

  // Hero-to-First-Content-Section Subtle Settle Refs & Logic
  const isGuest = !currentUser || Boolean(currentUser?.isGuest) || currentUser?.uid === 'guest' || Boolean(currentUser?.isAnonymous);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Real-Time XP / Membership State
  const [account, setAccount] = useState<XpAccount>(getXpAccount());
  const [isMembershipOpen, setIsMembershipOpen] = useState(false);

  const isWatchPartyHidden = Boolean(
    account.stats?.hideWatchParty || account.stats?.watchPartyEnabled === false
  );
  const watchPartyEnabled = !isWatchPartyHidden;
  const myUid = currentUser?.uid || account?.profile?.memberId || 'usr_anonymous';

  // In-App Notification Center State
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [targetCommentOptions, setTargetCommentOptions] = useState<{ targetCommentId?: string; isReplying?: boolean }>({});

  // Sync In-App Notifications count
  useEffect(() => {
    let isMounted = true;

    // Fast initial count from cache (0ms)
    try {
      if (myUid) {
        const cached = getLocalCachedNotifications(myUid);
        setUnreadNotificationsCount(cached.unreadCount || 0);
      }
    } catch {}

    const updateCount = async () => {
      try {
        const data = await fetchInAppNotifications(myUid);
        if (isMounted) {
          setUnreadNotificationsCount(data.unreadCount || 0);
        }
      } catch {}
    };

    if (myUid && myUid !== 'guest') {
      syncRealActivityNotifications(myUid).catch(() => {});
    }
    updateCount();

    const unsub = subscribeToNotificationUpdates(() => {
      updateCount();
    });

    // Periodically refresh notifications count every 60 seconds
    const interval = setInterval(updateCount, 60000);
    
    // Periodically sync real activity notifications (e.g., "Continue Watching")
    const activityInterval = setInterval(() => {
        if (myUid && myUid !== 'guest') {
            syncRealActivityNotifications(myUid).catch(() => {});
        }
    }, 3600000); // 1 hour

    return () => {
      isMounted = false;
      unsub();
      clearInterval(interval);
      clearInterval(activityInterval);
    };
  }, [myUid]);

  // Core Central Navigation State & Same-Page Reload Engine
  const handleSelectTab = React.useCallback((nextTab: ActiveTab) => {
    const currentScroll = mainScrollRef.current ? mainScrollRef.current.scrollTop : 0;

    // 1. SAME-PAGE NAVBAR CLICK: Reload & reinitialize the active page cleanly
    if (nextTab === activeTab) {
      triggerHaptic(account, 'light');

      initialStatesRef.current[nextTab] = {
        scrollTop: 0,
        selectedUniverse: null,
        activeCategory: 'all',
        selectedMedia: null,
        playingMedia: null,
        playingEpisode: undefined,
      };
      try {
        sessionStorage.setItem('farukat_nav_state_v2', JSON.stringify(initialStatesRef.current));
      } catch {}

      if (nextTab === 'home') {
        setSelectedUniverse(null);
        setActiveCategory('all');
      }
      setSelectedMedia(null);
      setPlayingMedia(null);
      setPlayingEpisode(undefined);

      isRestoringScrollRef.current = true;
      if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      setPageReloadKeys((prev) => ({
        ...prev,
        [nextTab]: (prev[nextTab] || 0) + 1,
      }));

      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 100);

      return;
    }

    // 2. NAVIGATING TO DIFFERENT PAGE: Save current page state & restore destination page
    triggerHaptic(account, 'light');

    initialStatesRef.current[activeTab] = {
      scrollTop: currentScroll,
      selectedUniverse: activeTab === 'home' ? selectedUniverse : (initialStatesRef.current[activeTab]?.selectedUniverse || null),
      activeCategory: activeTab === 'home' ? activeCategory : (initialStatesRef.current[activeTab]?.activeCategory || 'all'),
      selectedMedia,
      playingMedia,
      playingEpisode,
    };
    try {
      sessionStorage.setItem('farukat_nav_state_v2', JSON.stringify(initialStatesRef.current));
    } catch {}

    const destinationState = initialStatesRef.current[nextTab];

    if (nextTab === 'home') {
      setSelectedUniverse(destinationState?.selectedUniverse || null);
      setActiveCategory(destinationState?.activeCategory || 'all');
    }
    setSelectedMedia(destinationState?.selectedMedia || null);
    setPlayingMedia(destinationState?.playingMedia || null);
    setPlayingEpisode(destinationState?.playingEpisode || undefined);

    setActiveTab(nextTab);
  }, [activeTab, selectedUniverse, activeCategory, selectedMedia, playingMedia, playingEpisode, account]);

  const handleSelectCategory = React.useCallback((cat: MediaCategory) => {
    if (activeTab === 'home' && cat === activeCategory) {
      handleSelectTab('home');
    } else {
      setActiveCategory(cat);
      if (activeTab !== 'home') {
        handleSelectTab('home');
      } else {
        isRestoringScrollRef.current = true;
        if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
        setTimeout(() => { isRestoringScrollRef.current = false; }, 100);
      }
    }
  }, [activeTab, activeCategory, handleSelectTab]);

  const handleSelectUniverse = React.useCallback((universe: UniverseItem | null) => {
    setSelectedUniverse(universe);
    isRestoringScrollRef.current = true;
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    setTimeout(() => {
      isRestoringScrollRef.current = false;
    }, 100);
  }, []);

  // Continuously record scroll position of the active page/tab
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    let timeoutId: any = null;

    const handleScroll = () => {
      if (isRestoringScrollRef.current) return;
      const currentPos = el.scrollTop;

      if (!initialStatesRef.current[activeTab]) {
        initialStatesRef.current[activeTab] = { scrollTop: currentPos };
      } else {
        initialStatesRef.current[activeTab].scrollTop = currentPos;
      }

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.setItem('farukat_nav_state_v2', JSON.stringify(initialStatesRef.current));
        } catch {}
      }, 150);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [activeTab]);

  // Sync state on fullscreen and orientation changes
  useEffect(() => {
    if (activeWatchParty) {
      setPlayingMedia(null);
      setPlayingEpisode(undefined);
    }
  }, [activeWatchParty]);

  // Listen for browser navigation changes (e.g., Back/Forward or verification links)
  useEffect(() => {
    const handleLocationChange = () => {
      setVerifyCardId(getVerifyCardIdFromUrl());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Expose global setActiveWatchParty setter and handle invite URL auto-fills
  useEffect(() => {
    (window as any).__setActiveWatchParty = (party: WatchPartyDoc | null) => {
      if (!watchPartyEnabled) return;
      setActiveWatchParty(party);
    };

    // Parse watch-party route from pathname (e.g. /watch-party/X7K2QP)
    const path = window.location.pathname;
    const match = path.match(/^\/watch-party\/([A-Z0-9]{6})$/i);
    if (match && watchPartyEnabled) {
      const code = match[1].toUpperCase();
      setAutoFillCode(code);
      setIsJoinWatchPartyOpen(true);
      
      // Clear the path instantly to avoid accidental re-joins on refreshes
      window.history.replaceState({}, document.title, window.location.origin);
    }

    return () => {
      delete (window as any).__setActiveWatchParty;
    };
  }, [watchPartyEnabled]);

  // Real-time Firestore subscriptions for Watch Party features
  useEffect(() => {
    if (!watchPartyEnabled) {
      setLivePublicParties([]);
      setUpcomingParties([]);
      setSavedReplays([]);
      return;
    }

    const unsubPublic = subscribeToLivePublicParties((parties) => {
      const now = Date.now();
      const validParties = parties.filter(
        (p) => p.status === 'active' && now - p.createdAt < 12 * 3600 * 1000
      );
      setLivePublicParties(validParties);
    });

    const unsubScheduled = subscribeToScheduledParties((parties) => {
      const now = Date.now();
      const updatedParties = parties.filter((p) => {
        if (p.status === 'upcoming' && now - p.scheduledTime > 30 * 60 * 1000) {
          // Exceeded 30 minutes start window, auto cancel it silently
          cancelScheduledWatchParty(p.id);
          return false;
        }
        return true;
      });
      setUpcomingParties(updatedParties);
    });

    return () => {
      unsubPublic();
      unsubScheduled();
    };
  }, [watchPartyEnabled]);

  // Scheduled Parties notification check
  useEffect(() => {
    if (!watchPartyEnabled || upcomingParties.length === 0) return;

    const notifiedKeys = new Set<string>();

    const checkInterval = setInterval(() => {
      const now = Date.now();
      upcomingParties.forEach((p) => {
        if (p.status !== 'upcoming') return;

        // 10 minutes before
        const tenMinsKey = `${p.id}_ten`;
        if (p.scheduledTime - now > 0 && p.scheduledTime - now <= 10 * 60 * 1000) {
          if (!notifiedKeys.has(tenMinsKey)) {
            notifiedKeys.add(tenMinsKey);
            (window as any).__showFcmToast?.(
              `Upcoming Party: "${p.mediaTitle}" starts in less than 10 minutes!`,
              'info'
            );
          }
        }

        // At start time
        const startKey = `${p.id}_start`;
        if (now >= p.scheduledTime && now - p.scheduledTime <= 2 * 60 * 1000) {
          if (!notifiedKeys.has(startKey)) {
            notifiedKeys.add(startKey);
            (window as any).__showFcmToast?.(
              `Live Now: "${p.mediaTitle}" has started! Join the party room.`,
              'success'
            );
          }
        }
      });
    }, 15000); // Check every 15 seconds

    return () => clearInterval(checkInterval);
  }, [upcomingParties, watchPartyEnabled]);

  // Restore scroll position whenever activeTab changes or page is reloaded
  useLayoutEffect(() => {
    const savedState = initialStatesRef.current[activeTab];
    const targetScroll = savedState?.scrollTop || 0;

    isRestoringScrollRef.current = true;

    const applyScroll = () => {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = targetScroll;
      }
      window.scrollTo(0, targetScroll);
      if (document.documentElement) document.documentElement.scrollTop = targetScroll;
      if (document.body) document.body.scrollTop = targetScroll;
    };

    applyScroll();

    const raf1 = requestAnimationFrame(() => {
      applyScroll();
      const raf2 = requestAnimationFrame(() => {
        applyScroll();
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 100);
      });
      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);
  }, [activeTab, pageReloadKeys[activeTab]]);

  // 1. Restore local session or listen to Firebase Auth state
  useEffect(() => {
    resetQuotaExceeded();
    const stopSyncDaemon = initSyncDaemon();
    syncCommunityWithBackend().catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      localStorage.setItem('pending_referral_code', refParam);
      try {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } catch {}
    }

    const savedSessionRaw = localStorage.getItem('farukat_current_session_v2');
    if (savedSessionRaw) {
      try {
        const savedUser = JSON.parse(savedSessionRaw);
        const uid = savedUser?.uid || 'guest';
        const savedAccount = getXpAccount(uid);
        setCurrentUser(savedUser);
        setAccount(savedAccount);
      } catch {}
    }

    // Safety fallback timer to guarantee app opens within 800ms
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 800);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        setCurrentUser(firebaseUser);
        localStorage.setItem('farukat_current_session_v2', JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isGuest: firebaseUser.isAnonymous,
        }));
        
        // Sync account in background without blocking UI render
        syncFirebaseUserToAccount(firebaseUser).then((syncedAccount) => {
          setAccount(syncedAccount);
          
          if (syncedAccount.stats?.enablePushNotifications) {
            import('./utils/notificationSystem').then(({ initializeFCM }) => {
              initializeFCM().catch(e => console.warn('FCM init failed silently on load:', e));
            });
          }
        }).catch((err) => {
          console.warn('Sync account warning:', err);
        });
      } else {
        const currentStored = localStorage.getItem('farukat_current_session_v2');
        if (currentStored) {
          try {
            const parsed = JSON.parse(currentStored);
            if (parsed?.isGuest) {
              setCurrentUser(parsed);
              setAccount(getXpAccount('guest'));
            } else {
              setCurrentUser(null);
              setAccount(getXpAccount('guest'));
            }
          } catch {
            setCurrentUser(null);
            setAccount(getXpAccount('guest'));
          }
        } else {
          setCurrentUser(null);
          setAccount(getXpAccount('guest'));
        }
      }
      setAuthLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      stopSyncDaemon();
    };
  }, []);

  // 2. Load cached records & subscribe to account changes
  useEffect(() => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || null;

    // Force-clear in-memory social cache (likes/comments) to prevent stale data from previous accounts
    clearSocialCache();

    if (activeUid && activeUid !== 'guest') {
      RewardService.processDailyLogin(activeUid).catch(console.error);
    }

    if (!activeUid || activeUid === 'guest') {
      setWatchlist([]);
      setLikes([]);
      setHistory([]);
      setDownloads([]);
      setRatings({});
      return;
    }

    // Initial fast local load for this specific UID
    setWatchlist(getStoredWatchlist(activeUid));
    setLikes(getStoredLikes(activeUid));
    setHistory(getWatchHistory(activeUid));
    setDownloads(getDownloadedIds(activeUid));
    setRatings(getUserRatings(activeUid));

    // Force-reload fresh user likes from Firebase on account switch
    fetchUserLikes().then((likesData) => {
      if (likesData && Array.isArray(likesData) && likesData.length > 0) {
        setLikes(likesData);
        localStorage.setItem(`farukat_likes_${activeUid}`, JSON.stringify(likesData));
      }
    }).catch(console.warn);

    // Deep sync with Firestore for this authenticated user
    const sessionSyncKey = `farukat_sync_v2_${activeUid}`;
    const hasSyncedThisSession = sessionStorage.getItem(sessionSyncKey);

    if (!hasSyncedThisSession) {
      const loadUserData = async () => {
        sessionStorage.setItem(sessionSyncKey, 'true');
        
        // Check daily streak and login bonus ONLY ONCE during deep sync
        recordDailyLogin(activeUid);

        try {
          const [watchlistsData, likesData, historyData, downloadsData, ratingsData] = await Promise.all([
            loadUserDataTable('watchlists', activeUid, { mediaIds: [] }),
            fetchUserLikes(),
            loadUserDataTable('history', activeUid, { history: [] }),
            loadUserDataTable('downloads', activeUid, { downloads: [] }),
            loadUserDataTable('ratings', activeUid, { ratings: {} })
          ]);
          
          if (watchlistsData && (watchlistsData as any).mediaIds && (watchlistsData as any).mediaIds.length > 0) {
            setWatchlist((watchlistsData as any).mediaIds);
            localStorage.setItem(`farukat_watchlist_${activeUid}`, JSON.stringify((watchlistsData as any).mediaIds));
          }
          if (likesData && Array.isArray(likesData) && likesData.length > 0) {
            setLikes(likesData);
            localStorage.setItem(`farukat_likes_${activeUid}`, JSON.stringify(likesData));
          }
          if (historyData && (historyData as any).history && (historyData as any).history.length > 0) {
            setHistory((historyData as any).history);
            localStorage.setItem(`farukat_history_${activeUid}`, JSON.stringify((historyData as any).history));
          }
          if (downloadsData && (downloadsData as any).downloads && (downloadsData as any).downloads.length > 0) {
            setDownloads((downloadsData as any).downloads);
            localStorage.setItem(`farukat_downloads_${activeUid}`, JSON.stringify((downloadsData as any).downloads));
          }
          if (ratingsData && (ratingsData as any).ratings && Object.keys((ratingsData as any).ratings).length > 0) {
            setRatings((ratingsData as any).ratings);
            localStorage.setItem(`farukat_ratings_${activeUid}`, JSON.stringify((ratingsData as any).ratings));
          }

          // Restore watch progress records from Turso to populate LocalStorage and Continue Watching list
          const watchProgressListRes = await getTursoWatchProgressList().catch(() => null);
          if (watchProgressListRes && Array.isArray(watchProgressListRes.list)) {
            const list = watchProgressListRes.list;
            const updatedHistoryItems: WatchProgress[] = [];

            list.forEach((item: any) => {
              const videoId = item.content_id;
              const localKey = `farukat_watch_prog_${activeUid}_${videoId}`;
              const progressPct = item.duration_seconds > 0 ? (item.progress_seconds / item.duration_seconds) * 100 : 0;
              
              let mediaTitle = 'Cinema Title';
              let mediaThumbnail = '';
              let episodeTitle: string | undefined = undefined;
              let episodeId: string | undefined = undefined;
              let mediaId = videoId;

              // Find metadata in catalog
              for (const m of MEDIA_CATALOG) {
                if (m.id === videoId) {
                  mediaTitle = m.title;
                  mediaThumbnail = m.thumbnail;
                  mediaId = m.id;
                  break;
                }
                if (m.episodes) {
                  const ep = m.episodes.find((e) => e.id === videoId);
                  if (ep) {
                    mediaTitle = m.title;
                    mediaThumbnail = ep.thumbnail || m.thumbnail;
                    episodeTitle = ep.title;
                    episodeId = ep.id;
                    mediaId = m.id;
                    break;
                  }
                }
              }

              const cloudDoc = {
                videoId,
                currentPositionSeconds: item.progress_seconds,
                totalWatchTimeSeconds: item.progress_seconds,
                videoDurationSeconds: item.duration_seconds,
                progressPercentage: progressPct,
                completed: !!item.completed,
                lastWatchedAt: item.last_watched_at ? new Date(item.last_watched_at).getTime() : Date.now(),
                mediaTitle,
                mediaThumbnail,
                episodeTitle,
                episodeId,
                mediaId,
              };

              const rawLocal = localStorage.getItem(localKey);
              if (!rawLocal) {
                localStorage.setItem(localKey, JSON.stringify(cloudDoc));
              } else {
                try {
                  const local = JSON.parse(rawLocal);
                  if (cloudDoc.lastWatchedAt > (local.lastWatchedAt || 0)) {
                    localStorage.setItem(localKey, JSON.stringify(cloudDoc));
                  }
                } catch {}
              }

              if (!cloudDoc.completed && cloudDoc.videoDurationSeconds > 0) {
                updatedHistoryItems.push({
                  mediaId: cloudDoc.mediaId,
                  episodeId: cloudDoc.episodeId,
                  currentTime: cloudDoc.currentPositionSeconds,
                  duration: cloudDoc.videoDurationSeconds,
                  lastWatchedAt: cloudDoc.lastWatchedAt,
                  completed: cloudDoc.completed,
                  mediaTitle: cloudDoc.mediaTitle,
                  mediaThumbnail: cloudDoc.mediaThumbnail,
                  episodeTitle: cloudDoc.episodeTitle,
                });
              }
            });

            if (updatedHistoryItems.length > 0) {
              const historyKey = `farukat_history_${activeUid}`;
              const rawHistory = localStorage.getItem(historyKey);
              let localHistory: WatchProgress[] = rawHistory ? JSON.parse(rawHistory) : [];

              updatedHistoryItems.forEach((cloudItem) => {
                const existingIdx = localHistory.findIndex(
                  (lh) => lh.mediaId === cloudItem.mediaId && lh.episodeId === cloudItem.episodeId
                );
                if (existingIdx >= 0) {
                  if (cloudItem.lastWatchedAt > (localHistory[existingIdx].lastWatchedAt || 0)) {
                    localHistory[existingIdx] = cloudItem;
                  }
                } else {
                  localHistory.push(cloudItem);
                }
              });

              localHistory.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
              localHistory = localHistory.slice(0, 30);

              setHistory(localHistory);
              localStorage.setItem(historyKey, JSON.stringify(localHistory));
            }
          }

          // Recalculate local stats so state of membership, watch hours, achievements is updated and correct immediately
          setAccount(getXpAccount(activeUid));
        } catch (e) {
          console.error(`Error loading user data from Firebase:`, e);
        }
      };
      loadUserData();
    }

    // Subscribe to XP changes for this active user
    const unsubscribeXp = subscribeToXpAccount((updated) => {
      setAccount(updated);
    }, activeUid);

    const handleHistoryUpdateEvent = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setHistory(e.detail);
      } else if (activeUid) {
        setHistory(getWatchHistory(activeUid));
      }
    };

    window.addEventListener('farukat_history_updated', handleHistoryUpdateEvent);

    return () => {
      unsubscribeXp();
      window.removeEventListener('farukat_history_updated', handleHistoryUpdateEvent);
    };
  }, [currentUser?.uid]);

  const handleAuthSuccess = async (user: any, userAccount?: XpAccount) => {
    const uid = user.uid || user.id || 'guest';
    let activeAccount = userAccount;
    if (!activeAccount) {
      activeAccount = await syncFirebaseUserToAccount(user);
    }
    setAccount(activeAccount);
    setCurrentUser(user);
    localStorage.setItem('farukat_current_session_v2', JSON.stringify({
      uid,
      email: user.email,
      displayName: user.displayName || user.name || activeAccount?.profile?.name,
      isGuest: !!user.isGuest,
    }));
    setActiveTab('home');

    // Associate OneSignal user
    import('react-onesignal').then(({ default: OneSignal }) => {
      OneSignal.login(uid);
    });
  };

  const handleSignOut = () => {
    // Disassociate OneSignal user
    import('react-onesignal').then(({ default: OneSignal }) => {
      OneSignal.logout();
    });

    localStorage.removeItem('farukat_current_session_v2');
    sessionStorage.removeItem('farukat_current_session_v2');
    
    // Clear only session keys, keeping persistent account data safe
    if (typeof window !== 'undefined') {
      const sessionKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('farukat_')) {
          sessionKeys.push(key);
        }
      }
      sessionKeys.forEach((k) => sessionStorage.removeItem(k));
    }
    clearXpCache();
    clearMediaUtilsCache();
    clearSocialCache();
    auth.signOut().catch(() => {});
    setCurrentUser(null);
    setAccount(getXpAccount('guest'));
    setWatchlist([]);
    setLikes([]);
    setHistory([]);
    setDownloads([]);
    setRatings({});
  };

  const handleToggleWatchlist = React.useCallback((id: string) => {
    triggerHaptic(account, 'light');
    setWatchlist((prev) => {
      const updated = toggleStoredWatchlist(id, prev);
      recordWatchlistAction(updated.length, updated.includes(id), id);
      return updated;
    });
  }, [account]);

  const handleToggleLike = React.useCallback((id: string, skipDbSync = false) => {
    triggerHaptic(account, 'light');
    setLikes((prev) => toggleStoredLike(id, prev, undefined, skipDbSync));
  }, [account]);

  const handleToggleDownload = React.useCallback((id: string) => {
    triggerHaptic(account, 'medium');
    setDownloads((prev) => toggleDownload(id, prev));
  }, [account]);

  const handleRateMedia = React.useCallback((mediaId: string, stars: number) => {
    triggerHaptic(account, 'medium');
    setRatings((prev) => {
      const updated = saveUserRating(mediaId, stars, prev);
      recordRatingAction(Object.keys(updated).length, undefined, mediaId);
      return updated;
    });
  }, [account]);

  const handlePlayMedia = React.useCallback((item: MediaItem, episode?: Episode) => {
    triggerHaptic(account, 'medium');
    setPlayingMedia(item);
    setPlayingEpisode(episode || (item.episodes && item.episodes.length > 0 ? item.episodes[0] : undefined));
    setSelectedMedia(null);
  }, [account]);

  // Dynamic Managed Catalog & Custom Ranked Sections
  const [activeCatalog, setActiveCatalog] = useState<MediaItem[]>(() => getManagedCatalog(MEDIA_CATALOG));
  const [customSections, setCustomSections] = useState<SectionConfig[]>(() => getCustomSections());

  // Home Screen Preload & Splash Screen States
  const [showSplash, setShowSplash] = useState(() => {
    try {
      const shown = sessionStorage.getItem('farukat_home_splash_shown_session');
      return !shown;
    } catch {
      return true;
    }
  });
  const [splashFadeOut, setSplashFadeOut] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);

  // Home Screen Image Preload Effect
  useEffect(() => {
    if (!showSplash) return;

    let active = true;
    setIsPreloading(true);

    const getPreloadImagesList = () => {
      const list: string[] = [];
      
      // 1. Featured rotating hero carousel images (HeroBanner)
      if (Array.isArray(FEATURED_HERO_ITEMS)) {
        FEATURED_HERO_ITEMS.forEach(item => {
          if (item.backdrop) list.push(item.backdrop);
          if (item.poster) list.push(item.poster);
          if (item.thumbnail) list.push(item.thumbnail);
        });
      }
      
      // 2. Universes background images
      const universeBgImages = [
        'https://i.postimg.cc/N0N574Xt/file-00000000bc2c81f4869e8118fdbca30e.png',
        'https://i.postimg.cc/cJkFn4pB/file-0000000081d481f489daa25eee83bdd4.png',
        'https://i.postimg.cc/tJs0069q/file-00000000e32881f4a11bcd855d37478c.png'
      ];
      universeBgImages.forEach(img => list.push(img));

      // 3. User Avatar
      if (account?.profile?.avatarUrl) {
        list.push(account.profile.avatarUrl);
      }

      // 4. Initial catalog items' posters for movie rows (first 4 items for each custom section)
      if (Array.isArray(customSections)) {
        customSections.forEach(sec => {
          const secItems = MEDIA_CATALOG.filter(
            (m) =>
              !m.isHidden &&
              (m.category === sec.id ||
                m.originalSection === sec.id ||
                (sec.id === 'series' && (m.isSeries || m.category === 'series' || m.originalSection === 'featured-series')) ||
                (sec.id === 'scifi' && (m.originalSection === 'scifi-collection' || (m.category === 'scifi' && m.originalSection !== 'the-end-saga'))) ||
                (sec.id === 'horror' && (m.category === 'horror' || m.originalSection === 'horror' || m.originalSection === 'horror-specials')) ||
                (sec.id === 'skits' && (m.category === 'skits' || m.originalSection === 'funny-skits')) ||
                (sec.id === 'behind' && (m.category === 'behind' || m.category === 'deleted' || m.originalSection === 'behind-scenes' || m.originalSection === 'deleted-scenes')) ||
                (sec.id === 'specials' && (m.category === 'specials' || m.originalSection === 'special-features')))
          ).slice(0, 4);

          secItems.forEach(item => {
            if (item.poster) list.push(item.poster);
            if (item.thumbnail) list.push(item.thumbnail);
          });
        });
      }

      return Array.from(new Set(list.filter(Boolean)));
    };

    const preloadImage = (url: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    };

    const imageUrls = getPreloadImagesList();

    const startPreloading = async () => {
      // 2.5 second fallback timeout as requested
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2500));
      const preloadingPromise = Promise.all(imageUrls.map(preloadImage));

      await Promise.race([preloadingPromise, timeoutPromise]);

      if (active) {
        setSplashFadeOut(true);
        setTimeout(() => {
          if (active) {
            setShowSplash(false);
            setIsPreloading(false);
            try {
              sessionStorage.setItem('farukat_home_splash_shown_session', 'true');
            } catch {}
          }
        }, 700); // Wait for transition fade out to complete before removing from DOM
      }
    };

    startPreloading();

    return () => {
      active = false;
    };
  }, [showSplash, account?.profile?.avatarUrl, customSections]);

  // Deep-link from In-App Notifications directly into video player with comment focused
  const handleNotificationNavigateToContent = React.useCallback(
    (contentId: string, options?: { targetCommentId?: string; isReplying?: boolean }) => {
      const found =
        activeCatalog.find((m) => m.id === contentId) ||
        MEDIA_CATALOG.find((m) => m.id === contentId);
      if (found) {
        setTargetCommentOptions(options || {});
        setPlayingMedia(found);
        setPlayingEpisode(
          found.episodes && found.episodes.length > 0 ? found.episodes[0] : undefined
        );
        setSelectedMedia(null);
      }
    },
    [activeCatalog]
  );

  useEffect(() => {
    const handleUpdate = () => {
      setActiveCatalog(getManagedCatalog(MEDIA_CATALOG));
      setCustomSections(getCustomSections());
    };
    window.addEventListener('farukat_catalog_updated', handleUpdate);
    return () => window.removeEventListener('farukat_catalog_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (account?.stats?.enableCinematicAudio) {
      globalSynth.playTrack('epic-cinematic');
    } else {
      globalSynth.stop();
    }
  }, [account?.stats?.enableCinematicAudio]);

  // Full catalog for general Home page rows and standard views (shows all items including sagas)
  const fullVisibleCatalog = React.useMemo(() => activeCatalog.filter(m => !m.isHidden), [activeCatalog]);

  // Pre-computed Section collections to avoid recalculation on re-renders
  const featuredSeries = React.useMemo(() => activeCatalog.filter((m) => !m.isHidden && (m.originalSection === 'featured-series' || m.isSeries || m.category === 'series')), [activeCatalog]);
  const scifiCollection = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'scifi-collection' || (m.category === 'scifi' && m.originalSection !== 'the-end-saga')), [fullVisibleCatalog]);
  const horrorSpecials = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'horror-specials' || m.category === 'horror'), [fullVisibleCatalog]);
  const funnySkits = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'funny-skits' || m.category === 'skits'), [fullVisibleCatalog]);
  const behindScenes = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'behind-scenes' || m.category === 'behind'), [fullVisibleCatalog]);
  const deletedScenes = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'deleted-scenes' || m.category === 'deleted'), [fullVisibleCatalog]);
  const specialFeatures = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'special-features' || m.category === 'specials'), [fullVisibleCatalog]);
  const horrorCollection = React.useMemo(() => fullVisibleCatalog.filter((m) => m.originalSection === 'horror' || m.category === 'horror'), [fullVisibleCatalog]);
  const makingOfCombined = React.useMemo(() => [...behindScenes, ...deletedScenes], [behindScenes, deletedScenes]);

  // Filtered list when category filter from Navbar is clicked
  const filteredCategoryItems = React.useMemo(() => (
    activeCategory === 'all'
      ? null
      : fullVisibleCatalog.filter(m => m.category === activeCategory || m.originalSection === activeCategory)
  ), [activeCategory, fullVisibleCatalog]);

  // Preload priority images for the first items across visible sections to eliminate initial scroll flicker
  const initialPriorityImages = React.useMemo(() => {
    const topItems = [
      ...featuredSeries.slice(0, 4),
      ...scifiCollection.slice(0, 4),
      ...horrorSpecials.slice(0, 4),
      ...funnySkits.slice(0, 4),
    ];
    return topItems.flatMap(extractMediaImageUrls);
  }, [featuredSeries, scifiCollection, horrorSpecials, funnySkits]);
  useImagePreloader(initialPriorityImages);


  // Public QR Pass Verification Route (No Auth Wall)
  if (verifyCardId) {
    return (
      <VerifyCardPage
        cardId={verifyCardId}
        currentUser={currentUser}
        onSignUpWithRef={(refCardId) => {
          setIsSigningUpWithRef(refCardId);
          setVerifyCardId(null);
          try {
            localStorage.setItem('farukat_referral_ref', refCardId);
            window.history.pushState(null, '', `/?ref=${encodeURIComponent(refCardId)}`);
          } catch {}
        }}
        onViewMemberProfile={(member) => {
          setInspectedMember(member);
          setVerifyCardId(null);
          try {
            window.history.pushState(null, '', '/');
          } catch {}
        }}
        onGoToApp={() => {
          setVerifyCardId(null);
          try {
            window.history.pushState(null, '', '/');
          } catch {}
        }}
      />
    );
  }

  // Referral Registration Flow (User clicked Sign Up from verification page)
  if (isSigningUpWithRef && !currentUser) {
    return (
      <AuthScreen
        onAuthSuccess={(user, acc) => {
          setIsSigningUpWithRef(null);
          handleAuthSuccess(user, acc);
        }}
        initialMode="register"
        initialRef={isSigningUpWithRef}
      />
    );
  }

  // Authentication Loading Screen (Pure CSS Minimal Spinner)
  if (authLoading) {
    return <FarukatRotatingLoader message="Loading" />;
  }

  // If not authenticated -> show real Firebase Auth Screen
  if (!currentUser) {
    return (
      <AuthScreen
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  // Dedicated Admin Control App Interface for Admin Users (altinberisha434@gmail.com / altinberisha434@gnail.com)
  if (isUserAdmin && !isPreviewConsumer) {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#080808] text-[var(--text-primary)] font-sans select-none flex flex-col">
        {/* Dedicated Admin Portal Header */}
        <header className="sticky top-0 z-40 bg-[#0e0e0e]/95 backdrop-blur-xl border-b border-[#222] px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-2xl w-full max-w-full overflow-x-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div id="admin-header-welcome" className="flex items-center min-w-0 py-1">
              <span className="text-sm sm:text-base font-medium text-[var(--text-secondary)] shrink-0 mr-1.5">
                {t('common.welcome', undefined, 'Welcome')}
              </span>
              <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate max-w-[140px] sm:max-w-none">
                {account?.profile?.name && account.profile.name !== 'Cinema Member' && account.profile.name !== 'Guest Cinephile'
                  ? account.profile.name
                  : (currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Admin'))}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-[#222] pl-3">
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#e2b14c]/20 text-[#e2b14c] border border-[#e2b14c]/40 uppercase tracking-widest">
                ADMIN CONTROL HUB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline text-xs font-mono text-[#e2b14c] bg-[#e2b14c]/10 px-2.5 py-1 rounded-full border border-[#e2b14c]/20">
              {currentUser?.email || 'altinberisha434@gmail.com'}
            </span>

            <button
              onClick={() => setIsPreviewConsumer(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Preview Consumer Player UI"
            >
              <Eye className="w-3.5 h-3.5 text-[#e2b14c]" />
              <span className="text-[11px] sm:text-xs">Preview</span>
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl bg-[#1a1a1a] hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
              title="Sign Out Admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dedicated Admin Dashboard */}
        <main className="flex-1 w-full max-w-full overflow-x-hidden p-2 sm:p-4">
          <AdminView
            currentUserEmail={currentUser?.email || 'altinberisha434@gmail.com'}
            onSelectMedia={(item) => setSelectedMedia(item)}
            onPreviewConsumer={() => setIsPreviewConsumer(true)}
          />
        </main>
      </div>
    );
  }

  return (
    <div 
      className={`relative h-screen w-full overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] font-sans select-none ${account?.stats?.enableHighContrast ? 'high-contrast-mode' : ''} ${account?.stats?.enableLightMode ? 'light-mode' : ''}`}
    >
      {/* 2.7.1 Gold Splash Preloader Screen */}
      {showSplash && (
        <div
          id="home-splash-screen"
          className={`fixed inset-0 z-[9999] bg-[#E2B14C] text-black flex flex-col items-center justify-between p-12 transition-all duration-700 ease-in-out select-none ${
            splashFadeOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          {/* Top section: subtle spacing / Branding Icon */}
          <div className="w-full flex justify-center pt-8">
            <FarukatLogo size="lg" textColor="text-black" variant="white" showText={false} useFullImage={false} />
          </div>

          {/* Middle Section: Elegant Welcoming Message with High Contrast Display Typography */}
          <div className="text-center space-y-3.5 px-4 animate-fadeIn">
            <div className="inline-flex p-3 rounded-full bg-black/10 border border-black/15 shadow-sm">
              <ShieldCheck className="w-8 h-8 text-black stroke-[1.5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase font-mono max-w-sm mx-auto leading-tight">
              {t('common.welcomeBackUser', { name: account?.profile?.name || 'Cinephile' }, `Welcome back, ${account?.profile?.name || 'Cinephile'}`)}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-black/60 font-mono font-bold">
              {t('common.appName', undefined, 'FARUKAT Cinema')} • {t('common.guest', undefined, 'Verified Member')}
            </p>
          </div>

          {/* Bottom Section: Sleek CSS Loader & preloading progress info */}
          <div className="w-full flex flex-col items-center gap-4 pb-8">
            {/* Smooth animated spinner wheel */}
            <div className="w-10 h-10 rounded-full border-[3px] border-black border-t-transparent animate-spin opacity-85" />
            <span className="text-[10px] uppercase tracking-wider text-black/50 font-mono font-black animate-pulse">
              {t('common.loading', undefined, 'PRELOADING CINEMA EXPERIENCE...')}
            </span>
          </div>
        </div>
      )}

      {/* Scrollable Main Viewport */}
      <div
        ref={mainScrollRef}
        className="h-full w-full overflow-y-auto overflow-x-hidden pb-28"
      >
        {/* Admin Consumer Preview Sticky Top Bar */}
      {isUserAdmin && isPreviewConsumer && (
        <div className="bg-[#e2b14c] text-black px-4 py-2 font-black text-xs flex items-center justify-between sticky top-0 z-50 shadow-md">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Admin Consumer Preview ({currentUser?.email || 'altinberisha434@gmail.com'})
          </span>
          <button
            onClick={() => setIsPreviewConsumer(false)}
            className="px-3 py-1 rounded-lg bg-black text-white font-bold text-[11px] hover:bg-neutral-800 transition cursor-pointer"
          >
            Return to Admin Control Hub
          </button>
        </div>
      )}
      
      {/* Real-Time XP Floating Toasts & Celebration Banners */}
      <XpNotifications onOpenMembership={() => handleSelectTab('membership')} />
      <FcmToast />

      {/* Global Top Navbar across Home, Series, Movies, Awards, and Profile browsing pages */}
      {activeTab !== 'settings' && activeTab !== 'admin' && (
        <Navbar
          activeCategory={activeCategory}
          onSelectCategory={(cat) => {
            if (activeTab !== 'home') {
              handleSelectTab('home');
            }
            handleSelectCategory(cat);
          }}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenJoinWatchParty={watchPartyEnabled ? () => setIsJoinWatchPartyOpen(true) : undefined}
          onOpenMembership={() => handleSelectTab('membership')}
          onOpenAdmin={() => handleSelectTab('admin')}
          watchlistCount={watchlist.length}
          account={account}
          currentUser={currentUser}
          isGuest={isGuest}
          onSignIn={() => setCurrentUser(null)}
        />
      )}

      {/* Main Content Areas */}
      <main>

        {/* MAIN TABS */}

        {/* TAB: ADMIN CONTROL PANEL */}
        {activeTab === 'admin' && (
          <AdminView
            key={pageReloadKeys['admin'] || 0}
            onSelectMedia={(item) => setSelectedMedia(item)}
            onClose={() => handleSelectTab('home')}
          />
        )}

        {/* TAB: ACHIEVEMENTS HALL */}
        {activeTab === 'achievements' && (
          <AchievementsView 
            key={pageReloadKeys['achievements'] || 0}
            account={account} 
            onClose={() => handleSelectTab('home')}
            onOpenLeaderboard={() => handleSelectTab('leaderboard')}
          />
        )}

        {/* TAB: LEADERBOARD (HALL OF FAME) */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView
            key={pageReloadKeys['leaderboard'] || 0}
            currentAccount={account}
            onBack={() => handleSelectTab('home')}
            onNavigateToAchievements={() => handleSelectTab('achievements')}
          />
        )}

        {/* TAB: HISTORY */}
        {activeTab === 'history' && (
          <HistoryView
            key={pageReloadKeys['history'] || 0}
            account={account}
            onSelectMedia={(item) => setSelectedMedia(item)}
            onClose={() => handleSelectTab('home')}
          />
        )}

        {/* TAB: MEMBERSHIP / PROFILE PAGE / SETTINGS */}
        {(activeTab === 'membership' || activeTab === 'settings' || activeTab === 'history') && !currentUser?.isGuest && (
          <MembershipCardModal
            key={`${activeTab}-${pageReloadKeys[activeTab] || 0}`}
            account={account}
            onClose={() => handleSelectTab('home')}
            onUpdateAccount={() => setAccount(getXpAccount())}
            onSignOut={handleSignOut}
            isFullPage={true}
            initialTab={activeTab === 'settings' ? 'settings' : activeTab === 'history' ? 'history' : 'card'}
            onSelectMedia={(item) => setSelectedMedia(item)}
          />
        )}

        {/* TAB: MY LIST & SAVED CINEMA */}
        {activeTab === 'my-list' && (
          <MyListView
            key={pageReloadKeys['my-list'] || 0}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            likes={likes}
            history={history}
            downloads={downloads}
            onToggleDownload={handleToggleDownload}
            onPlay={handlePlayMedia}
            onSelectMedia={(item) => setSelectedMedia(item)}
            ratings={ratings}
            onExploreCatalog={() => handleSelectCategory('all')}
            compactCatalogView={account?.stats?.compactCatalogView}
          />
        )}

        {/* TAB: BEHIND THE SCENES */}
        {activeTab === 'behind-scenes' && (
          <BehindTheScenesHub
            key={pageReloadKeys['behind-scenes'] || 0}
            onPlay={handlePlayMedia}
            onSelectMedia={(item) => setSelectedMedia(item)}
          />
        )}

        {/* TAB: SERIES */}
        {activeTab === 'series' && (
          <SeriesView 
            key={pageReloadKeys['series'] || 0}
            series={featuredSeries} 
            onSelectSeries={(item) => setSelectedMedia(item)} 
            onPlay={handlePlayMedia} 
            onOpenSearch={() => setIsSearchOpen(true)}
            compactCatalogView={account?.stats?.compactCatalogView}
          />
        )}

        {/* TAB: MOVIES */}
        {activeTab === 'movies' && (
          <MoviesView
            key={pageReloadKeys['movies'] || 0}
            scifiCollection={scifiCollection}
            horrorSpecials={horrorSpecials}
            onPlay={handlePlayMedia}
            onOpenDetail={(item) => setSelectedMedia(item)}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            compactCatalogView={account?.stats?.compactCatalogView}
          />
        )}

        {/* TAB: HOME (DEFAULT) */}
        {activeTab === 'home' && (
          selectedUniverse ? (
            <SagaView
              key={`${selectedUniverse.id}-${pageReloadKeys['home'] || 0}`}
              saga={selectedUniverse}
              activeCatalog={activeCatalog}
              onBack={() => handleSelectUniverse(null)}
              onPlayMedia={handlePlayMedia}
              onOpenDetail={(item) => setSelectedMedia(item)}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
            />
          ) : (
            <div key={pageReloadKeys['home'] || 0} className="flex flex-col">
              {/* 1. Featured Rotating Hero Carousel */}
              <div ref={heroRef}>
                <HeroBanner
                  items={FEATURED_HERO_ITEMS}
                  onPlay={handlePlayMedia}
                  onOpenDetail={(item) => setSelectedMedia(item)}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenSearch={() => setIsSearchOpen(true)}
                  onOpenJoinWatchParty={watchPartyEnabled ? () => setIsJoinWatchPartyOpen(true) : undefined}
                  onOpenMembership={() => handleSelectTab('membership')}
                  onOpenAdmin={() => handleSelectTab('admin')}
                  onSignIn={handleSignOut}
                  account={account}
                  currentUser={currentUser}
                  isGuest={isGuest}
                />
              </div>

              {/* 2. Continue Watching (Peeking below the fold) */}
              {!account.stats?.hideContinueWatching && (
                <div>
                  <ContinueWatchingRow
                    history={history}
                    onPlay={(item, epId) => {
                      const ep = epId && item.episodes
                        ? item.episodes.find(e => e.id === epId)
                        : undefined;
                      handlePlayMedia(item, ep);
                    }}
                    onOpenDetail={(item) => setSelectedMedia(item)}
                  />
                </div>
              )}

              {/* 2.5 Smart Recommendations */}
              {account.stats?.enableSmartRecommendations && (
                <div>
                  <BecauseYouWatchedRow
                    history={history}
                    catalog={fullVisibleCatalog}
                    onPlay={(item, epId) => {
                      const ep = epId && item.episodes
                        ? item.episodes.find(e => e.id === epId)
                        : undefined;
                      handlePlayMedia(item, ep);
                    }}
                    onOpenDetail={(item) => setSelectedMedia(item)}
                  />
                </div>
              )}

              {/* ==================== WATCH PARTY INTEGRATION DASHBOARD ==================== */}
              {watchPartyEnabled && (
                <div className="space-y-6 py-4">
                  {/* Top Banner: Previously Joined Active Parties (Rejoin without entering any code!) */}
                  <PreviouslyJoinedPartiesBanner
                    onRejoinParty={(party) => setActiveWatchParty(party)}
                    livePublicParties={livePublicParties}
                  />

                  {/* Row 1: Live Public Watch Parties */}
                  {livePublicParties.length > 0 && (
                    <div className="px-4 sm:px-6">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h2 className="text-sm font-black text-white tracking-tight uppercase font-mono flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span>Live Watch Parties</span>
                          </h2>
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono">Join active live rooms instantly</p>
                        </div>
                      </div>

                      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
                        {livePublicParties.map((p) => (
                          <div
                            key={p.partyId}
                            className="bg-[var(--bg-card)] border border-white/10 p-3.5 rounded-xl w-64 shrink-0 snap-start flex flex-col gap-3 hover:border-[#e2b14c]/30 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={p.hostAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                alt={p.hostName}
                                className="w-6 h-6 rounded-full border border-[#e2b14c]/30 object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0">
                                <span className="text-[10px] text-white font-bold block truncate leading-none">
                                  {p.hostName}
                                </span>
                                <span className="text-[8px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
                                  Hosting Live
                                </span>
                              </div>
                            </div>

                            <div className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black">
                              <img
                                src={p.mediaThumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                                alt={p.mediaTitle}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 bg-black/75 border border-red-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono font-black text-red-400 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                                <span>{p.viewers?.length || 1} watching</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-xs font-bold text-white line-clamp-1 leading-tight font-sans">
                                {p.mediaTitle}
                              </h3>
                              <button
                                onClick={async () => {
                                  const res = await joinPublicWatchParty(p.partyId);
                                  if (res.success && res.partyData) {
                                    setActiveWatchParty(res.partyData);
                                  } else {
                                    (window as any).__showFcmToast?.(res.message || 'Failed to join watch party.', 'error');
                                  }
                                }}
                                className="w-full min-h-[36px] bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-[10px] uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-black text-black" />
                                <span>Join Party</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 2: Scheduled Upcoming Watch Parties */}
                  {upcomingParties.length > 0 && (
                    <div className="px-4 sm:px-6">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h2 className="text-sm font-black text-white tracking-tight uppercase font-mono flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-[#e2b14c]" />
                            <span>Upcoming Watch Parties</span>
                          </h2>
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono">Plan ahead and request reminders</p>
                        </div>
                      </div>

                      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
                        {upcomingParties.map((p) => {
                          const isHost = myUid === p.hostUid;
                          const hasInterested = p.interestedUids?.includes(myUid);
                          const isLive = p.status === 'live';

                          const displayTime = new Date(p.scheduledTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          const displayDate = new Date(p.scheduledTime).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          });

                          const minsLeft = Math.ceil((p.scheduledTime - Date.now()) / 60000);

                          return (
                            <div
                              key={p.id}
                              className="bg-[var(--bg-card)] border border-white/10 p-3.5 rounded-xl w-64 shrink-0 snap-start flex flex-col gap-3 hover:border-[#e2b14c]/30 transition-all"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <img
                                    src={p.hostAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                    alt={p.hostName}
                                    className="w-5 h-5 rounded-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="text-[9px] text-[var(--text-secondary)] truncate max-w-[80px]">
                                    {p.hostName}
                                  </span>
                                </div>
                                <span className="text-[9px] text-[#e2b14c] font-mono font-bold bg-[#e2b14c]/10 border border-[#e2b14c]/20 px-1.5 py-0.5 rounded">
                                  {displayDate} @ {displayTime}
                                </span>
                              </div>

                              <div className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black">
                                <img
                                  src={p.mediaThumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                                  alt={p.mediaTitle}
                                  className="w-full h-full object-cover opacity-85"
                                />
                                {minsLeft > 0 && (
                                  <div className="absolute top-2 left-2 bg-black/85 border border-white/10 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-white uppercase tracking-wider">
                                    in {minsLeft} min
                                  </div>
                                )}
                                {isLive && (
                                  <div className="absolute top-2 left-2 bg-red-500 text-black px-2 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider animate-pulse">
                                    LIVE NOW
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <h3 className="text-xs font-bold text-white line-clamp-1 leading-tight font-sans">
                                  {p.mediaTitle}
                                </h3>
                                
                                {isLive && p.activePartyId ? (
                                  <button
                                    onClick={async () => {
                                      const res = await joinPublicWatchParty(p.activePartyId!);
                                      if (res.success && res.partyData) {
                                        setActiveWatchParty(res.partyData);
                                      } else {
                                        (window as any).__showFcmToast?.(res.message || 'Party is not active anymore.', 'error');
                                      }
                                    }}
                                    className="w-full min-h-[36px] bg-red-500 hover:bg-red-600 text-black font-mono font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-black" />
                                    <span>Join Live</span>
                                  </button>
                                ) : isHost ? (
                                  <button
                                    onClick={async () => {
                                      const mediaObj = fullVisibleCatalog.find(m => m.id === p.mediaId);
                                      if (!mediaObj) return;
                                      const episodeObj = p.episodeId && mediaObj.episodes
                                        ? mediaObj.episodes.find(e => e.id === p.episodeId)
                                        : undefined;
                                      
                                      const res = await createWatchPartyByHost(mediaObj, episodeObj, p.isPublic);
                                      if (res.success && res.partyData) {
                                        await startScheduledPartyLive(p.id, res.partyData.partyId);
                                        setActiveWatchParty(res.partyData);
                                      } else {
                                        (window as any).__showFcmToast?.('Failed to start watch party.', 'error');
                                      }
                                    }}
                                    className="w-full min-h-[36px] bg-[#e2b14c] hover:brightness-110 text-black font-mono font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Start Party Now</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      await toggleInterestInScheduledParty(p.id, !hasInterested);
                                    }}
                                    className={`w-full min-h-[36px] border text-[10px] font-mono font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer ${
                                      hasInterested
                                        ? 'bg-[#e2b14c]/15 text-[#e2b14c] border-[#e2b14c]/30'
                                        : 'border-white/10 text-white hover:bg-white/5'
                                    }`}
                                  >
                                    <Check className={`w-3.5 h-3.5 ${hasInterested ? 'text-[#e2b14c]' : 'text-transparent'}`} />
                                    <span>{hasInterested ? 'Interested' : "I'm Interested"}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Saved Watch Party Replays (Quota-optimized, long-press options & metadata) */}
                  <SavedReplaysSection
                    onPlayReplay={(r) => setActiveReplay(r)}
                    currentUserId={myUid}
                  />

                </div>
              )}

              {/* 3. Universes Section (Directly below Continue Watching) */}
              <UniversesSection
                onSelectUniverse={handleSelectUniverse}
              />

              {/* 4. Horizontal Movie Rows across every custom & ranked section */}
              <div className="space-y-2 py-4">
              {customSections.map((sec) => {
                const secItems = fullVisibleCatalog.filter(
                  (m) =>
                    !m.isHidden &&
                    (m.category === sec.id ||
                      m.originalSection === sec.id ||
                      (sec.id === 'series' && (m.isSeries || m.category === 'series' || m.originalSection === 'featured-series')) ||
                      (sec.id === 'scifi' && (m.originalSection === 'scifi-collection' || (m.category === 'scifi' && m.originalSection !== 'the-end-saga'))) ||
                      (sec.id === 'horror' && (m.category === 'horror' || m.originalSection === 'horror' || m.originalSection === 'horror-specials')) ||
                      (sec.id === 'skits' && (m.category === 'skits' || m.originalSection === 'funny-skits')) ||
                      (sec.id === 'behind' && (m.category === 'behind' || m.category === 'deleted' || m.originalSection === 'behind-scenes' || m.originalSection === 'deleted-scenes')) ||
                      (sec.id === 'specials' && (m.category === 'specials' || m.originalSection === 'special-features')))
                );

                if (secItems.length === 0) return null;

                return (
                  <MovieRow
                    key={sec.id}
                    title={t(`sections.${sec.id}_label`, undefined, sec.label)}
                    subtitle={t(`sections.${sec.id}_subtitle`, undefined, sec.subtitle)}
                    items={secItems}
                    onPlay={handlePlayMedia}
                    onOpenDetail={(item) => setSelectedMedia(item)}
                    watchlist={watchlist}
                    onToggleWatchlist={handleToggleWatchlist}
                    variant={sec.variant}
                    badge={sec.badge}
                  />
                );
              })}
            </div>
          </div>
        )
      )}
      </main>
      </div>

      {/* Floating Bottom Navigation for Mobile */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        watchlistCount={watchlist.length}
        account={account}
        onOpenMembership={() => handleSelectTab('membership')}
        onSignIn={handleSignOut}
        isGuest={isGuest}
      />

      {/* MODAL 2: MEDIA DETAIL SHEET */}
      {selectedMedia && (
        <MediaDetailModal
          item={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onPlay={handlePlayMedia}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
          likes={likes}
          onToggleLike={handleToggleLike}
          ratings={ratings}
          onRate={handleRateMedia}
          downloads={downloads}
          onToggleDownload={handleToggleDownload}
          isGuest={isGuest}
        />
      )}

      {/* MODAL 3: OPTIMISED HIGH-DEFINITION CINEMA PLAYER */}
      {playingMedia && (
        <VideoPlayerModal
          item={playingMedia}
          episode={playingEpisode}
          onClose={() => {
            setPlayingMedia(null);
            setPlayingEpisode(undefined);
            setTargetCommentOptions({});
          }}
          onSelectEpisode={(item, ep) => {
            setPlayingMedia(item);
            setPlayingEpisode(ep);
          }}
          onPlayMedia={handlePlayMedia}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
          likes={likes}
          onToggleLike={handleToggleLike}
          downloads={downloads}
          onToggleDownload={handleToggleDownload}
          account={account}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            handleSelectTab(tab);
          }}
          onOpenMembership={() => {
            handleSelectTab('membership');
          }}
          isGuest={isGuest}
          initialTargetCommentId={targetCommentOptions.targetCommentId}
          initialIsReplying={targetCommentOptions.isReplying}
        />
      )}

      {/* IN-APP NOTIFICATION CENTER MODAL */}
      <NotificationCenterModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        userId={myUid}
        account={account}
        onNavigateToContent={handleNotificationNavigateToContent}
        onNavigateToTab={(tab) => handleSelectTab(tab as ActiveTab)}
        onOpenMembership={() => handleSelectTab('membership')}
      />

      {/* MODAL 4: GLOBAL INSTANT SEARCH */}
      <AnimatePresence>
        {isSearchOpen && (
          <SearchModal
            onClose={() => setIsSearchOpen(false)}
            onSelectMedia={(item) => setSelectedMedia(item)}
            account={account}
            currentUser={currentUser}
            isGuest={isGuest}
          />
        )}
      </AnimatePresence>

      {/* WATCH PARTY INVITE TOAST NOTIFICATION */}
      {watchPartyEnabled && (
        <WatchPartyInviteToast
          onJoinParty={(partyData) => {
            setActiveWatchParty(partyData);
          }}
        />
      )}

      {/* WATCH PARTY ENDED BACKGROUND TOAST (prompts to save or dismiss when party finishes) */}
      {watchPartyEnabled && (
        <WatchPartyEndedToast
          onReplaySaved={() => {
            // Trigger refresh of saved replays if needed
          }}
        />
      )}

      {/* SYNCHRONIZED WATCH PARTY PLAYER ROOM */}
      {watchPartyEnabled && activeWatchParty && (
        <WatchPartyPlayerModal
          partyData={activeWatchParty}
          onClose={() => setActiveWatchParty(null)}
        />
      )}
      
      {/* Ensure main player is paused/closed when watch party starts */}
      {watchPartyEnabled && activeWatchParty && (
        <React.Fragment>
          {/* Effect handled below */}
        </React.Fragment>
      )}

      {/* WATCH PARTY REPLAY SOLO PLAYER */}
      {watchPartyEnabled && activeReplay && (
        <WatchPartyReplayPlayerModal
          replay={activeReplay}
          onClose={() => setActiveReplay(null)}
        />
      )}

      {/* JOIN WATCH PARTY CODE SYSTEM MODAL */}
      {watchPartyEnabled && (
        <JoinWatchPartyModal
          isOpen={isJoinWatchPartyOpen}
          onClose={() => {
            setIsJoinWatchPartyOpen(false);
            setAutoFillCode('');
          }}
          autoFillCode={autoFillCode}
        />
      )}

      {/* ONBOARDING TUTORIAL (First launch only once) */}
      <OnboardingTutorial />
    </div>
  );
}
