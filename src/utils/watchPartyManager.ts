import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getXpAccount } from './xpSystem';
import { getCurrentUserPublicProfile } from './memberSystem';
import {
  syncTursoWatchPartyRoomClient,
  updateTursoWatchPartyPlaybackClient,
} from './tursoClient';
import { evaluateAchievements } from './achievementSystem';
import { MEDIA_CATALOG } from '../data/mediaData';
import { getVerifiedDuration, parseDurationToSeconds } from './durationStore';

export interface WatchInviteDoc {
  id: string;
  hostUid: string;
  guestUid: string;
  hostName: string;
  hostAvatar: string;
  mediaId: string;
  episodeId?: string;
  mediaTitle: string;
  mediaThumbnail: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: number;
}

export interface WatchPartyPlayerState {
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
  lastActionBy: string;
  actionType?: 'play' | 'pause' | 'seek' | 'sync';
  started_at?: number | null;
  is_playing?: boolean;
  last_state_change_at?: number | null;
  total_paused_duration?: number;
  durationSeconds?: number;
}

export interface WatchPartyViewer {
  uid: string;
  name: string;
  avatar: string;
}

export interface WatchPartyDoc {
  partyId: string;
  hostUid: string;
  guestUid: string;
  hostName: string;
  guestName: string;
  hostAvatar: string;
  guestAvatar: string;
  mediaId: string;
  episodeId?: string;
  mediaTitle: string;
  mediaThumbnail: string;
  status: 'active' | 'ended';
  playerState: WatchPartyPlayerState;
  createdAt: number;
  roomCode?: string;
  isPublic?: boolean;
  viewers?: WatchPartyViewer[];
  started_at?: number | null;
  is_playing?: boolean;
  last_state_change_at?: number | null;
  total_paused_duration?: number;
  durationSeconds?: number;
}

/**
 * Resolve the media/episode total duration in seconds from verified cache, catalog, or presets.
 */
export function resolvePartyDurationSeconds(
  mediaId?: string,
  episodeId?: string,
  explicitDuration?: number
): number {
  if (explicitDuration && explicitDuration > 0) return explicitDuration;
  if (!mediaId) return 0;

  // 1. Check verified storage first
  const verified = getVerifiedDuration(episodeId || mediaId);
  if (verified) {
    const parsed = parseDurationToSeconds(verified);
    if (parsed > 0) return parsed;
  }

  // 2. Look up in catalog
  const media = MEDIA_CATALOG.find((m) => m.id === mediaId);
  if (media) {
    if (episodeId && media.episodes) {
      const ep = media.episodes.find((e) => e.id === episodeId);
      if (ep?.duration) {
        const parsed = parseDurationToSeconds(ep.duration);
        if (parsed > 0) return parsed;
      }
    }
    if (media.duration) {
      const parsed = parseDurationToSeconds(media.duration);
      if (parsed > 0) return parsed;
    }
  }

  return 0;
}

/**
 * Calculate the true current playback position based on elapsed server time:
 * current_position = (now - started_at) - total_paused_duration
 * (accounting for any pauses the host triggered).
 *
 * Runs continuously in the background even if zero viewers were connected.
 * If the elapsed time exceeds the video duration, it marks hasEnded: true.
 */
export function calculatePartyCurrentPosition(
  playerState?: Partial<WatchPartyPlayerState> | null,
  partyDoc?: Partial<WatchPartyDoc> | null,
  maxDuration?: number
): { currentPosition: number; isPlaying: boolean; hasStarted: boolean; hasEnded: boolean } {
  const startedAt = playerState?.started_at ?? partyDoc?.started_at ?? null;
  const isPlaying = playerState?.is_playing ?? playerState?.isPlaying ?? partyDoc?.is_playing ?? false;
  const lastStateChangeAt = playerState?.last_state_change_at ?? partyDoc?.last_state_change_at ?? null;
  const totalPausedDuration = playerState?.total_paused_duration ?? partyDoc?.total_paused_duration ?? 0;

  const durationLimit =
    maxDuration ||
    playerState?.durationSeconds ||
    partyDoc?.durationSeconds ||
    resolvePartyDurationSeconds(partyDoc?.mediaId, partyDoc?.episodeId) ||
    0;

  if (!startedAt) {
    return {
      currentPosition: Math.max(0, playerState?.currentTime || 0),
      isPlaying: false,
      hasStarted: false,
      hasEnded: false,
    };
  }

  const now = Date.now();
  let calculatedSeconds = 0;

  if (isPlaying) {
    // Advancing in real time
    const elapsedSinceStart = (now - startedAt) / 1000;
    calculatedSeconds = Math.max(0, elapsedSinceStart - totalPausedDuration);
  } else {
    // Paused: position is frozen at the moment of pause
    const pauseTime = lastStateChangeAt || now;
    const elapsedUntilPause = (pauseTime - startedAt) / 1000;
    calculatedSeconds = Math.max(0, elapsedUntilPause - totalPausedDuration);
  }

  let hasEnded = false;
  if (durationLimit > 0 && calculatedSeconds >= durationLimit) {
    calculatedSeconds = durationLimit;
    hasEnded = true;
  }

  return {
    currentPosition: Math.max(0, calculatedSeconds),
    isPlaying: isPlaying && !hasEnded,
    hasStarted: true,
    hasEnded,
  };
}

export interface ScheduledWatchPartyDoc {
  id: string;
  hostUid: string;
  hostName: string;
  hostAvatar: string;
  mediaId: string;
  episodeId?: string;
  mediaTitle: string;
  mediaThumbnail: string;
  scheduledTime: number;
  isPublic: boolean;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  createdAt: number;
  interestedUids?: string[];
  activePartyId?: string;
}

export interface SavedWatchPartyDoc {
  id: string;
  partyId: string;
  mediaId: string;
  episodeId?: string;
  mediaTitle: string;
  mediaThumbnail: string;
  hostName: string;
  hostAvatar: string;
  savedAt: number;
  duration: number;
  participantCount?: number;
  messagesCount?: number;
}

export interface WatchPartyMessage {
  id: string;
  partyId: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  type: 'chat' | 'reaction' | 'system';
  createdAt: number;
  videoTimestamp?: number;
}

/**
 * Send a Watch Together invitation to a friend
 */
export async function sendWatchPartyInvite(
  guestMember: { userId?: string; cardNumber: string; name: string; avatarUrl: string },
  media: { id: string; title: string; poster?: string; backdrop?: string },
  episode?: { id: string; title: string; thumbnail?: string }
): Promise<{ success: boolean; inviteId?: string; message?: string }> {
  try {
    const currentUser = auth.currentUser;
    const myProfile = getCurrentUserPublicProfile();
    const hostUid = currentUser?.uid || myProfile.cardNumber;
    const guestUid = guestMember.userId || guestMember.cardNumber;

    if (hostUid === guestUid) {
      return { success: false, message: 'You cannot invite yourself.' };
    }

    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const inviteRef = doc(db, 'watch_invites', inviteId);

    const mediaTitle = episode ? `${media.title} - ${episode.title}` : media.title;
    const mediaThumbnail = episode?.thumbnail || media.backdrop || media.poster || '';

    const payload: Omit<WatchInviteDoc, 'id'> = {
      hostUid,
      guestUid,
      hostName: myProfile.name,
      hostAvatar: myProfile.avatarUrl,
      mediaId: media.id,
      episodeId: episode?.id || '',
      mediaTitle,
      mediaThumbnail,
      status: 'pending',
      createdAt: Date.now(),
    };

    await setDoc(inviteRef, payload);
    return { success: true, inviteId };
  } catch (err: any) {
    console.error('Failed to send watch invite:', err);
    return { success: false, message: err?.message || 'Could not send watch invite.' };
  }
}

/**
 * Subscribe to pending invitations received by the current user
 */
export function subscribeToPendingInvites(
  uid: string,
  callback: (invites: WatchInviteDoc[]) => void
): () => void {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'watch_invites'),
    where('guestUid', '==', uid),
    where('status', '==', 'pending'),
    limit(5)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const invites: WatchInviteDoc[] = [];
      snapshot.forEach((docSnap) => {
        invites.push({ id: docSnap.id, ...(docSnap.data() as Omit<WatchInviteDoc, 'id'>) });
      });
      callback(invites);
    },
    (err) => {
      console.warn('Error listening for watch invites:', err);
      callback([]);
    }
  );
}

/**
 * Respond to an invitation (Accept or Decline)
 */
export async function respondToWatchInvite(
  invite: WatchInviteDoc,
  accept: boolean
): Promise<{ success: boolean; partyId?: string; partyData?: WatchPartyDoc; message?: string }> {
  try {
    const inviteRef = doc(db, 'watch_invites', invite.id);
    const newStatus = accept ? 'accepted' : 'declined';

    await updateDoc(inviteRef, { status: newStatus });

    if (!accept) {
      return { success: true, message: 'Declined invite.' };
    }

    // If accepted, create or join the watch party session
    const partyId = `party_${invite.id}`;
    const partyRef = doc(db, 'watch_parties', partyId);
    const myProfile = getCurrentUserPublicProfile();

    const partyDocData: WatchPartyDoc = {
      partyId,
      hostUid: invite.hostUid,
      guestUid: invite.guestUid,
      hostName: invite.hostName,
      guestName: myProfile.name,
      hostAvatar: invite.hostAvatar,
      guestAvatar: myProfile.avatarUrl,
      mediaId: invite.mediaId,
      episodeId: invite.episodeId || '',
      mediaTitle: invite.mediaTitle,
      mediaThumbnail: invite.mediaThumbnail,
      status: 'active',
      playerState: {
        currentTime: 0,
        isPlaying: false,
        updatedAt: Date.now(),
        lastActionBy: myProfile.userId || invite.guestUid,
        actionType: 'pause',
        started_at: null,
        is_playing: false,
        last_state_change_at: null,
        total_paused_duration: 0,
      },
      started_at: null,
      is_playing: false,
      last_state_change_at: null,
      total_paused_duration: 0,
      createdAt: Date.now(),
    };

    await setDoc(partyRef, partyDocData, { merge: true });

    // Sync room to Turso
    syncTursoWatchPartyRoomClient({
      partyId,
      hostUid: invite.hostUid,
      mediaId: invite.mediaId,
      mediaTitle: invite.mediaTitle,
      status: 'active',
      started_at: null,
      is_playing: false,
      last_state_change_at: null,
      total_paused_duration: 0,
      current_position: 0,
    }).catch(() => {});

    // Send a system welcome message into the room
    await sendPartyMessage(partyId, `${myProfile.name} joined the watch party!`, 'system');

    return { success: true, partyId, partyData: partyDocData };
  } catch (err: any) {
    console.error('Failed to respond to watch invite:', err);
    return { success: false, message: err?.message || 'Failed to join party.' };
  }
}

/**
 * Update player sync state (fired on Play, Pause, Seek actions)
 */
export async function updatePartyPlayerState(
  partyId: string,
  state: Partial<WatchPartyPlayerState>
): Promise<void> {
  if (!partyId) return;

  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    const currentUser = auth.currentUser;
    const myProfile = getCurrentUserPublicProfile();
    const updaterUid = currentUser?.uid || myProfile.cardNumber;

    const fullState: WatchPartyPlayerState = {
      currentTime: Math.max(0, state.currentTime || 0),
      isPlaying: state.isPlaying ?? (state.is_playing ?? true),
      updatedAt: Date.now(),
      lastActionBy: updaterUid,
      actionType: state.actionType || 'sync',
      started_at: state.started_at !== undefined ? state.started_at : null,
      is_playing: state.is_playing !== undefined ? state.is_playing : (state.isPlaying ?? true),
      last_state_change_at: state.last_state_change_at !== undefined ? state.last_state_change_at : Date.now(),
      total_paused_duration: state.total_paused_duration !== undefined ? state.total_paused_duration : 0,
    };

    const updatePayload: Record<string, any> = {
      playerState: fullState,
    };
    if (state.started_at !== undefined) updatePayload.started_at = state.started_at;
    if (state.is_playing !== undefined) updatePayload.is_playing = state.is_playing;
    if (state.last_state_change_at !== undefined) updatePayload.last_state_change_at = state.last_state_change_at;
    if (state.total_paused_duration !== undefined) updatePayload.total_paused_duration = state.total_paused_duration;

    await updateDoc(partyRef, updatePayload);

    // Sync to Turso database in background
    updateTursoWatchPartyPlaybackClient(partyId, {
      started_at: state.started_at,
      is_playing: state.is_playing ?? state.isPlaying,
      last_state_change_at: state.last_state_change_at,
      total_paused_duration: state.total_paused_duration,
      current_position: state.currentTime,
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to update party player state:', err);
  }
}

/**
 * Send a live chat message or reaction in a watch party
 */
export async function sendPartyMessage(
  partyId: string,
  text: string,
  type: 'chat' | 'reaction' | 'system' = 'chat',
  videoTimestamp?: number
): Promise<void> {
  if (!partyId || !text.trim()) return;

  try {
    const messagesCol = collection(db, 'watch_parties', partyId, 'messages');
    const myProfile = getCurrentUserPublicProfile();

    const msgData: Omit<WatchPartyMessage, 'id'> = {
      partyId,
      senderUid: auth.currentUser?.uid || myProfile.cardNumber,
      senderName: myProfile.name,
      senderAvatar: myProfile.avatarUrl,
      text: text.trim(),
      type,
      createdAt: Date.now(),
      videoTimestamp: videoTimestamp !== undefined ? Math.floor(videoTimestamp) : undefined,
    };

    await addDoc(messagesCol, msgData);
  } catch (err) {
    console.warn('Failed to send watch party message:', err);
  }
}

/**
 * Subscribe to watch party state updates
 */
export function subscribeToWatchParty(
  partyId: string,
  callback: (party: WatchPartyDoc | null) => void
): () => void {
  if (!partyId) {
    callback(null);
    return () => {};
  }

  const partyRef = doc(db, 'watch_parties', partyId);

  return onSnapshot(
    partyRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as WatchPartyDoc);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('Error subscribing to watch party:', err);
      callback(null);
    }
  );
}

/**
 * Subscribe to real-time party chat & reaction messages
 */
export function subscribeToPartyMessages(
  partyId: string,
  callback: (messages: WatchPartyMessage[]) => void
): () => void {
  if (!partyId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'watch_parties', partyId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: WatchPartyMessage[] = [];
      snapshot.forEach((docSnap) => {
        messages.push({ id: docSnap.id, ...(docSnap.data() as Omit<WatchPartyMessage, 'id'>) });
      });
      callback(messages);
    },
    (err) => {
      console.warn('Error subscribing to party messages:', err);
      callback([]);
    }
  );
}

/**
 * Leave a watch party without ending it. Reassigns host controls if the host leaves.
 */
export async function leaveWatchParty(partyId: string, uid: string): Promise<void> {
  if (!partyId) return;

  try {
    const myProfile = getCurrentUserPublicProfile();
    await sendPartyMessage(partyId, `${myProfile.name} left the watch party.`, 'system');
    await removeViewerFromParty(partyId, uid);

    // If the leaving user was the host, reassign host to the next viewer so the party continues
    const partyRef = doc(db, 'watch_parties', partyId);
    const snap = await getDoc(partyRef);
    if (snap.exists()) {
      const data = snap.data() as WatchPartyDoc;
      if (data.status === 'active' && data.hostUid === uid) {
        const remaining = (data.viewers || []).filter((v) => v.uid !== uid);
        if (remaining.length > 0) {
          const nextHost = remaining[0];
          await updateDoc(partyRef, {
            hostUid: nextHost.uid,
            hostName: nextHost.name,
            hostAvatar: nextHost.avatar,
          });
          await sendPartyMessage(
            partyId,
            `Host controls reassigned to ${nextHost.name}.`,
            'system'
          );
        }
      }
    }
  } catch (err) {
    console.warn('Error leaving watch party:', err);
  }
}

/**
 * End a watch party for everyone
 */
export async function endWatchParty(partyId: string): Promise<void> {
  if (!partyId) return;

  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    await updateDoc(partyRef, { status: 'ended' });
  } catch (err) {
    console.warn('Error ending watch party:', err);
  }
}

/**
 * Generate a unique 7-character room code (e.g., FK9C7XY) that:
 * 1. Starts with "FK"
 * 2. Appends the last 3 alphanumeric characters of the host's ID (or "XXX" as a fallback)
 * 3. Appends 2 random uppercase letters/numbers.
 * This code is verified to be unique among active watch parties.
 */
export async function generateUniqueRoomCode(hostUid?: string): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  // Clean hostUid to get only alphanumeric characters
  const cleanUid = (hostUid || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // Grab the last 3 characters, or 'XXX' if not enough characters
  const idSuffix = cleanUid.length >= 3 ? cleanUid.slice(-3) : 'XXX';

  let attempts = 0;
  while (attempts < 50) {
    let randomPart = '';
    for (let i = 0; i < 2; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `FK${idSuffix}${randomPart}`;

    const q = query(
      collection(db, 'watch_parties'),
      where('roomCode', '==', code),
      where('status', '==', 'active'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return code;
    }
    attempts++;
  }
  return 'FK' + idSuffix + Math.floor(10 + Math.random() * 90);
}

/**
 * Start a brand new watch party with a shareable room code (Host side)
 */
export async function createWatchPartyByHost(
  media: { id: string; title: string; poster?: string; backdrop?: string },
  episode?: { id: string; title: string; thumbnail?: string },
  isPublic: boolean = false
): Promise<{ success: boolean; partyData?: WatchPartyDoc; message?: string }> {
  try {
    const currentUser = auth.currentUser;
    const myProfile = getCurrentUserPublicProfile();
    const hostUid = currentUser?.uid || myProfile.cardNumber;

    const roomCode = await generateUniqueRoomCode(hostUid);
    const partyId = `party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const partyRef = doc(db, 'watch_parties', partyId);
    
    const mediaTitle = episode ? `${media.title} - ${episode.title}` : media.title;
    const mediaThumbnail = episode?.thumbnail || media.backdrop || media.poster || '';

    const hostViewer = {
      uid: hostUid,
      name: myProfile.name,
      avatar: myProfile.avatarUrl,
    };

    const durationSeconds = resolvePartyDurationSeconds(media.id, episode?.id);

    const partyDocData: WatchPartyDoc = {
      partyId,
      hostUid,
      guestUid: '',
      hostName: myProfile.name,
      guestName: '',
      hostAvatar: myProfile.avatarUrl,
      guestAvatar: '',
      mediaId: media.id,
      episodeId: episode?.id || '',
      mediaTitle,
      mediaThumbnail,
      status: 'active',
      durationSeconds,
      playerState: {
        currentTime: 0,
        isPlaying: false,
        updatedAt: Date.now(),
        lastActionBy: hostUid,
        actionType: 'pause',
        started_at: null,
        is_playing: false,
        last_state_change_at: null,
        total_paused_duration: 0,
        durationSeconds,
      },
      started_at: null,
      is_playing: false,
      last_state_change_at: null,
      total_paused_duration: 0,
      createdAt: Date.now(),
      roomCode,
      isPublic,
      viewers: [hostViewer],
    };

    await setDoc(partyRef, partyDocData);

    // Trigger Party Starter achievement
    const account = getXpAccount();
    if (account && account.stats) {
      account.hasJoinedWatchParty = true;
      account.stats.watchPartiesCount = (account.stats.watchPartiesCount || 0) + 1;
      await evaluateAchievements(account);
    }

    // Sync room to Turso database
    syncTursoWatchPartyRoomClient({
      partyId,
      hostUid,
      mediaId: media.id,
      mediaTitle,
      status: 'active',
      roomCode,
      started_at: null,
      is_playing: false,
      last_state_change_at: null,
      total_paused_duration: 0,
      current_position: 0,
    }).catch(() => {});

    // Send a system welcome message into the room
    await sendPartyMessage(partyId, `${myProfile.name} started a Watch Party! Share code: ${roomCode}`, 'system');

    return { success: true, partyData: partyDocData };
  } catch (err: any) {
    console.error('Failed to create watch party:', err);
    return { success: false, message: err?.message || 'Failed to start watch party.' };
  }
}

/**
 * Join an active watch party using a room code (Guest/Participant side)
 */
export async function joinWatchPartyByCode(
  code: string
): Promise<{ success: boolean; partyData?: WatchPartyDoc; ended?: boolean; message?: string }> {
  try {
    const cleanCode = code.toUpperCase().trim();
    if (cleanCode.length !== 7 && cleanCode.length !== 6) {
      return { success: false, message: 'Invalid code length. Please enter a valid party code.' };
    }

    const q = query(
      collection(db, 'watch_parties'),
      where('roomCode', '==', cleanCode),
      where('status', '==', 'active'),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { success: false, message: 'Invalid or expired code. Please check and try again.' };
    }

    const docSnap = snap.docs[0];
    const partyData = docSnap.data() as WatchPartyDoc;

    const currentUser = auth.currentUser;
    const myProfile = getCurrentUserPublicProfile();
    const guestUid = currentUser?.uid || myProfile.cardNumber;

    const partyRef = doc(db, 'watch_parties', partyData.partyId);
    const posCalc = calculatePartyCurrentPosition(partyData.playerState, partyData);

    if (partyData.status === 'ended' || posCalc.hasEnded) {
      if (partyData.status === 'active') {
        updateDoc(partyRef, { status: 'ended' }).catch(() => {});
        updateTursoWatchPartyPlaybackClient({ partyId: partyData.partyId, status: 'ended' }).catch(() => {});
      }
      return {
        success: false,
        ended: true,
        partyData: { ...partyData, status: 'ended' },
        message: 'This watch party has ended.',
      };
    }

    if (partyData.hostUid === guestUid) {
      return {
        success: true,
        partyData: {
          ...partyData,
          playerState: {
            ...partyData.playerState,
            currentTime: posCalc.currentPosition,
            isPlaying: posCalc.isPlaying,
            is_playing: posCalc.isPlaying,
          },
        },
      };
    }

    const updatedFields = {
      guestUid,
      guestName: myProfile.name,
      guestAvatar: myProfile.avatarUrl,
    };

    await updateDoc(partyRef, updatedFields);

    // Trigger Party Starter achievement
    const account = getXpAccount();
    if (account && account.stats) {
      account.hasJoinedWatchParty = true;
      account.stats.watchPartiesCount = (account.stats.watchPartiesCount || 0) + 1;
      await evaluateAchievements(account);
    }

    const mergedPartyData: WatchPartyDoc = {
      ...partyData,
      ...updatedFields,
    };

    await sendPartyMessage(partyData.partyId, `${myProfile.name} joined the watch party!`, 'system');

    return {
      success: true,
      partyData: {
        ...mergedPartyData,
        playerState: {
          ...mergedPartyData.playerState,
          currentTime: posCalc.currentPosition,
          isPlaying: posCalc.isPlaying,
          is_playing: posCalc.isPlaying,
        },
      },
    };
  } catch (err: any) {
    console.error('Failed to join watch party:', err);
    return { success: false, message: err?.message || 'Failed to join party.' };
  }
}

/**
 * Add a viewer to a watch party (real-time count/avatar row sync)
 */
export async function addViewerToParty(
  partyId: string,
  viewer: { uid: string; name: string; avatar: string }
): Promise<void> {
  if (!partyId) return;
  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    await updateDoc(partyRef, {
      viewers: arrayUnion(viewer),
    });
  } catch (err) {
    console.warn('Failed to add viewer to party:', err);
  }
}

/**
 * Remove a viewer from a watch party cleanly
 */
export async function removeViewerFromParty(
  partyId: string,
  uid: string
): Promise<void> {
  if (!partyId) return;
  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    const snap = await getDoc(partyRef);
    if (!snap.exists()) return;
    const data = snap.data() as WatchPartyDoc;
    const currentViewers = data.viewers || [];
    const viewerToRemove = currentViewers.find((v) => v.uid === uid);
    if (viewerToRemove) {
      await updateDoc(partyRef, {
        viewers: arrayRemove(viewerToRemove),
      });
    }
  } catch (err) {
    console.warn('Failed to remove viewer from party:', err);
  }
}

/**
 * Join an active public watch party cleanly
 */
export async function joinPublicWatchParty(
  partyId: string
): Promise<{ success: boolean; partyData?: WatchPartyDoc; message?: string }> {
  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    const snap = await getDoc(partyRef);
    if (!snap.exists()) {
      return { success: false, message: 'Party not found.' };
    }
    const partyData = snap.data() as WatchPartyDoc;
    const posCalc = calculatePartyCurrentPosition(partyData.playerState, partyData);

    if (partyData.status !== 'active' || posCalc.hasEnded) {
      if (partyData.status === 'active') {
        updateDoc(partyRef, { status: 'ended' }).catch(() => {});
        updateTursoWatchPartyPlaybackClient({ partyId, status: 'ended' }).catch(() => {});
      }
      return { success: false, message: 'This party has already ended.' };
    }

    const currentUser = auth.currentUser;
    const myProfile = getCurrentUserPublicProfile();
    const guestUid = currentUser?.uid || myProfile.cardNumber;

    if (partyData.hostUid !== guestUid) {
      if (!partyData.guestUid) {
        await updateDoc(partyRef, {
          guestUid,
          guestName: myProfile.name,
          guestAvatar: myProfile.avatarUrl,
        });
      }
      await sendPartyMessage(partyId, `${myProfile.name} joined the watch party!`, 'system');

      // Trigger Party Starter achievement
      const account = getXpAccount();
      if (account && account.stats) {
        account.hasJoinedWatchParty = true;
        account.stats.watchPartiesCount = (account.stats.watchPartiesCount || 0) + 1;
        await evaluateAchievements(account);
      }
    }

    const updatedSnap = await getDoc(partyRef);
    const pData = updatedSnap.data() as WatchPartyDoc;
    const finalCalc = calculatePartyCurrentPosition(pData.playerState, pData);
    return {
      success: true,
      partyData: {
        ...pData,
        playerState: {
          ...pData.playerState,
          currentTime: finalCalc.currentPosition,
          isPlaying: finalCalc.isPlaying,
          is_playing: finalCalc.isPlaying,
        },
      },
    };
  } catch (err: any) {
    console.error('Failed to join public watch party:', err);
    return { success: false, message: err?.message || 'Failed to join party.' };
  }
}

/**
 * Subscribe to all live public watch parties
 */
export function subscribeToLivePublicParties(
  callback: (parties: WatchPartyDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'watch_parties'),
    where('status', '==', 'active'),
    where('isPublic', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const parties: WatchPartyDoc[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as WatchPartyDoc;
        const posCalc = calculatePartyCurrentPosition(p.playerState, p);
        if (posCalc.hasEnded) {
          updateDoc(docSnap.ref, { status: 'ended' }).catch(() => {});
          updateTursoWatchPartyPlaybackClient({ partyId: p.partyId, status: 'ended' }).catch(() => {});
        } else {
          parties.push(p);
        }
      });
      callback(parties);
    },
    (err) => {
      console.warn('Error subscribing to public parties:', err);
      callback([]);
    }
  );
}

/**
 * Subscribe to active parties for a specific title
 */
export function subscribeToActivePartiesForTitle(
  mediaId: string,
  callback: (parties: WatchPartyDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'watch_parties'),
    where('status', '==', 'active'),
    where('mediaId', '==', mediaId),
    where('isPublic', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const parties: WatchPartyDoc[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as WatchPartyDoc;
        const posCalc = calculatePartyCurrentPosition(p.playerState, p);
        if (posCalc.hasEnded) {
          updateDoc(docSnap.ref, { status: 'ended' }).catch(() => {});
          updateTursoWatchPartyPlaybackClient({ partyId: p.partyId, status: 'ended' }).catch(() => {});
        } else {
          parties.push(p);
        }
      });
      callback(parties);
    },
    (err) => {
      console.warn('Error subscribing to active parties for title:', err);
      callback([]);
    }
  );
}

/**
 * Create a scheduled watch party
 */
export async function createScheduledWatchParty(
  media: { id: string; title: string; poster?: string; backdrop?: string },
  episode: { id: string; title: string; thumbnail?: string } | undefined,
  scheduledTime: number,
  isPublic: boolean = false
): Promise<{ success: boolean; scheduledData?: ScheduledWatchPartyDoc; message?: string }> {
  try {
    const currentUser = auth.currentUser;
    const myProfile = getCurrentUserPublicProfile();
    const hostUid = currentUser?.uid || myProfile.cardNumber;

    const id = `scheduled_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const scheduledRef = doc(db, 'scheduled_watch_parties', id);

    const mediaTitle = episode ? `${media.title} - ${episode.title}` : media.title;
    const mediaThumbnail = episode?.thumbnail || media.backdrop || media.poster || '';

    const payload: ScheduledWatchPartyDoc = {
      id,
      hostUid,
      hostName: myProfile.name,
      hostAvatar: myProfile.avatarUrl,
      mediaId: media.id,
      episodeId: episode?.id || '',
      mediaTitle,
      mediaThumbnail,
      scheduledTime,
      isPublic,
      status: 'upcoming',
      createdAt: Date.now(),
      interestedUids: [],
    };

    await setDoc(scheduledRef, payload);
    return { success: true, scheduledData: payload };
  } catch (err: any) {
    console.error('Failed to create scheduled watch party:', err);
    return { success: false, message: err?.message || 'Failed to schedule watch party.' };
  }
}

/**
 * Cancel a scheduled watch party
 */
export async function cancelScheduledWatchParty(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'scheduled_watch_parties', id);
    await updateDoc(docRef, { status: 'cancelled' });
  } catch (err) {
    console.warn('Failed to cancel scheduled party:', err);
  }
}

/**
 * Link a scheduled watch party with an active party room and set status to 'live'
 */
export async function startScheduledPartyLive(scheduledId: string, partyId: string): Promise<void> {
  try {
    const docRef = doc(db, 'scheduled_watch_parties', scheduledId);
    await updateDoc(docRef, {
      status: 'live',
      activePartyId: partyId,
    });
  } catch (err) {
    console.warn('Failed to make scheduled party live:', err);
  }
}

/**
 * Complete a scheduled watch party
 */
export async function completeScheduledParty(scheduledId: string): Promise<void> {
  try {
    const docRef = doc(db, 'scheduled_watch_parties', scheduledId);
    await updateDoc(docRef, {
      status: 'completed',
    });
  } catch (err) {
    console.warn('Failed to complete scheduled party:', err);
  }
}

/**
 * Toggle user interest in a scheduled watch party
 */
export async function toggleInterestInScheduledParty(
  scheduledId: string,
  interested: boolean
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const uid = currentUser.uid;
    const docRef = doc(db, 'scheduled_watch_parties', scheduledId, 'interested_users', uid);
    const parentRef = doc(db, 'scheduled_watch_parties', scheduledId);

    if (interested) {
      await setDoc(docRef, {
        userId: uid,
        timestamp: Date.now(),
      });
      await updateDoc(parentRef, {
        interestedUids: arrayUnion(uid),
      });
    } else {
      await deleteDoc(docRef);
      await updateDoc(parentRef, {
        interestedUids: arrayRemove(uid),
      });
    }
  } catch (err) {
    console.warn('Failed to toggle interest:', err);
  }
}

/**
 * Subscribe to upcoming/active scheduled watch parties for a title
 */
export function subscribeToScheduledPartiesForTitle(
  mediaId: string,
  callback: (parties: ScheduledWatchPartyDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'scheduled_watch_parties'),
    where('status', 'in', ['upcoming', 'live']),
    where('mediaId', '==', mediaId),
    orderBy('scheduledTime', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const parties: ScheduledWatchPartyDoc[] = [];
      snapshot.forEach((docSnap) => {
        parties.push(docSnap.data() as ScheduledWatchPartyDoc);
      });
      callback(parties);
    },
    (err) => {
      console.warn('Error subscribing to scheduled parties for title:', err);
      callback([]);
    }
  );
}

/**
 * Subscribe to upcoming/active scheduled watch parties
 */
export function subscribeToScheduledParties(
  callback: (parties: ScheduledWatchPartyDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'scheduled_watch_parties'),
    where('status', 'in', ['upcoming', 'live']),
    orderBy('scheduledTime', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const parties: ScheduledWatchPartyDoc[] = [];
      snapshot.forEach((docSnap) => {
        parties.push(docSnap.data() as ScheduledWatchPartyDoc);
      });
      callback(parties);
    },
    (err) => {
      console.warn('Error subscribing to scheduled parties:', err);
      callback([]);
    }
  );
}

/**
 * Save a watch party replay with chat logs covering ONLY the watched duration
 */
export async function savePartyReplay(
  party: WatchPartyDoc,
  duration: number
): Promise<{ success: boolean; replayId?: string; message?: string }> {
  try {
    const replayId = `replay_${party.partyId}_${Date.now()}`;
    const replayRef = doc(db, 'saved_watch_parties', replayId);

    // Strictly constrain replay duration to the actually watched duration (e.g. 0 to 24:00)
    const watchedDuration = Math.max(10, Math.round(duration));

    // Copy chat messages to `/saved_watch_parties/{replayId}/messages`, filtering to watched duration
    const sourceCol = collection(db, 'watch_parties', party.partyId, 'messages');
    const snap = await getDocs(sourceCol);
    let chatCount = 0;
    
    for (const docSnap of snap.docs) {
      const msg = docSnap.data() as WatchPartyMessage;
      // Only include comments sent during the actually watched duration
      const msgTimestamp = msg.videoTimestamp ?? 0;
      if (msg.type === 'chat' && msg.text.trim() && msgTimestamp <= watchedDuration) {
        chatCount++;
        const destRef = doc(db, 'saved_watch_parties', replayId, 'messages', docSnap.id);
        await setDoc(destRef, {
          id: docSnap.id,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          senderUid: msg.senderUid,
          text: msg.text,
          videoTimestamp: msgTimestamp,
          createdAt: msg.createdAt,
        });
      }
    }

    const payload: SavedWatchPartyDoc = {
      id: replayId,
      partyId: party.partyId,
      mediaId: party.mediaId,
      episodeId: party.episodeId || '',
      mediaTitle: party.mediaTitle,
      mediaThumbnail: party.mediaThumbnail,
      hostName: party.hostName,
      hostAvatar: party.hostAvatar,
      savedAt: Date.now(),
      duration: watchedDuration,
      participantCount: Math.max(1, party.viewers?.length || (party.guestUid ? 2 : 1)),
      messagesCount: chatCount,
    };

    await setDoc(replayRef, payload);

    return { success: true, replayId };
  } catch (err: any) {
    console.error('Failed to save party replay:', err);
    return { success: false, message: err?.message || 'Failed to save replay.' };
  }
}

/**
 * Delete a saved party replay
 */
export async function deleteSavedPartyReplay(replayId: string): Promise<boolean> {
  if (!replayId) return false;
  try {
    const replayRef = doc(db, 'saved_watch_parties', replayId);
    await deleteDoc(replayRef);
    return true;
  } catch (err) {
    console.warn('Failed to delete saved party replay:', err);
    return false;
  }
}

/**
 * Fetch saved replays once (quota-optimized, non-streaming)
 */
export async function fetchSavedReplaysOnce(): Promise<SavedWatchPartyDoc[]> {
  try {
    const q = query(
      collection(db, 'saved_watch_parties'),
      orderBy('savedAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    const replays: SavedWatchPartyDoc[] = [];
    snap.forEach((d) => {
      replays.push(d.data() as SavedWatchPartyDoc);
    });
    return replays;
  } catch (err) {
    console.warn('Failed to fetch saved replays once:', err);
    return [];
  }
}

/**
 * Local Joined Parties Helpers (seamless leave and rejoin without re-entering code)
 */
const JOINED_PARTIES_KEY = 'farukat_joined_party_ids_v1';

export function getLocalJoinedPartyIds(): string[] {
  try {
    const raw = localStorage.getItem(JOINED_PARTIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalJoinedPartyId(partyId: string): void {
  if (!partyId) return;
  try {
    const current = getLocalJoinedPartyIds().filter((id) => id !== partyId);
    const updated = [partyId, ...current].slice(0, 10);
    localStorage.setItem(JOINED_PARTIES_KEY, JSON.stringify(updated));
  } catch {}
}

export function removeLocalJoinedPartyId(partyId: string): void {
  if (!partyId) return;
  try {
    const current = getLocalJoinedPartyIds().filter((id) => id !== partyId);
    localStorage.setItem(JOINED_PARTIES_KEY, JSON.stringify(current));
  } catch {}
}

/**
 * Fetch all comments/messages for a saved replay
 */
export async function fetchReplayMessages(replayId: string): Promise<WatchPartyMessage[]> {
  try {
    const colRef = collection(db, 'saved_watch_parties', replayId, 'messages');
    const snap = await getDocs(colRef);
    const msgs: WatchPartyMessage[] = [];
    snap.forEach((docSnap) => {
      msgs.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as WatchPartyMessage);
    });
    msgs.sort((a, b) => (a.videoTimestamp ?? 0) - (b.videoTimestamp ?? 0));
    return msgs;
  } catch (err) {
    console.warn('Failed to fetch replay messages:', err);
    return [];
  }
}

/**
 * Subscribe to saved replays list
 */
export function subscribeToSavedReplays(
  callback: (replays: SavedWatchPartyDoc[]) => void
): () => void {
  const q = query(
    collection(db, 'saved_watch_parties'),
    orderBy('savedAt', 'desc'),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const replays: SavedWatchPartyDoc[] = [];
      snapshot.forEach((docSnap) => {
        replays.push(docSnap.data() as SavedWatchPartyDoc);
      });
      callback(replays);
    },
    (err) => {
      console.warn('Error fetching saved replays:', err);
      callback([]);
    }
  );
}

/**
 * Direct rejoin for a party the user has previously entered (no code required).
 */
export async function rejoinWatchPartyDirect(
  partyId: string
): Promise<{ success: boolean; partyData?: WatchPartyDoc; ended?: boolean; message?: string }> {
  try {
    if (!partyId) return { success: false, message: 'Invalid party ID.' };
    const partyRef = doc(db, 'watch_parties', partyId);
    const snap = await getDoc(partyRef);
    if (!snap.exists()) {
      removeLocalJoinedPartyId(partyId);
      return { success: false, message: 'Watch party no longer exists.' };
    }
    const data = snap.data() as WatchPartyDoc;
    const posCalc = calculatePartyCurrentPosition(data.playerState, data);

    if (data.status !== 'active' || posCalc.hasEnded) {
      if (data.status === 'active') {
        updateDoc(partyRef, { status: 'ended' }).catch(() => {});
        updateTursoWatchPartyPlaybackClient({ partyId, status: 'ended' }).catch(() => {});
      }
      return {
        success: false,
        ended: true,
        partyData: {
          ...data,
          status: 'ended',
          playerState: {
            ...data.playerState,
            currentTime: posCalc.currentPosition,
            isPlaying: false,
            is_playing: false,
          },
        },
        message: 'Watch party has ended.',
      };
    }

    const myProfile = getCurrentUserPublicProfile();
    const myUid = myProfile.userId || myProfile.cardNumber;
    await addViewerToParty(partyId, {
      uid: myUid,
      name: myProfile.name,
      avatar: myProfile.avatarUrl,
    });
    saveLocalJoinedPartyId(partyId);

    return {
      success: true,
      partyData: {
        ...data,
        partyId,
        playerState: {
          ...data.playerState,
          currentTime: posCalc.currentPosition,
          isPlaying: posCalc.isPlaying,
          is_playing: posCalc.isPlaying,
        },
      },
    };
  } catch (err: any) {
    console.warn('Error rejoining watch party:', err);
    return { success: false, message: err?.message || 'Failed to rejoin party.' };
  }
}

const DISMISSED_ENDED_PROMPTS_KEY = 'farukat_dismissed_ended_party_prompts';

export function getDismissedEndedPromptIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISMISSED_ENDED_PROMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function dismissEndedPartyPrompt(partyId: string): void {
  if (!partyId || typeof window === 'undefined') return;
  try {
    const list = getDismissedEndedPromptIds();
    if (!list.includes(partyId)) {
      list.push(partyId);
      localStorage.setItem(DISMISSED_ENDED_PROMPTS_KEY, JSON.stringify(list));
    }
    removeLocalJoinedPartyId(partyId);
  } catch {}
}

/**
 * Scan locally joined parties and detect if any have finished playing
 * while the user was away or watching in background.
 */
export async function checkEndedJoinedParties(): Promise<WatchPartyDoc[]> {
  const joinedIds = getLocalJoinedPartyIds();
  if (joinedIds.length === 0) return [];

  const dismissed = new Set(getDismissedEndedPromptIds());
  const pendingEnded: WatchPartyDoc[] = [];

  for (const partyId of joinedIds) {
    if (dismissed.has(partyId)) continue;
    try {
      const partyRef = doc(db, 'watch_parties', partyId);
      const snap = await getDoc(partyRef);
      if (!snap.exists()) {
        removeLocalJoinedPartyId(partyId);
        continue;
      }
      const data = snap.data() as WatchPartyDoc;
      const posCalc = calculatePartyCurrentPosition(data.playerState, data);

      if (data.status === 'ended' || posCalc.hasEnded) {
        if (data.status === 'active') {
          updateDoc(partyRef, { status: 'ended' }).catch(() => {});
          updateTursoWatchPartyPlaybackClient({ partyId, status: 'ended' }).catch(() => {});
        }
        pendingEnded.push({
          ...data,
          status: 'ended',
          playerState: {
            ...data.playerState,
            currentTime: posCalc.currentPosition,
            isPlaying: false,
            is_playing: false,
          },
        });
      }
    } catch {
      // Continue next
    }
  }

  return pendingEnded;
}

