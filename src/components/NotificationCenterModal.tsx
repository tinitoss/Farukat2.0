import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { 
  ArrowLeft, 
  Bell, 
  Heart, 
  MessageCircle, 
  Award, 
  Flame, 
  Users, 
  ShieldCheck, 
  CheckCheck, 
  Trash2, 
  Film, 
  Star, 
  Crown, 
  Zap, 
  Eye, 
  X,
  Sparkles,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSwipeable } from 'react-swipeable';
import { InAppNotification, XpAccount } from '../types';
import {
  fetchInAppNotifications,
  markInAppNotificationAsRead,
  deleteInAppNotificationClient,
  subscribeToNotificationUpdates,
  syncRealActivityNotifications,
  getLocalCachedNotifications
} from '../utils/inAppNotificationSystem';
import { calculateLevelInfo } from '../utils/xpSystem';
import { selectDailyFacts, fetchCatalogDbStats, CatalogDbStats } from '../utils/dailyFactsEngine';
import { MEDIA_CATALOG } from '../data/mediaData';
import { formatDistanceToNow } from 'date-fns';
import { sq, enUS } from 'date-fns/locale';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  account?: XpAccount;
  onNavigateToContent?: (contentId: string, options?: { targetCommentId?: string; isReplying?: boolean }) => void;
  onNavigateToTab?: (tabName: string) => void;
  onOpenMembership?: () => void;
}

type FilterCategory = 'all' | 'social' | 'watching' | 'achievements';

// Helper to extract XP reward amount
function extractXpReward(notif: InAppNotification): number | null {
  if (notif.actionPayload?.xpReward && typeof notif.actionPayload.xpReward === 'number') {
    return notif.actionPayload.xpReward;
  }
  const fullText = `${notif.title} ${notif.message}`;
  const match = fullText.match(/\+(\d+)\s*XP/i) || fullText.match(/(\d+)\s*XP/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50000) {
      return parsed;
    }
  }
  if (notif.type === 'streak_milestone') {
    if (fullText.includes('Day 3')) return 50;
    if (fullText.includes('Day 7')) return 100;
    if (fullText.includes('Day 14')) return 250;
    if (fullText.includes('Day 30')) return 500;
    return 50;
  }
  return null;
}

interface NotificationTypeConfig {
  icon: React.ReactNode;
  categoryTag: string;
}

function getNotificationTypeConfig(notif: InAppNotification): NotificationTypeConfig {
  const textLower = `${notif.title} ${notif.message}`.toLowerCase();

  // 1. VIP / Pass
  if (
    notif.type === 'vip_pass' ||
    notif.type === 'membership_upgraded' ||
    notif.type === 'membership_perk' ||
    notif.targetType === 'membership' ||
    textLower.includes('pass') ||
    textLower.includes('vip')
  ) {
    return {
      icon: <ShieldCheck className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'VIP Pass'
    };
  }

  // 2. Streaks
  if (notif.type === 'streak_milestone' || textLower.includes('streak') || textLower.includes('day')) {
    return {
      icon: <Flame className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Daily Streak'
    };
  }

  // 3. Rank-Up / Crown Achievements
  if (notif.type === 'level_up' || textLower.includes('rank') || textLower.includes('level') || textLower.includes('master') || textLower.includes('champion') || textLower.includes('elite')) {
    return {
      icon: <Crown className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Rank Progression'
    };
  }

  // 4. Movies / Film Reel
  if (textLower.includes('movie') || textLower.includes('film') || textLower.includes('watch') || textLower.includes('episode') || textLower.includes('marathon') || textLower.includes('cinema')) {
    return {
      icon: <Film className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Cinema Milestone'
    };
  }

  // 5. Star / Review / Rating Milestones
  if (textLower.includes('review') || textLower.includes('star') || textLower.includes('rating') || textLower.includes('rated')) {
    return {
      icon: <Star className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Review Milestone'
    };
  }

  // 6. Social Comments & Replies
  if (notif.type === 'comment_like' || textLower.includes('like')) {
    return {
      icon: <Heart className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Reaction'
    };
  }

  if (notif.type === 'comment_reply' || notif.category === 'social' || textLower.includes('comment') || textLower.includes('reply')) {
    return {
      icon: <MessageCircle className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Discussion'
    };
  }

  // 7. Watch Parties
  if (notif.type === 'party_ended' || notif.type === 'watch_party_invite' || notif.category === 'watching') {
    return {
      icon: <Users className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
      categoryTag: 'Watch Party'
    };
  }

  // 8. Default Achievement / Milestone
  return {
    icon: <Award className="w-4 h-4 text-[#e2b14c]" strokeWidth={2} />,
    categoryTag: 'Milestone'
  };
}

// Clean title formatter to display specific achievement titles instead of generic headers
function getFormattedNotificationTitles(notif: InAppNotification) {
  let rawTitle = notif.title || '';
  let categoryLabel = 'Milestone';

  const lowerTitle = rawTitle.toLowerCase();
  if (lowerTitle.includes('achievement unlocked!') || lowerTitle.includes('achievement unlocked')) {
    if (notif.message && !notif.message.toLowerCase().includes('unlocked')) {
      const parts = notif.message.split(' - ');
      if (parts.length > 1) {
        categoryLabel = parts[0];
        rawTitle = parts.slice(1).join(' - ');
      } else {
        rawTitle = notif.message;
      }
    } else {
      rawTitle = 'Milestone Reached';
    }
  } else if (lowerTitle.includes('streak milestone')) {
    categoryLabel = 'Daily Streak';
  } else if (lowerTitle.includes('vip')) {
    categoryLabel = 'VIP Membership';
  } else if (lowerTitle.includes('level up')) {
    categoryLabel = 'Rank Progression';
  }

  return { title: rawTitle, categoryLabel };
}

// Relative timestamp helper
function formatTimeAgo(dateStr: string, lang: 'en' | 'sq'): string {
  try {
    const locale = lang === 'sq' ? sq : enUS;
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
  } catch {
    return '';
  }
}

// Date Section Grouping Helper
function getDateSectionLabel(dateStr: string, t: any): string {
  try {
    const notifDate = new Date(dateStr);
    const now = new Date();

    const d1 = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate()).getTime();
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return t('common.today', undefined, 'Today');
    if (diffDays === 1) return t('common.yesterday', undefined, 'Yesterday');
    if (diffDays < 7) return t('common.daysAgoLabel', { count: diffDays }, `${diffDays} Days Ago`);
    if (diffDays < 14) return t('notifications.lastWeek', undefined, 'Last Week');
    return t('notifications.older', undefined, 'Older');
  } catch {
    return t('notifications.older', undefined, 'Older');
  }
}

// Notification Card
interface NotificationCardProps {
  notif: InAppNotification;
  onAction: (notif: InAppNotification) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  onLongPress: (notif: InAppNotification) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = memo(({
  notif,
  onAction,
  onDelete,
  onLongPress
}) => {
  const { language } = useTranslation();
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef<boolean>(false);

  const xpReward = useMemo(() => extractXpReward(notif), [notif]);
  const isHighValue = xpReward !== null && xpReward >= 250;
  const config = useMemo(() => getNotificationTypeConfig(notif), [notif]);
  const formatted = useMemo(() => getFormattedNotificationTitles(notif), [notif]);
  const actorAvatar = notif.actionPayload?.actorAvatar || notif.imageUrl;
  const actorName = notif.actionPayload?.actorUsername;

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      // Only handle horizontal swipes to avoid interfering with vertical scrolling
      if (Math.abs(eventData.deltaX) > Math.abs(eventData.deltaY) && eventData.dir === 'Left') {
        const offset = Math.max(-90, eventData.deltaX);
        setSwipeOffset(offset);
        setIsSwiping(true);
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    },
    onSwipedLeft: (eventData) => {
      if (Math.abs(eventData.deltaX) > Math.abs(eventData.deltaY)) {
        setSwipeOffset(-80);
        setIsSwiping(false);
      }
    },
    onSwipedRight: () => {
      setSwipeOffset(0);
      setIsSwiping(false);
    },
    onSwiped: () => {
      setIsSwiping(false);
    },
    preventScrollOnSwipe: false,
    trackMouse: true,
    trackTouch: true,
    delta: 15
  });

  const handleMouseDown = () => {
    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      onLongPress(notif);
    }, 600);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCardClick = () => {
    if (isLongPressTriggered.current) return;
    if (swipeOffset < -20) {
      setSwipeOffset(0);
      return;
    }
    onAction(notif);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative overflow-hidden group will-change-transform bg-black rounded-xl"
    >
      {/* Background Red Swipe-Delete Action Panel */}
      <div
        className={`absolute inset-y-0 right-0 w-[80px] bg-[#D9483C] flex items-center justify-center text-white transition-opacity duration-150 rounded-r-xl ${
          swipeOffset < 0 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete(notif.id, e);
          }}
          className="w-full h-full flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
          title="Delete notification"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </button>
      </div>

      {/* Foreground Modern Card */}
      <div
        {...handlers}
        id={`notif-card-${notif.id}`}
        onClick={handleCardClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        className={`relative z-10 p-4 transition-all duration-200 cursor-pointer select-none rounded-xl border touch-pan-y ${
          notif.isRead
            ? 'bg-[#0a0a0a] hover:bg-[#111111] border-[#181818]'
            : isHighValue
            ? 'bg-[#15120a] hover:bg-[#1c180e] border-[#e2b14c]/40 shadow-[0_4px_24px_rgba(226,177,76,0.12)]'
            : 'bg-[#12110d] hover:bg-[#181611] border-[#e2b14c]/25 shadow-[0_2px_16px_rgba(226,177,76,0.06)]'
        }`}
      >
        {/* Top Header Row: Category Tag, Unread Indicator, Timestamp */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Unread Indicator Bar */}
            {!notif.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#e2b14c] flex-shrink-0 shadow-[0_0_8px_rgba(226,177,76,0.8)]" />
            )}
            
            {/* Category tag pill */}
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider leading-none ${
                notif.isRead ? 'text-zinc-400' : 'text-[#e2b14c]'
              }`}
            >
              {config.categoryTag}
            </span>

            {/* High-value XP Chip */}
            {xpReward !== null && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold leading-none ${
                  notif.isRead
                    ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                    : isHighValue
                    ? 'bg-[#e2b14c] text-black shadow-[0_0_10px_rgba(226,177,76,0.5)]'
                    : 'bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30'
                }`}
              >
                {isHighValue && <Zap className="w-2.5 h-2.5 mr-0.5 fill-black" />}
                +{xpReward} XP
              </span>
            )}
          </div>

          {/* Timestamp */}
          <span
            className={`text-[11px] font-mono whitespace-nowrap flex-shrink-0 ${
              notif.isRead ? 'text-zinc-400' : 'text-zinc-300'
            }`}
          >
            {formatTimeAgo(notif.createdAt, language as 'en' | 'sq')}
          </span>
        </div>

        {/* Main Content Layout: Icon/Avatar + Text */}
        <div className="flex items-start gap-3">
          {/* Leading Visual Anchor */}
          <div className="flex-shrink-0 mt-0.5">
            {actorAvatar ? (
              <div
                className={`w-9 h-9 rounded-lg overflow-hidden border flex items-center justify-center ${
                  notif.isRead
                    ? 'border-zinc-700 bg-zinc-900'
                    : 'border-[#e2b14c]/60 bg-zinc-900 ring-1 ring-[#e2b14c]/30'
                }`}
              >
                <img
                  src={actorAvatar}
                  alt={actorName || 'User'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                  notif.isRead
                    ? 'bg-zinc-900 border-zinc-700/60 text-zinc-300'
                    : 'bg-[#e2b14c]/15 border-[#e2b14c]/30 text-[#e2b14c]'
                }`}
              >
                {config.icon}
              </div>
            )}
          </div>

          {/* Text Information */}
          <div className="flex-1 min-w-0">
            <h3
              className={`text-sm tracking-tight leading-snug break-words ${
                notif.isRead ? 'font-medium text-zinc-200' : 'font-bold text-white'
              }`}
            >
              {formatted.title}
            </h3>

            {notif.message && (
              <p
                className={`text-xs mt-1 leading-relaxed line-clamp-2 ${
                  notif.isRead ? 'text-zinc-400' : 'text-zinc-300'
                }`}
              >
                {notif.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// Long-Press Context Action Sheet Component
interface ContextActionSheetProps {
  notif: InAppNotification | null;
  onClose: () => void;
  onOpen: (notif: InAppNotification) => void;
  onToggleRead: (notif: InAppNotification) => void;
  onDelete: (id: string) => void;
  language: 'en' | 'sq';
}

const ContextActionSheet: React.FC<ContextActionSheetProps> = ({
  notif,
  onClose,
  onOpen,
  onToggleRead,
  onDelete,
  language
}) => {
  const { t } = useTranslation();
  if (!notif) return null;

  const xpReward = extractXpReward(notif);
  const config = getNotificationTypeConfig(notif);
  const formatted = getFormattedNotificationTitles(notif);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Action Sheet Card */}
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative z-10 w-full max-w-lg bg-[#0F0F0F] border-t border-[#1F1F1F] rounded-t-2xl p-4 shadow-2xl pb-8"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header with Close */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {t('notifications.notifDetails', undefined, 'Notification Details')}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification Preview Content Card */}
        <div className="bg-[#151515] border border-[#222222] rounded-xl p-4 mb-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#e2b14c]/15 border border-[#e2b14c]/30 flex items-center justify-center flex-shrink-0">
              {config.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white leading-snug">{formatted.title}</h3>
              <p className="text-xs text-[#e2b14c] font-medium mt-0.5">↳ {config.categoryTag}</p>
            </div>
            {xpReward !== null && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#e2b14c]/15 text-[#e2b14c] border border-[#e2b14c]/30 flex-shrink-0">
                +{xpReward} XP
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed pt-2 border-t border-white/5">
            {notif.message}
          </p>

          <div className="text-[11px] font-mono text-zinc-500 pt-1">
            {formatTimeAgo(notif.createdAt, language)}
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="grid grid-cols-3 gap-2">
          {/* Open / View */}
          <button
            onClick={() => {
              onOpen(notif);
              onClose();
            }}
            className="h-11 flex items-center justify-center gap-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95 cursor-pointer font-medium text-xs"
          >
            <Eye className="w-4 h-4 text-[#e2b14c]" />
            <span>{t('notifications.open', undefined, 'Open')}</span>
          </button>

          {/* Mark as Read / Unread Toggle */}
          <button
            onClick={() => {
              onToggleRead(notif);
              onClose();
            }}
            className="h-11 flex items-center justify-center gap-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95 cursor-pointer font-medium text-xs"
          >
            <CheckCheck className="w-4 h-4 text-sky-400" />
            <span className="truncate">
              {notif.isRead ? t('notifications.markUnread', undefined, 'Mark Unread') : t('notifications.markRead', undefined, 'Mark Read')}
            </span>
          </button>

          {/* Delete (Warning Red) */}
          <button
            onClick={() => {
              onDelete(notif.id);
              onClose();
            }}
            className="h-11 flex items-center justify-center gap-1.5 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition active:scale-95 cursor-pointer font-medium text-xs"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>{t('common.delete', undefined, 'Delete')}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  userId,
  account,
  onNavigateToContent,
  onNavigateToTab,
  onOpenMembership
}) => {
  const { t, language } = useTranslation();
  
  // Dynamic Daily Facts state & calculation
  const [dbStats, setDbStats] = useState<CatalogDbStats | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchCatalogDbStats().then(stats => {
      if (stats) setDbStats(stats);
    }).catch(() => {});
  }, [isOpen]);

  // Real-time calculation of daily facts with active account XP/level
  const dailyFacts = useMemo(() => {
    const lang = (language === 'sq' ? 'sq' : 'en') as 'en' | 'sq';
    return selectDailyFacts(MEDIA_CATALOG, account, dbStats, userId, lang);
  }, [account, dbStats, userId, language]);
  
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    const cached = getLocalCachedNotifications(userId || '').notifications;
    const map = new Map<string, InAppNotification>();
    cached.forEach(n => {
      if (n.id && !map.has(n.id)) {
        map.set(n.id, n);
      }
    });
    return Array.from(map.values());
  });

  const [unreadCount, setUnreadCount] = useState<number>(() => {
    return getLocalCachedNotifications(userId || '').unreadCount;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return notifications.length === 0;
  });

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [selectedNotificationForAction, setSelectedNotificationForAction] = useState<InAppNotification | null>(null);

  // Load and subscribe to notification updates with strict deduplication
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const initialCache = getLocalCachedNotifications(userId || '');
    if (initialCache.notifications.length > 0) {
      const map = new Map<string, InAppNotification>();
      initialCache.notifications.forEach(n => {
        if (n.id && !map.has(n.id)) map.set(n.id, n);
      });
      const uniqueList = Array.from(map.values());
      setNotifications(uniqueList);
      setUnreadCount(initialCache.unreadCount);
      setIsLoading(false);
    }

    async function loadData() {
      try {
        if (userId) {
          syncRealActivityNotifications(userId).catch(() => {});
        }
        const data = await fetchInAppNotifications(userId);
        if (isMounted && data.notifications) {
          const map = new Map<string, InAppNotification>();
          data.notifications.forEach(n => {
            if (n.id && !map.has(n.id)) map.set(n.id, n);
          });
          const uniqueList = Array.from(map.values());
          setNotifications(uniqueList);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.warn('[Notifications] Load data notice:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    const unsubscribe = subscribeToNotificationUpdates(() => {
      const updated = getLocalCachedNotifications(userId || '');
      if (isMounted && updated.notifications) {
        const map = new Map<string, InAppNotification>();
        updated.notifications.forEach(n => {
          if (n.id && !map.has(n.id)) map.set(n.id, n);
        });
        const uniqueList = Array.from(map.values());
        setNotifications(uniqueList);
        setUnreadCount(updated.unreadCount || 0);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen, userId]);

  // Filter notifications according to active category
  const filteredNotifications = useMemo(() => {
    const contentMap = new Map<string, InAppNotification>();
    notifications.forEach(n => {
      const key = `${n.title}_${n.message}`;
      if (!contentMap.has(key)) {
        contentMap.set(key, n);
      }
    });
    const uniqueNotifications = Array.from(contentMap.values());

    if (activeFilter === 'all') return uniqueNotifications;
    if (activeFilter === 'social') {
      return uniqueNotifications.filter(n => n.category === 'social');
    }
    if (activeFilter === 'watching') {
      return uniqueNotifications.filter(n => n.category === 'watching');
    }
    if (activeFilter === 'achievements') {
      return uniqueNotifications.filter(
        n => n.category === 'achievements' || n.category === 'progression'
      );
    }
    return uniqueNotifications;
  }, [notifications, activeFilter]);

  // Group notifications into clean Date Sections
  const dateSections = useMemo(() => {
    const groupsMap = new Map<string, InAppNotification[]>();
    const order: string[] = [];

    const sorted = [...filteredNotifications].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    sorted.forEach(item => {
      const label = getDateSectionLabel(item.createdAt, t);
      if (!groupsMap.has(label)) {
        groupsMap.set(label, []);
        order.push(label);
      }
      groupsMap.get(label)!.push(item);
    });

    return order.map(label => ({
      label,
      items: groupsMap.get(label)!
    }));
  }, [filteredNotifications, t]);

  // Handle single read
  const handleMarkRead = useCallback(async (id: string, readState: boolean = true) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: readState } : n)));
    setUnreadCount(prev => (readState ? Math.max(0, prev - 1) : prev + 1));
    await markInAppNotificationAsRead(id, userId);
  }, [userId]);

  // Toggle read status from action sheet
  const handleToggleRead = useCallback((notif: InAppNotification) => {
    const newState = !notif.isRead;
    handleMarkRead(notif.id, newState);
  }, [handleMarkRead]);

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markInAppNotificationAsRead(undefined, userId, true);
    } finally {
      setIsMarkingAll(false);
    }
  }, [unreadCount, isMarkingAll, userId]);

  // Handle delete
  const handleDelete = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications(prev => {
      const removed = prev.find(n => n.id === id);
      if (removed && !removed.isRead) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
    await deleteInAppNotificationClient(id, userId);
  }, [userId]);

  // Handle click on card to navigate
  const handleNotificationAction = useCallback(async (notif: InAppNotification) => {
    if (!notif.isRead) {
      handleMarkRead(notif.id, true);
    }

    onClose();

    const targetType = notif.targetType;
    const targetId = notif.targetId;
    const payload = notif.actionPayload || {};

    if (targetType === 'video_player') {
      const contentId = payload.contentId || targetId;
      if (contentId && onNavigateToContent) {
        onNavigateToContent(contentId, {
          targetCommentId: payload.parentCommentId || payload.commentId,
          isReplying: notif.type === 'comment_reply'
        });
      }
    } else if (targetType === 'achievements' && onNavigateToTab) {
      onNavigateToTab('achievements');
    } else if (targetType === 'leaderboard' && onNavigateToTab) {
      onNavigateToTab('leaderboard');
    } else if (targetType === 'membership' && onOpenMembership) {
      onOpenMembership();
    }
  }, [handleMarkRead, onClose, onNavigateToContent, onNavigateToTab, onOpenMembership]);

  if (!isOpen) return null;

  return (
    <div
      id="notifications-full-page"
      className="fixed inset-0 z-50 bg-[#050505] flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden text-[#F5F5F5] animate-fadeIn"
    >
      {/* HEADER */}
      <header
        id="notifications-page-header"
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-[#1F1F1F]"
      >
        {/* Left: Back Button & Title */}
        <div className="flex items-center gap-3">
          <button
            id="btn-back-notifications"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#F5F5F5] transition active:scale-95 cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">
              {t('notifications.title', undefined, 'Notifications')}
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#e2b14c] text-black leading-none shadow-xs">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Right: Mark All Read Action */}
        {unreadCount > 0 && (
          <button
            id="btn-mark-all-read"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-[#e2b14c]/15 hover:bg-[#e2b14c]/25 text-[#e2b14c] border border-[#e2b14c]/30 active:scale-95 transition cursor-pointer"
            title="Mark all as read"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#e2b14c]" />
            <span>{t('notifications.markAllReadBtn', undefined, 'Mark all read')}</span>
          </button>
        )}
      </header>

      {/* REWORKED FILTER TABS */}
      <div
        id="notification-category-filters"
        className="px-4 py-3 bg-[#050505] border-b border-[#1F1F1F] flex items-center gap-2 overflow-x-auto no-scrollbar"
      >
        {(
          [
            { id: 'all', label: t('common.all', undefined, 'All') },
            { id: 'social', label: t('notifications.socialReviews', undefined, 'Social & Reviews') },
            { id: 'watching', label: t('notifications.watchParty', undefined, 'Watch Parties') },
            { id: 'achievements', label: t('notifications.milestones', undefined, 'Milestones') }
          ] as const
        ).map(filter => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`h-8 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center cursor-pointer flex-shrink-0 border ${
                isActive
                  ? 'bg-[#e2b14c] text-black border-[#e2b14c] font-bold shadow-sm'
                  : 'bg-[#0F0F0F] text-zinc-400 border-[#1F1F1F] hover:text-white hover:border-zinc-700'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* MAIN CONTENT AREA */}
      <main
        id="notifications-scroll-area"
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6 pb-28 touch-pan-y overscroll-contain will-change-scroll"
      >
        {/* REWORKED DAILY FACTS SECTION */}
        {dailyFacts.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="w-3.5 h-3.5 text-[#e2b14c]" />
              <h2 className="text-xs font-bold text-[#e2b14c] uppercase tracking-wider">
                {t('notifications.dailyFacts', undefined, 'Daily Facts')}
              </h2>
            </div>

            <div className="space-y-2">
              {dailyFacts.map((fact, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-[#0F0F0F] rounded-xl border border-[#1F1F1F] flex items-start gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e2b14c] mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-200 leading-relaxed font-normal flex-1">{fact}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NOTIFICATION FEED */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
            <div className="w-6 h-6 border-2 border-[#e2b14c] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">{t('notifications.loadingNotifs', undefined, 'Loading notifications...')}</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center mb-3">
              <Film className="w-6 h-6 text-[#e2b14c]" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">
              {t('notifications.noNotifsTitle', undefined, "You're all caught up")}
            </p>
            <p className="text-xs text-zinc-400 max-w-xs">
              {t('notifications.noNotifsDesc', undefined, 'No new notifications in this category.')}
            </p>
          </div>
        ) : (
          dateSections.map(section => (
            <section key={section.label} className="space-y-2.5">
              {/* Modern Section Header */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {section.label}
                </span>
                <div className="h-[1px] flex-1 bg-[#1F1F1F]" />
              </div>

              {/* Cards */}
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {section.items.map(notif => (
                    <NotificationCard
                      key={notif.id}
                      notif={notif}
                      onAction={handleNotificationAction}
                      onDelete={handleDelete}
                      onLongPress={n => setSelectedNotificationForAction(n)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))
        )}
      </main>

      {/* Long-Press Context Action Sheet */}
      <AnimatePresence>
        {selectedNotificationForAction && (
          <ContextActionSheet
            notif={selectedNotificationForAction}
            onClose={() => setSelectedNotificationForAction(null)}
            onOpen={handleNotificationAction}
            onToggleRead={handleToggleRead}
            onDelete={handleDelete}
            language={language as 'en' | 'sq'}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
