import { InAppNotification, NotificationCategory, NotificationPriority, NotificationTargetType, InAppNotificationActionPayload } from '../types';
import { auth } from '../firebase';

const LOCAL_STORAGE_KEY_PREFIX = 'farukat_notifications_cache_v1_';
const READ_NOTIFS_STORAGE_KEY_PREFIX = 'farukat_read_notifs_ids_v1_';
const DISMISSED_NOTIFS_STORAGE_KEY_PREFIX = 'farukat_dismissed_notifs_ids_v1_';
const NOTIFICATION_EVENT = 'farukat_in_app_notifications_updated';

// Helper to get persistent set of read notification IDs and groupKeys
export function getReadNotificationIds(userId: string): Set<string> {
  const targetId = userId || auth.currentUser?.uid || 'usr_anonymous';
  try {
    const raw = localStorage.getItem(`${READ_NOTIFS_STORAGE_KEY_PREFIX}${targetId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set<string>();
}

export function saveReadNotificationIds(userId: string, readIds: Set<string>) {
  const targetId = userId || auth.currentUser?.uid || 'usr_anonymous';
  try {
    localStorage.setItem(
      `${READ_NOTIFS_STORAGE_KEY_PREFIX}${targetId}`,
      JSON.stringify(Array.from(readIds).slice(-300))
    );
  } catch {}
}

// Helper to get persistent set of dismissed/deleted notification IDs and groupKeys
export function getDismissedNotificationIds(userId: string): Set<string> {
  const targetId = userId || auth.currentUser?.uid || 'usr_anonymous';
  try {
    const raw = localStorage.getItem(`${DISMISSED_NOTIFS_STORAGE_KEY_PREFIX}${targetId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set<string>();
}

export function saveDismissedNotificationIds(userId: string, dismissedIds: Set<string>) {
  const targetId = userId || auth.currentUser?.uid || 'usr_anonymous';
  try {
    localStorage.setItem(
      `${DISMISSED_NOTIFS_STORAGE_KEY_PREFIX}${targetId}`,
      JSON.stringify(Array.from(dismissedIds).slice(-300))
    );
  } catch {}
}

function getInitialSeedNotifications(userId: string): InAppNotification[] {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600 * 1000).toISOString();

  return [
    {
      id: `welcome_${userId}`,
      userId,
      category: 'progression',
      type: 'membership_perk',
      priority: 'HIGH',
      title: 'Welcome to Farukat Cinema',
      message: 'Your account is active. Stream in 4K HDR, earn XP with every title you watch, and track your achievements.',
      targetType: 'membership',
      targetId: 'welcome_card',
      groupKey: `welcome_${userId}`,
      isRead: false,
      createdAt: oneHourAgo,
      actionPayload: { newTier: 'Cinema Member' }
    },
    {
      id: `streak_init_${userId}`,
      userId,
      category: 'progression',
      type: 'streak_milestone',
      priority: 'NORMAL',
      title: '3-Day Cinema Streak!',
      message: 'Incredible dedication! You kept your streak burning for 3 consecutive days (+100 XP).',
      targetType: 'membership',
      targetId: 'streak_3',
      groupKey: `streak_3`,
      isRead: false,
      createdAt: oneHourAgo,
      actionPayload: { currentStreak: 3, xpReward: 100 }
    }
  ];
}

// Helper to get cached notifications with read/dismissed state applied
export function getLocalCachedNotifications(userId: string): { notifications: InAppNotification[]; unreadCount: number } {
  const targetId = userId || auth.currentUser?.uid || 'usr_anonymous';
  const readIds = getReadNotificationIds(targetId);
  const dismissedIds = getDismissedNotificationIds(targetId);

  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${targetId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      let notifications: InAppNotification[] = parsed.notifications || [];
      if (notifications.length > 0) {
        // Filter out dismissed items
        notifications = notifications.filter(n => {
          if (dismissedIds.has(n.id)) return false;
          if (n.groupKey && dismissedIds.has(n.groupKey)) return false;
          return true;
        });

        // Apply permanent read status
        notifications = notifications.map(n => {
          const isMarkedRead =
            n.isRead ||
            readIds.has(n.id) ||
            (n.groupKey && readIds.has(n.groupKey)) ||
            readIds.has(`${n.category}_${n.title}`);
          return isMarkedRead ? { ...n, isRead: true } : n;
        });

        const unreadCount = notifications.filter(n => !n.isRead).length;
        return { notifications, unreadCount };
      }
    }
    // Seed initial notifications if empty and not dismissed
    const initialSeed = getInitialSeedNotifications(targetId).filter(n => !dismissedIds.has(n.id));
    if (initialSeed.length > 0) {
      setLocalCachedNotifications(targetId, initialSeed);
    }
    const unreadCount = initialSeed.filter(n => !n.isRead && !readIds.has(n.id)).length;
    return { notifications: initialSeed, unreadCount };
  } catch (err) {
    console.warn('[InAppNotif] Local cache read notice:', err);
  }
  return { notifications: [], unreadCount: 0 };
}

// Helper to save local cached notifications
export function setLocalCachedNotifications(userId: string, notifications: InAppNotification[]) {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify({ notifications, updatedAt: Date.now() })
    );
  } catch (err) {
    console.warn('[InAppNotif] Local cache save notice:', err);
  }
}

// Helper to dispatch global update event
export function dispatchNotificationUpdateEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT));
  }
}

/**
 * Fetch in-app notifications with instant offline cache and background network revalidation
 */
export async function fetchInAppNotifications(userId?: string): Promise<{ notifications: InAppNotification[]; unreadCount: number }> {
  const currentUid = userId || auth.currentUser?.uid;
  if (!currentUid) {
    return { notifications: [], unreadCount: 0 };
  }

  // 1. Get current cache immediately for 0ms UI render
  const cached = getLocalCachedNotifications(currentUid);
  const readIds = getReadNotificationIds(currentUid);
  const dismissedIds = getDismissedNotificationIds(currentUid);

  // 2. Background revalidation with fast timeout (never blocks UI)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/turso/notifications?userId=${encodeURIComponent(currentUid)}&limit=50`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.notifications)) {
        const serverNotifications: InAppNotification[] = data.notifications;
        // Merge server notifications with local notifications
        const mergedMap = new Map<string, InAppNotification>();
        
        // Add server notifications (respecting local read state & dismissed registry)
        serverNotifications.forEach(n => {
          if (dismissedIds.has(n.id) || (n.groupKey && dismissedIds.has(n.groupKey))) {
            return;
          }
          const localMatch = cached.notifications.find(
            cn => cn.id === n.id || (cn.groupKey && cn.groupKey === n.groupKey)
          );
          const isRead =
            Boolean(n.isRead) ||
            Boolean(localMatch?.isRead) ||
            readIds.has(n.id) ||
            Boolean(n.groupKey && readIds.has(n.groupKey)) ||
            readIds.has(`${n.category}_${n.title}`);

          const mergedNotif: InAppNotification = {
            ...n,
            isRead
          };
          const key = n.id || (n.groupKey ? `grp_${n.groupKey}` : `${n.category}_${n.title}`);
          mergedMap.set(key, mergedNotif);
        });
        
        // Retain any locally generated un-synced notifications
        cached.notifications.forEach(n => {
          if (dismissedIds.has(n.id) || (n.groupKey && dismissedIds.has(n.groupKey))) {
            return;
          }
          const key = n.id || (n.groupKey ? `grp_${n.groupKey}` : `${n.category}_${n.title}`);
          if (!mergedMap.has(key)) {
            const isRead =
              Boolean(n.isRead) ||
              readIds.has(n.id) ||
              Boolean(n.groupKey && readIds.has(n.groupKey)) ||
              readIds.has(`${n.category}_${n.title}`);
            mergedMap.set(key, { ...n, isRead });
          }
        });

        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const unreadCount = mergedList.filter(n => !n.isRead).length;
        setLocalCachedNotifications(currentUid, mergedList);
        return { notifications: mergedList, unreadCount };
      }
    }
  } catch (err) {
    // Network timed out or offline, cleanly return local cached state
  }

  return cached;
}

/**
 * Mark a single notification or all notifications as read
 */
export async function markInAppNotificationAsRead(
  notificationId: string | undefined,
  userId?: string,
  markAll = false
): Promise<boolean> {
  const currentUid = userId || auth.currentUser?.uid;
  if (!currentUid) return false;

  const readIds = getReadNotificationIds(currentUid);
  const cached = getLocalCachedNotifications(currentUid);
  const now = new Date().toISOString();

  let updatedNotifications: InAppNotification[];
  if (markAll) {
    updatedNotifications = cached.notifications.map(n => {
      readIds.add(n.id);
      if (n.groupKey) readIds.add(n.groupKey);
      readIds.add(`${n.category}_${n.title}`);
      return {
        ...n,
        isRead: true,
        readAt: n.readAt || now
      };
    });
  } else {
    updatedNotifications = cached.notifications.map(n => {
      if (n.id === notificationId || (notificationId && n.groupKey === notificationId)) {
        readIds.add(n.id);
        if (n.groupKey) readIds.add(n.groupKey);
        readIds.add(`${n.category}_${n.title}`);
        return { ...n, isRead: true, readAt: now };
      }
      return n;
    });
  }

  if (notificationId) {
    readIds.add(notificationId);
  }

  saveReadNotificationIds(currentUid, readIds);
  setLocalCachedNotifications(currentUid, updatedNotifications);
  dispatchNotificationUpdateEvent();

  // Send update to Turso API
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/turso/notifications/mark-read', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: currentUid,
        notificationId,
        markAll
      })
    });
    return true;
  } catch (err) {
    console.warn('[InAppNotif] Mark read network notice:', err);
    return true; // cached locally anyway
  }
}

/**
 * Delete a notification from Turso and local cache
 */
export async function deleteInAppNotificationClient(
  notificationId: string,
  userId?: string
): Promise<boolean> {
  const currentUid = userId || auth.currentUser?.uid;
  if (!currentUid || !notificationId) return false;

  const dismissedIds = getDismissedNotificationIds(currentUid);
  const readIds = getReadNotificationIds(currentUid);
  
  dismissedIds.add(notificationId);
  readIds.add(notificationId);

  const cached = getLocalCachedNotifications(currentUid);
  const targetNotif = cached.notifications.find(n => n.id === notificationId);
  if (targetNotif?.groupKey) {
    dismissedIds.add(targetNotif.groupKey);
    readIds.add(targetNotif.groupKey);
  }

  saveDismissedNotificationIds(currentUid, dismissedIds);
  saveReadNotificationIds(currentUid, readIds);

  const updatedNotifications = cached.notifications.filter(n => n.id !== notificationId);
  setLocalCachedNotifications(currentUid, updatedNotifications);
  dispatchNotificationUpdateEvent();

  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/turso/notifications/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: currentUid,
        notificationId
      })
    });
    return true;
  } catch (err) {
    console.warn('[InAppNotif] Delete notification network notice:', err);
    return true;
  }
}

/**
 * Send an In-App Notification (used for client-side events like Watch Party ended, Achievement Unlocked, Level Up, Streak Milestones)
 */
export async function sendInAppNotificationClient(params: {
  userId?: string;
  category: NotificationCategory;
  type: string;
  priority?: NotificationPriority;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetId: string;
  actionPayload?: InAppNotificationActionPayload;
  groupKey?: string;
  imageUrl?: string;
}): Promise<InAppNotification | null> {
  const currentUid = params.userId || auth.currentUser?.uid;
  if (!currentUid) return null;

  const dismissedIds = getDismissedNotificationIds(currentUid);
  const readIds = getReadNotificationIds(currentUid);

  // If this groupKey was explicitly deleted/dismissed, don't recreate it
  if (params.groupKey && dismissedIds.has(params.groupKey)) {
    return null;
  }

  // Check if this notification has already been marked as read
  const isAlreadyRead =
    Boolean(params.groupKey && readIds.has(params.groupKey)) ||
    readIds.has(`${params.category}_${params.title}`);

  const now = new Date().toISOString();
  const id = params.groupKey
    ? `notif_${currentUid}_${params.groupKey}`
    : `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (dismissedIds.has(id)) {
    return null;
  }

  const newNotif: InAppNotification = {
    id,
    userId: currentUid,
    category: params.category,
    type: params.type,
    priority: params.priority || 'NORMAL',
    title: params.title,
    message: params.message,
    targetType: params.targetType,
    targetId: params.targetId,
    actionPayload: params.actionPayload,
    groupKey: params.groupKey,
    imageUrl: params.imageUrl,
    isRead: isAlreadyRead,
    createdAt: now
  };

  // Strict deduplication to prevent notification spam
  const cached = getLocalCachedNotifications(currentUid);
  let updatedList: InAppNotification[];

  if (params.groupKey) {
    const existingIdx = cached.notifications.findIndex(n => n.groupKey === params.groupKey);
    if (existingIdx !== -1) {
      // If notification already exists for this groupKey, don't spam the user again
      return cached.notifications[existingIdx];
    }
    updatedList = [newNotif, ...cached.notifications].slice(0, 40);
  } else {
    // Prevent duplicate notification with identical title or targetId
    const alreadyExists = cached.notifications.some(
      n => (n.title === params.title && n.message === params.message) || (n.targetId === params.targetId && n.type === params.type)
    );
    if (alreadyExists) {
      return cached.notifications.find(n => n.title === params.title || (n.targetId === params.targetId && n.type === params.type)) || newNotif;
    }
    updatedList = [newNotif, ...cached.notifications].slice(0, 40);
  }

  setLocalCachedNotifications(currentUid, updatedList);
  dispatchNotificationUpdateEvent();

  // Non-blocking background sync to Turso database
  (async () => {
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/turso/notifications/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUid,
          ...params
        })
      });
    } catch {
      // Background sync warning swallowed to prevent main-thread lag
    }
  })();

  return newNotif;
}

/**
 * Event-Driven Notification Helpers
 */

// Notify user when a Watch Party they were in has ended
export async function notifyWatchPartyEnded(party: {
  partyId: string;
  mediaTitle: string;
  hostName?: string;
  mediaId?: string;
  poster?: string;
}) {
  return sendInAppNotificationClient({
    category: 'watching',
    type: 'party_ended',
    priority: 'HIGH',
    title: `Watch Party Ended`,
    message: `${party.hostName ? party.hostName + "'s" : 'The'} party for "${party.mediaTitle}" has concluded. Watch or save the replay.`,
    targetType: 'video_player',
    targetId: party.mediaId || party.partyId,
    groupKey: `party_ended_${party.partyId}`,
    actionPayload: {
      partyId: party.partyId,
      contentId: party.mediaId,
      mediaTitle: party.mediaTitle,
      mediaPoster: party.poster
    },
    imageUrl: party.poster
  });
}

// Notify user when an achievement is unlocked
export async function notifyAchievementUnlocked(achievement: {
  key: string;
  title: string;
  xpReward: number;
  icon?: string;
}) {
  return sendInAppNotificationClient({
    category: 'achievements',
    type: 'achievement_unlocked',
    priority: 'NORMAL',
    title: `Achievement Unlocked!`,
    message: `You earned "${achievement.title}" (+${achievement.xpReward.toLocaleString()} XP).`,
    targetType: 'achievements',
    targetId: achievement.key,
    groupKey: `achieve_${achievement.key}`,
    actionPayload: {
      achievementKey: achievement.key,
      xpReward: achievement.xpReward
    }
  });
}

// Notify user when they advance to a new level or rank tier
export async function notifyLevelUp(level: number, rankTier: string) {
  return sendInAppNotificationClient({
    category: 'progression',
    type: 'level_up',
    priority: 'HIGH',
    title: `Level Up! Level ${level}`,
    message: `Congratulations! You ascended to ${rankTier} status. New cinema cosmetics are now accessible!`,
    targetType: 'membership',
    targetId: `lvl_${level}`,
    groupKey: `level_up_${level}`,
    actionPayload: {
      newLevel: level,
      newTier: rankTier
    }
  });
}

// Notify user when a weekly challenge is completed
export async function notifyWeeklyChallengeCompleted(challenge: {
  challengeKey: string;
  title: string;
  xpReward: number;
}) {
  return sendInAppNotificationClient({
    category: 'achievements',
    type: 'weekly_challenge_complete',
    priority: 'NORMAL',
    title: `Weekly Challenge Complete`,
    message: `You completed "${challenge.title}" and claimed +${challenge.xpReward.toLocaleString()} XP!`,
    targetType: 'achievements',
    targetId: challenge.challengeKey,
    groupKey: `challenge_${challenge.challengeKey}`,
    actionPayload: {
      achievementKey: challenge.challengeKey,
      xpReward: challenge.xpReward
    }
  });
}

// Notify user when a streak milestone is hit
export async function notifyStreakMilestone(days: number, xpBonus = 100) {
  return sendInAppNotificationClient({
    category: 'progression',
    type: 'streak_milestone',
    priority: 'NORMAL',
    title: `${days}-Day Cinema Streak!`,
    message: `Incredible dedication! You kept your streak burning for ${days} consecutive days (+${xpBonus} XP).`,
    targetType: 'membership',
    targetId: `streak_${days}`,
    groupKey: `streak_${days}`,
    actionPayload: {
      currentStreak: days,
      xpReward: xpBonus
    }
  });
}

// Notify user when next episode in a series is ready
export async function notifyNextEpisodeReady(seriesTitle: string, episodeTitle: string, contentId: string, poster?: string) {
  return sendInAppNotificationClient({
    category: 'watching',
    type: 'next_episode',
    priority: 'NORMAL',
    title: `Next Episode Ready`,
    message: `Continue ${seriesTitle}: "${episodeTitle}".`,
    targetType: 'video_player',
    targetId: contentId,
    groupKey: `next_ep_${contentId}`,
    actionPayload: {
      contentId,
      mediaTitle: seriesTitle,
      mediaPoster: poster
    },
    imageUrl: poster
  });
}

/**
 * Synchronize real user activity into in-app notifications if needed
 */
export async function syncRealActivityNotifications(userId?: string): Promise<void> {
  const currentUid = userId || auth.currentUser?.uid || 'usr_anonymous';
  if (!currentUid) return;

  try {
    // Only dispatch resume notification for in-progress videos (max 1)
    if (typeof window !== 'undefined') {
      const progressRaw = localStorage.getItem('farukat_playback_progress_v2');
      if (progressRaw) {
        const parsed = JSON.parse(progressRaw);
        const entries = Object.entries(parsed) as [string, any][];
        if (entries.length > 0) {
          const sorted = entries
            .filter(([_, data]) => data && data.currentTime > 60 && data.duration > 180 && data.currentTime < (data.duration - 90))
            .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

          if (sorted.length > 0) {
            const [mediaId, info] = sorted[0];
            const minutesLeft = Math.max(1, Math.round((info.duration - info.currentTime) / 60));
            await sendInAppNotificationClient({
              userId: currentUid,
              category: 'watching',
              type: 'next_episode',
              priority: 'NORMAL',
              title: 'Continue Watching',
              message: `Resume "${info.title || 'your video'}" (${minutesLeft} min remaining).`,
              targetType: 'video_player',
              targetId: mediaId,
              groupKey: `resume_${mediaId}`,
              actionPayload: {
                contentId: mediaId,
                mediaTitle: info.title,
                mediaPoster: info.poster
              },
              imageUrl: info.poster
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[InAppNotif] Real activity sync notice:', err);
  }
}

/**
 * Hook or Listener helper to keep component state synced
 */
export function subscribeToNotificationUpdates(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(NOTIFICATION_EVENT, callback);
  return () => {
    window.removeEventListener(NOTIFICATION_EVENT, callback);
  };
}
