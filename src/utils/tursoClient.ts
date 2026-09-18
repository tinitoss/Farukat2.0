import { auth } from '../firebase';

// Active in-flight request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

async function fetchDeduplicated<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, promise);
  return promise;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[Turso Client] Failed to get Auth token:', err);
    }
  }
  return headers;
}

// -----------------------------------------------------------------------------
// PROFILE & MEMBER API
// -----------------------------------------------------------------------------
export async function getTursoProfile() {
  const uid = auth.currentUser?.uid || 'guest';
  return fetchDeduplicated(`profile_${uid}`, async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/turso/profile', { headers });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  });
}

export interface TursoProfileUpdatePayload {
  username?: string;
  avatar?: string;
  cardTheme?: string;
  cardNumber?: string;
  bio?: string;
  signatureUrl?: string;
  memberSince?: string;
  tier?: string;
  proMember?: boolean;
  accountData?: any;
  lifetimeXp?: number;
  level?: number;
  explicitUserId?: string;
}

export async function updateTursoProfile(
  payloadOrUsername?: string | TursoProfileUpdatePayload,
  maybeAvatar?: string
) {
  const headers = await getAuthHeaders();
  let body: Record<string, any> = {};

  if (typeof payloadOrUsername === 'string' || typeof maybeAvatar === 'string') {
    body = {
      username: typeof payloadOrUsername === 'string' ? payloadOrUsername : undefined,
      avatar: maybeAvatar
    };
  } else if (payloadOrUsername && typeof payloadOrUsername === 'object') {
    body = { ...payloadOrUsername };
  }

  // Ensure user ID is passed if available
  if (!body.explicitUserId && auth.currentUser?.uid) {
    body.explicitUserId = auth.currentUser.uid;
  }

  const res = await fetch('/api/turso/profile', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

/**
 * Public Verification of Member ID / Card Number from Turso Database
 */
export async function verifyTursoMember(queryId: string) {
  if (!queryId) return null;
  try {
    const res = await fetch(`/api/turso/member/verify?id=${encodeURIComponent(queryId.trim())}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.member : null;
  } catch (err) {
    console.warn('[Turso Client] Member verification error:', err);
    return null;
  }
}

/**
 * Fetch registered community members from Turso Database
 */
export async function getTursoCommunityMembers() {
  try {
    const res = await fetch('/api/turso/members');
    if (!res.ok) return [];
    const data = await res.json();
    return data.success && Array.isArray(data.members) ? data.members : [];
  } catch (err) {
    console.warn('[Turso Client] Fetch community members error:', err);
    return [];
  }
}

// -----------------------------------------------------------------------------
// XP & LEVEL API
// -----------------------------------------------------------------------------
export async function getTursoXp() {
  const uid = auth.currentUser?.uid || 'guest';
  return fetchDeduplicated(`xp_${uid}`, async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/turso/xp', { headers });
    if (!res.ok) throw new Error('Failed to fetch XP');
    return res.json();
  });
}

export async function awardTursoXp(action: string, amount: number, referenceId?: string) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/xp/award', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, amount, referenceId })
  });
  if (!res.ok) throw new Error('Failed to award XP');
  return res.json();
}

export async function processTursoReferral(refCode: string, email?: string, deviceFingerprint?: string) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/referral/process', {
    method: 'POST',
    headers,
    body: JSON.stringify({ refCode, email, deviceFingerprint })
  });
  if (!res.ok) throw new Error('Failed to process referral');
  return res.json();
}

// -----------------------------------------------------------------------------
// LIKES API
// -----------------------------------------------------------------------------
export async function getTursoLikes(contentId: string, userId?: string) {
  const targetUid = userId || auth.currentUser?.uid || '';
  const key = `likes_${contentId}_${targetUid}`;
  return fetchDeduplicated(key, async () => {
    const headers = await getAuthHeaders();
    const url = `/api/turso/likes?contentId=${encodeURIComponent(contentId)}${targetUid ? `&userId=${encodeURIComponent(targetUid)}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch content likes');
    return res.json();
  });
}

export async function getTursoUserLikes() {
  const uid = auth.currentUser?.uid || 'guest';
  return fetchDeduplicated(`user_likes_${uid}`, async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/turso/likes/user', { headers });
    if (!res.ok) throw new Error('Failed to fetch user likes');
    return res.json();
  });
}

export async function toggleTursoLike(contentId: string) {
  const headers = await getAuthHeaders();
  const userId = auth.currentUser?.uid;
  const res = await fetch('/api/turso/likes/toggle', {
    method: 'POST',
    headers,
    body: JSON.stringify({ contentId, userId })
  });
  if (!res.ok) throw new Error('Failed to toggle like');
  return res.json();
}

// -----------------------------------------------------------------------------
// COMMENTS & COMMENT LIKES API (WITH TURSO PER-USER TRACKING)
// -----------------------------------------------------------------------------
export async function getTursoComments(contentId: string, since?: string, limit = 50, offset = 0, userId?: string) {
  const targetUid = userId || auth.currentUser?.uid || '';
  const key = `comments_${contentId}_${since || ''}_${limit}_${offset}_${targetUid}`;
  return fetchDeduplicated(key, async () => {
    const headers = await getAuthHeaders();
    let url = `/api/turso/comments?contentId=${encodeURIComponent(contentId)}&limit=${limit}&offset=${offset}`;
    if (since) {
      url += `&since=${encodeURIComponent(since)}`;
    }
    if (targetUid) {
      url += `&userId=${encodeURIComponent(targetUid)}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
  });
}

export async function addTursoComment(
  contentId: string,
  text: string,
  username?: string,
  avatar?: string,
  parentCommentId?: string | null
) {
  const headers = await getAuthHeaders();
  const userId = auth.currentUser?.uid;
  const res = await fetch('/api/turso/comments/add', {
    method: 'POST',
    headers,
    body: JSON.stringify({ contentId, text, username, avatar, parentCommentId, userId })
  });
  if (!res.ok) throw new Error('Failed to post comment');
  return res.json();
}

export async function deleteTursoComment(commentId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/comments/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ commentId })
  });
  if (!res.ok) throw new Error('Failed to delete comment');
  return res.json();
}

export async function toggleTursoCommentLike(commentId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/comments/like/toggle', {
    method: 'POST',
    headers,
    body: JSON.stringify({ commentId })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to toggle comment like');
  }
  return res.json();
}

export async function getTursoCommentLikes(commentId: string, userId?: string) {
  const targetUid = userId || auth.currentUser?.uid || '';
  const key = `comment_likes_${commentId}_${targetUid}`;
  return fetchDeduplicated(key, async () => {
    const headers = await getAuthHeaders();
    const url = `/api/turso/comments/likes?commentId=${encodeURIComponent(commentId)}${targetUid ? `&userId=${encodeURIComponent(targetUid)}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch comment likes');
    return res.json();
  });
}

// -----------------------------------------------------------------------------
// WATCH PROGRESS & REWARDS API
// -----------------------------------------------------------------------------
export async function syncTursoWatchProgress(contentId: string, progressSeconds: number, durationSeconds: number, completed = false) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/watch-progress/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({ contentId, progressSeconds, durationSeconds, completed })
  });
  if (!res.ok) throw new Error('Failed to sync watch progress');
  return res.json();
}

export async function getTursoWatchProgressList() {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/watch-progress/list', { headers });
  if (!res.ok) throw new Error('Failed to fetch watch progress list');
  return res.json();
}

export async function clearTursoWatchProgress(explicitUserId?: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/turso/watch-progress/clear', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: explicitUserId })
    });
    if (!res.ok) throw new Error('Failed to clear watch progress');
    return await res.json();
  } catch (err) {
    console.warn('[Turso Client] clearTursoWatchProgress error:', err);
    return { success: false };
  }
}

export async function claimTursoWatchReward(contentId: string, milestone: string) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/turso/watch-rewards/claim', {
    method: 'POST',
    headers,
    body: JSON.stringify({ contentId, milestone })
  });
  if (!res.ok) throw new Error('Failed to claim reward');
  return res.json();
}

export async function syncFcmToken(token: string): Promise<boolean> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return false;
  
  try {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch('/api/turso/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ token })
    });
    return res.ok;
  } catch (err) {
    console.error('[Turso Client] Failed to sync FCM token:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// TURSO WATCH PARTY CLIENT METHODS
// -----------------------------------------------------------------------------

export async function syncTursoWatchPartyRoomClient(payload: {
  partyId: string;
  hostUid: string;
  mediaId: string;
  mediaTitle: string;
  status?: string;
  roomCode?: string;
  started_at?: number | null;
  is_playing?: boolean;
  last_state_change_at?: number | null;
  total_paused_duration?: number;
  current_position?: number;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/turso/watch-party/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.warn('[Turso Client] syncTursoWatchPartyRoomClient error:', err);
    return false;
  }
}

export async function updateTursoWatchPartyPlaybackClient(
  partyIdOrPayload: string | { partyId: string; [key: string]: any },
  maybeState?: {
    started_at?: number | null;
    is_playing?: boolean;
    last_state_change_at?: number | null;
    total_paused_duration?: number;
    current_position?: number;
    status?: string;
  }
): Promise<boolean> {
  try {
    const payload = typeof partyIdOrPayload === 'string'
      ? { partyId: partyIdOrPayload, ...maybeState }
      : partyIdOrPayload;

    const res = await fetch('/api/turso/watch-party/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.warn('[Turso Client] updateTursoWatchPartyPlaybackClient error:', err);
    return false;
  }
}

export async function getTursoWatchPartyStateClient(partyId: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/turso/watch-party/state?partyId=${encodeURIComponent(partyId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Turso Client] getTursoWatchPartyStateClient error:', err);
    return null;
  }
}

export async function syncTursoStreak(payload: { clientDate: string; explicitUserId?: string }): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/turso/streak/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientDate: payload.clientDate,
        userId: payload.explicitUserId || auth.currentUser?.uid
      })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Turso Client] syncTursoStreak notice:', err);
    return null;
  }
}

export async function fetchTursoAchievements(explicitUserId?: string): Promise<any[]> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch(`/api/turso/achievements?userId=${encodeURIComponent(uid)}`, {
      headers
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.achievements || [];
  } catch (err) {
    console.warn('[Turso Client] fetchTursoAchievements error:', err);
    return [];
  }
}

export async function unlockTursoAchievementClient(
  achievementKey: string,
  tier: number = 1,
  explicitUserId?: string
): Promise<{ success: boolean; newlyUnlocked: boolean; achievement?: any }> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch('/api/turso/achievements/unlock', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        achievementKey,
        tier,
        userId: uid
      })
    });
    if (!res.ok) return { success: false, newlyUnlocked: false };
    return await res.json();
  } catch (err) {
    console.warn('[Turso Client] unlockTursoAchievementClient error:', err);
    return { success: false, newlyUnlocked: false };
  }
}

export async function fetchTursoTierProgress(explicitUserId?: string): Promise<Record<string, { currentTier: number; progressValue: number }>> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch(`/api/turso/tier-progress?userId=${encodeURIComponent(uid)}`, {
      headers
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.progress || {};
  } catch (err) {
    console.warn('[Turso Client] fetchTursoTierProgress error:', err);
    return {};
  }
}

export async function syncTursoTierProgressClient(
  category: string,
  currentTier: number,
  progressValue: number,
  explicitUserId?: string
): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch('/api/turso/tier-progress/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category,
        currentTier,
        progressValue,
        userId: uid
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.warn('[Turso Client] syncTursoTierProgressClient error:', err);
    return false;
  }
}

export async function fetchTursoWeeklyChallenges(isoWeek: string, explicitUserId?: string): Promise<any[]> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch(`/api/turso/weekly-challenges?isoWeek=${encodeURIComponent(isoWeek)}&userId=${encodeURIComponent(uid)}`, {
      headers
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.challenges || [];
  } catch (err) {
    console.warn('[Turso Client] fetchTursoWeeklyChallenges error:', err);
    return [];
  }
}

export async function syncTursoWeeklyChallengesClient(
  isoWeek: string,
  challengeTemplates: any[],
  explicitUserId?: string
): Promise<any[]> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch('/api/turso/weekly-challenges/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        isoWeek,
        challengeTemplates,
        userId: uid
      })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.challenges || [];
  } catch (err) {
    console.warn('[Turso Client] syncTursoWeeklyChallengesClient error:', err);
    return [];
  }
}

export async function updateTursoWeeklyChallengeProgressClient(
  isoWeek: string,
  challengeKey: string,
  progressDelta?: number,
  absoluteProgress?: number,
  explicitUserId?: string
): Promise<{ success: boolean; newlyCompleted: boolean; challenge?: any }> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid || 'guest';
    const res = await fetch('/api/turso/weekly-challenges/progress', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        isoWeek,
        challengeKey,
        progressDelta,
        absoluteProgress,
        userId: uid
      })
    });
    if (!res.ok) return { success: false, newlyCompleted: false };
    return await res.json();
  } catch (err) {
    console.warn('[Turso Client] updateTursoWeeklyChallengeProgressClient error:', err);
    return { success: false, newlyCompleted: false };
  }
}

// -----------------------------------------------------------------------------
// LEADERBOARD API (PRECOMPUTED CACHE, QUOTA EFFICIENT)
// -----------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  previous_rank?: number | null;
  rank_delta?: number;
  user_id: string;
  username: string;
  avatar_url: string;
  level: number;
  xp: number;
  points: number;
  watch_seconds?: number;
  current_streak?: number;
  streak_penalty?: number;
  unlocked_achievements_count?: number;
  rank_tier: string;
  rank_sub: number | null;
}

export interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  computed_at: string;
}

export interface LeaderboardMeResponse {
  success: boolean;
  rank: number;
  previous_rank?: number | null;
  rank_delta?: number;
  user_id: string;
  username: string;
  avatar_url: string;
  level: number;
  xp: number;
  points: number;
  watch_seconds?: number;
  current_streak?: number;
  streak_penalty?: number;
  unlocked_achievements_count?: number;
  rank_tier: string;
  rank_sub: number | null;
  in_top_50: boolean;
  in_top_100: boolean;
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const res = await fetch('/api/leaderboard');
  if (!res.ok) {
    throw new Error('Failed to fetch leaderboard');
  }
  return res.json();
}

export async function fetchMyLeaderboardRank(explicitUserId?: string): Promise<LeaderboardMeResponse | null> {
  try {
    const headers = await getAuthHeaders();
    const uid = explicitUserId || auth.currentUser?.uid;
    const url = uid ? `/api/leaderboard/me?userId=${encodeURIComponent(uid)}` : '/api/leaderboard/me';
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return data;
  } catch (err) {
    console.warn('[Turso Client] fetchMyLeaderboardRank error:', err);
    return null;
  }
}

export async function triggerLeaderboardRefresh(): Promise<{ success: boolean; count: number; computed_at: string }> {
  try {
    const res = await fetch('/api/leaderboard/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to refresh leaderboard');
    return res.json();
  } catch (err) {
    console.warn('[Turso Client] triggerLeaderboardRefresh error:', err);
    throw err;
  }
}



