import {
  PublicMemberProfile,
  CardStatus,
  UserProfile,
  UserStats,
  CommentItem,
  XpAccount,
} from '../types';
import { getXpAccount, awardXp, saveXpAccount, createFreshXpAccountForUser, getActiveUserIdForXp, checkIsPro } from './xpSystem';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { isQuotaError, isQuotaExceeded, markQuotaExceeded } from './quotaHelper';
import { extractCardSegment } from './cardThemeStyles';
import { verifyTursoMember, getTursoCommunityMembers } from './tursoClient';

export const getFollowingKey = (uid?: string) => `farukat_user_following_${uid || auth.currentUser?.uid || 'guest'}`;
export const getFollowersKey = (uid?: string) => `farukat_user_followers_${uid || auth.currentUser?.uid || 'guest'}`;
const COMMUNITY_MEMBERS_KEY = 'farukat_community_members_v2';
const MEDIA_COMMENTS_KEY = 'farukat_media_comments_v2';

// Clean initial directory (No fake/mock users - only real users registered)
const INITIAL_COMMUNITY_MEMBERS: PublicMemberProfile[] = [];

/**
 * Retrieves the full community member directory from persistent storage
 */
export function getCommunityMembers(): PublicMemberProfile[] {
  try {
    const raw = localStorage.getItem(COMMUNITY_MEMBERS_KEY);
    if (!raw) {
      return [];
    }
    const members: PublicMemberProfile[] = JSON.parse(raw);
    if (!Array.isArray(members)) return [];

    // Deduplicate entries by unique identity (userId or cardNumber)
    const seen = new Map<string, PublicMemberProfile>();
    for (const m of members) {
      if (!m || !m.cardNumber) continue;
      const key = (m.userId && m.userId !== 'guest' ? m.userId : m.cardNumber).toUpperCase().trim();
      if (!seen.has(key)) {
        seen.set(key, m);
      } else {
        // Merge with existing
        seen.set(key, { ...seen.get(key)!, ...m });
      }
    }

    const uniqueMembers = Array.from(seen.values());
    if (uniqueMembers.length !== members.length) {
      try {
        localStorage.setItem(COMMUNITY_MEMBERS_KEY, JSON.stringify(uniqueMembers));
      } catch {}
    }
    return uniqueMembers;
  } catch {
    return [];
  }
}

/**
 * Sync the community directory and follow lists from the backend (Turso + Firestore)
 */
export async function syncCommunityWithBackend() {
  const memberMap = new Map<string, PublicMemberProfile>();

  // 1. First sync from Turso database (authoritative, high-performance)
  try {
    const tursoMembers = await getTursoCommunityMembers();
    if (Array.isArray(tursoMembers)) {
      for (const tm of tursoMembers) {
        if (tm && tm.cardNumber) {
          const key = (tm.userId || tm.cardNumber).toUpperCase();
          memberMap.set(key, tm);
        }
      }
    }
  } catch (tursoErr) {
    console.warn('[Community Sync] Turso fetch notice:', tursoErr);
  }

  // 2. Then sync from Firestore if available
  if (!isQuotaExceeded()) {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as XpAccount;
        if (data && data.profile) {
          const uid = docSnap.id;
          const followers = getFollowersList(uid);
          const following = getFollowingList(uid);
          const isProUser = checkIsPro(data) || checkIsPro(data.profile);
          const key = uid.toUpperCase();

          const existing = memberMap.get(key);
          const isGoldPrince = (data.profile.name && data.profile.name.toLowerCase().includes('goldprince')) || uid.toLowerCase().includes('goldprince');
          const finalLevel = isGoldPrince ? Math.max(data.currentLevel || existing?.level || 0, 500) : (data.currentLevel || existing?.level || 1);
          const finalXp = isGoldPrince ? Math.max(data.lifetimeXp || existing?.lifetimeXp || 0, 5000000) : (data.lifetimeXp || existing?.lifetimeXp || 0);

          memberMap.set(key, {
            cardNumber: data.profile.cardNumber || existing?.cardNumber || `FK-${uid.slice(0, 4).toUpperCase()}-PASS`,
            name: data.profile.name || (isGoldPrince ? 'GoldPrince STUDIO' : (existing?.name || 'Cinema Member')),
            avatarUrl: data.profile.avatarUrl || existing?.avatarUrl || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${uid}`,
            tier: isGoldPrince ? 'DIAMOND' : (data.profile.tier || existing?.tier || 'BRONZE'),
            level: finalLevel,
            lifetimeXp: finalXp,
            memberSince: data.profile.memberSince || existing?.memberSince || '2026',
            status: data.profile.status || 'Active',
            isOfficial: isGoldPrince || data.profile.role === 'Executive' || (data.currentLevel || 1) >= 8,
            isProMember: isGoldPrince || isProUser,
            isPro: isGoldPrince || isProUser,
            badge: `Level ${finalLevel} ${isGoldPrince ? 'DIAMOND' : (data.profile.tier || 'BRONZE')}`,
            bio: data.profile.bio || existing?.bio || 'FARUKAT Cinema Member',
            followersCount: followers.length,
            followingCount: following.length,
            emailMasked: maskEmail(data.profile.email || ''),
            isPublicProfile: data.profile.isPublicProfile !== false,
            cardTheme: data.profile.cardTheme || existing?.cardTheme || (isGoldPrince ? 'goldprince-era' : 'ivory-gold'),
            totalWatchSeconds: data.stats?.totalWatchSeconds || 0,
            ratingsGiven: data.stats?.ratingsGiven || 0,
            signatureUrl: data.profile.signatureUrl || existing?.signatureUrl,
            userId: uid,
            equippedCosmetics: data.equippedCosmetics || {},
            ownedCards: data.ownedCards || [],
            ownedCosmetics: data.ownedCosmetics || [],
          });
        }
      });
    } catch (e) {
      if (isQuotaError(e)) {
        markQuotaExceeded(e);
      }
      console.warn('Sync community with backend error:', e);
    }
  }

  // 3. Scan all local storage keys starting with farukat_xp_account_ to ensure other local profiles are searchable!
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('farukat_xp_account_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const acc = JSON.parse(raw) as XpAccount;
          if (acc?.profile?.cardNumber) {
            const uid = key.replace('farukat_xp_account_', '');
            const keyUpper = uid.toUpperCase();
            if (!memberMap.has(keyUpper)) {
              const followers = getFollowersList(uid);
              const following = getFollowingList(uid);
              const isProUser = checkIsPro(acc);
              memberMap.set(keyUpper, {
                cardNumber: acc.profile.cardNumber,
                name: acc.profile.name || 'Cinema Member',
                avatarUrl: acc.profile.avatarUrl || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${uid}`,
                tier: acc.profile.tier || 'BRONZE',
                level: acc.currentLevel || 1,
                lifetimeXp: acc.lifetimeXp || 0,
                memberSince: acc.profile.memberSince || '2026',
                status: acc.profile.status || 'Active',
                isOfficial: acc.profile.role === 'Executive' || (acc.currentLevel || 1) >= 8,
                isProMember: isProUser,
                isPro: isProUser,
                badge: `Level ${acc.currentLevel || 1} ${acc.profile.tier || 'BRONZE'}`,
                bio: acc.profile.bio || 'FARUKAT Cinema Member',
                followersCount: followers.length,
                followingCount: following.length,
                emailMasked: maskEmail(acc.profile.email || ''),
                isPublicProfile: acc.profile.isPublicProfile !== false,
                cardTheme: acc.profile.cardTheme || 'ivory-gold',
                totalWatchSeconds: acc.stats?.totalWatchSeconds || 0,
                ratingsGiven: acc.stats?.ratingsGiven || 0,
                signatureUrl: acc.profile.signatureUrl,
                userId: uid,
                equippedCosmetics: acc.equippedCosmetics || {},
                ownedCards: acc.ownedCards || [],
                ownedCosmetics: acc.ownedCosmetics || [],
              });
            }
          }
        }
      }
    }
  } catch (localErr) {
    console.warn('Sync community with local storage cache failed:', localErr);
  }

  const merged = Array.from(memberMap.values());
  if (merged.length > 0) {
    try {
      localStorage.setItem(COMMUNITY_MEMBERS_KEY, JSON.stringify(merged));
    } catch {}
  }
}

/**
 * Mask sensitive email addresses (e.g. a***a@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'Private Email';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Returns the current user's profile converted into a public view
 */
export function getCurrentUserPublicProfile(explicitUid?: string): PublicMemberProfile {
  const uid = explicitUid || auth.currentUser?.uid || 'guest';
  const account = getXpAccount(uid);
  const followers = getFollowersList(uid);
  const following = getFollowingList(uid);
  const isProUser = checkIsPro(account);

  return {
    cardNumber: account?.profile?.cardNumber || `FK-${uid.slice(0, 4).toUpperCase()}-PASS`,
    name: account?.profile?.name || 'Cinema Member',
    avatarUrl: account?.profile?.avatarUrl || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${uid}`,
    tier: account?.profile?.tier || 'BRONZE',
    level: account?.currentLevel || 1,
    lifetimeXp: account?.lifetimeXp || 0,
    memberSince: account?.profile?.memberSince || '2026',
    status: account?.profile?.status || 'Active',
    isOfficial: account?.profile?.role === 'Executive' || (account?.currentLevel || 1) >= 8,
    isProMember: isProUser,
    isPro: isProUser,
    badge: `Level ${account?.currentLevel || 1} ${account?.profile?.tier || 'BRONZE'}`,
    bio: account?.profile?.bio || 'FARUKAT Cinema Member',
    followersCount: followers.length,
    followingCount: following.length,
    emailMasked: maskEmail(account?.profile?.email || ''),
    isPublicProfile: account?.profile?.isPublicProfile !== false,
    cardTheme: account?.profile?.cardTheme || 'ivory-gold',
    totalWatchSeconds: account?.stats?.totalWatchSeconds || 0,
    ratingsGiven: account?.stats?.ratingsGiven || 0,
    signatureUrl: account?.profile?.signatureUrl,

    userId: uid,
    equippedCosmetics: account?.equippedCosmetics || {},
    ownedCards: account?.ownedCards || [],
    ownedCosmetics: account?.ownedCosmetics || [],
  };
}

/**
 * Syncs the current user's updated profile into the community directory
 */
export function syncCurrentUserToDirectory(explicitUid?: string): void {
  try {
    const publicProfile = getCurrentUserPublicProfile(explicitUid);
    const members = getCommunityMembers();
    const index = members.findIndex((m) => m.cardNumber === publicProfile.cardNumber || (m.userId && m.userId === publicProfile.userId));

    if (index >= 0) {
      members[index] = { ...members[index], ...publicProfile };
    } else {
      members.unshift(publicProfile);
    }
    localStorage.setItem(COMMUNITY_MEMBERS_KEY, JSON.stringify(members));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns the list of card numbers the user is following
 */
export function getFollowingList(explicitUid?: string): string[] {
  try {
    const key = getFollowingKey(explicitUid);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Returns the list of card numbers that follow the current user
 */
export function getFollowersList(explicitUid?: string): string[] {
  try {
    const key = getFollowersKey(explicitUid);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Follow a member by Card Number
 * Strictly maintains relationship data without mutating foreign user sessions
 */
export async function followMember(targetCardNumber: string) {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    const currentUser = getXpAccount(uid);
    const myCardNumber = currentUser?.profile?.cardNumber || `FK-${uid.slice(0, 4).toUpperCase()}-PASS`;

    if (myCardNumber === targetCardNumber || currentUser?.profile?.cardNumber === targetCardNumber) {
      return { success: false, message: "You cannot follow your own card number." };
    }

    const currentFollowing = getFollowingList(uid);
    if (currentFollowing.includes(targetCardNumber)) {
      return { success: false, message: 'You are already following this member.' };
    }

    // 1. Update the follower's (current user's) following list only
    const updatedFollowing = [...currentFollowing, targetCardNumber];
    localStorage.setItem(getFollowingKey(uid), JSON.stringify(updatedFollowing));

    if (currentUser) {
      if (!currentUser.stats) currentUser.stats = {} as any;
      currentUser.stats.followedUserIds = updatedFollowing;
      await saveXpAccount(currentUser, false, uid);
    }

    // 2. Update target member's followers list relationship record
    const targetMember = findMemberByCardNumber(targetCardNumber);
    const targetUid = targetMember?.userId || targetCardNumber;
    const targetFollowers = getFollowersList(targetUid);
    
    if (!targetFollowers.includes(myCardNumber)) {
      const updatedFollowers = [...targetFollowers, myCardNumber];
      localStorage.setItem(getFollowersKey(targetUid), JSON.stringify(updatedFollowers));
    }

    // 3. Update public community directory cache counts without mutating private account objects
    const members = getCommunityMembers();
    let directoryModified = false;

    // Update current user count in directory
    const myIdx = members.findIndex((m) => m.cardNumber === myCardNumber || (m.userId && m.userId === uid));
    if (myIdx >= 0) {
      members[myIdx].followingCount = updatedFollowing.length;
      directoryModified = true;
    }

    // Update target member count in directory
    const targetIdx = members.findIndex((m) => m.cardNumber === targetCardNumber || (targetMember?.userId && m.userId === targetMember.userId));
    if (targetIdx >= 0) {
      members[targetIdx].followersCount = (members[targetIdx].followersCount || 0) + 1;
      directoryModified = true;
    }

    if (directoryModified) {
      try {
        localStorage.setItem(COMMUNITY_MEMBERS_KEY, JSON.stringify(members));
      } catch {}
    }

    // 4. Local XP award for engagement (current user only)
    awardXp('Followed Member', 15, 'engagement');

    // 5. Trigger custom event for notifications
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('farukat_member_followed', {
            detail: { cardNumber: targetCardNumber },
          })
        );
      }, 0);
    }

    return { success: true, message: 'Successfully followed member!' };
  } catch {
    return { success: false, message: 'Failed to update follow list.' };
  }
}

/**
 * Unfollow a member
 * Strictly removes relationship without touching session state
 */
export async function unfollowMember(targetCardNumber: string) {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    const currentUser = getXpAccount(uid);
    const myCardNumber = currentUser?.profile?.cardNumber || `FK-${uid.slice(0, 4).toUpperCase()}-PASS`;

    const currentFollowing = getFollowingList(uid);
    const updatedFollowing = currentFollowing.filter((num) => num !== targetCardNumber);
    localStorage.setItem(getFollowingKey(uid), JSON.stringify(updatedFollowing));

    if (currentUser) {
      if (!currentUser.stats) currentUser.stats = {} as any;
      currentUser.stats.followedUserIds = updatedFollowing;
      await saveXpAccount(currentUser, false, uid);
    }
    
    // Target Member follower list relationship update
    const targetMember = findMemberByCardNumber(targetCardNumber);
    const targetUid = targetMember?.userId || targetCardNumber;
    const targetFollowers = getFollowersList(targetUid);
    const updatedFollowers = targetFollowers.filter((num) => num !== myCardNumber);
    localStorage.setItem(getFollowersKey(targetUid), JSON.stringify(updatedFollowers));

    // Update public community directory cache counts
    const members = getCommunityMembers();
    let directoryModified = false;

    const myIdx = members.findIndex((m) => m.cardNumber === myCardNumber || (m.userId && m.userId === uid));
    if (myIdx >= 0) {
      members[myIdx].followingCount = updatedFollowing.length;
      directoryModified = true;
    }

    const targetIdx = members.findIndex((m) => m.cardNumber === targetCardNumber || (targetMember?.userId && m.userId === targetMember.userId));
    if (targetIdx >= 0) {
      members[targetIdx].followersCount = Math.max(0, (members[targetIdx].followersCount || 1) - 1);
      directoryModified = true;
    }

    if (directoryModified) {
      try {
        localStorage.setItem(COMMUNITY_MEMBERS_KEY, JSON.stringify(members));
      } catch {}
    }

    return { success: true, message: 'Unfollowed member.' };
  } catch {
    return { success: false, message: 'Failed to update follow list.' };
  }
}

/**
 * Remove a follower from user's followers list
 */
export function removeFollower(targetCardNumber: string): { success: boolean; message: string } {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    const currentFollowers = getFollowersList(uid);
    const updated = currentFollowers.filter((num) => num !== targetCardNumber);
    localStorage.setItem(getFollowersKey(uid), JSON.stringify(updated));
    return { success: true, message: 'Removed follower.' };
  } catch {
    return { success: false, message: 'Failed to update follower list.' };
  }
}

/**
 * Check if the user is following a specific card number
 */
export function isFollowing(targetCardNumber: string): boolean {
  const list = getFollowingList();
  return list.includes(targetCardNumber);
}

/**
 * Helper to match card number, segment, short suffix, or user ID against a query
 */
export function isCardOrUserMatch(candidateCard: string, candidateUserId: string, query: string): boolean {
  if (!query) return false;
  const qClean = query.trim().toUpperCase();
  const qSeg = extractCardSegment(qClean);
  const qAlpha = qClean.replace(/[^A-Z0-9]/g, '');
  const qLast4 = qAlpha.length >= 4 ? qAlpha.slice(-4) : qAlpha;

  const cardUpper = (candidateCard || '').trim().toUpperCase();
  const cardSeg = extractCardSegment(cardUpper);
  const cardAlpha = cardUpper.replace(/[^A-Z0-9]/g, '');
  const cardLast4 = cardAlpha.length >= 4 ? cardAlpha.slice(-4) : cardAlpha;

  const userUpper = (candidateUserId || '').trim().toUpperCase();
  const userAlpha = userUpper.replace(/[^A-Z0-9]/g, '');

  // 1. Exact card match
  if (cardUpper === qClean) return true;
  // 2. Exact user ID match
  if (userUpper && (userUpper === qClean || userAlpha === qAlpha)) return true;
  // 3. Segment match (e.g. 5YCF-DEF3 or DEF3)
  if (qSeg && cardSeg && (qSeg === cardSeg || qAlpha === cardAlpha)) return true;
  // 4. Suffix match (e.g. last 4 alphanumeric characters)
  if (qLast4.length >= 3 && (cardLast4 === qLast4 || cardAlpha.endsWith(qLast4))) return true;
  // 5. User ID prefix/substring match
  if (userAlpha && (userAlpha.includes(qAlpha) || qAlpha.includes(userAlpha))) return true;

  return false;
}

/**
 * Lookup a member profile by Card Number or ID
 */
export function findMemberByCardNumber(cardNumberOrId: string): PublicMemberProfile | null {
  if (!cardNumberOrId) return null;
  const currentUser = getCurrentUserPublicProfile();

  if (isCardOrUserMatch(currentUser.cardNumber, currentUser.userId || '', cardNumberOrId)) {
    return currentUser;
  }

  const allMembers = getCommunityMembers();
  const found = allMembers.find((m) =>
    isCardOrUserMatch(m.cardNumber, m.userId || '', cardNumberOrId)
  ) || null;

  if (found && found.isPublicProfile === false) {
    const isMe =
      found.cardNumber.toUpperCase() === currentUser.cardNumber.toUpperCase() ||
      (found.userId && found.userId === currentUser.userId);
    if (!isMe) {
      return null;
    }
  }
  return found;
}

/**
 * Public Verification Lookup
 * Searches local cache first, then authoritative Turso Database, then localStorage, then backend sync.
 * Returns the verified public profile if authentic, or null if invalid.
 */
export async function lookupMemberForVerification(cardNumberOrId: string): Promise<PublicMemberProfile | null> {
  if (!cardNumberOrId) return null;

  // 1. Check immediate memory/local storage cache
  const localMatch = findMemberByCardNumber(cardNumberOrId);
  if (localMatch) return localMatch;

  // 2. Authoritative lookup directly from Turso database
  try {
    const tursoMember = await verifyTursoMember(cardNumberOrId);
    if (tursoMember && tursoMember.cardNumber) {
      // Save to local community members cache so future lookups and directory reflect it
      const currentList = getCommunityMembers();
      const idx = currentList.findIndex(
        (m) => m.cardNumber.toUpperCase() === tursoMember.cardNumber.toUpperCase() || (m.userId && m.userId === tursoMember.userId)
      );
      if (idx >= 0) {
        currentList[idx] = { ...currentList[idx], ...tursoMember };
      } else {
        currentList.push(tursoMember);
      }
      try {
        localStorage.setItem(COMMUNITY_MEMBERS_KEY, JSON.stringify(currentList));
      } catch {}
      return tursoMember;
    }
  } catch (tursoErr) {
    console.warn('[Member Verification] Turso lookup notice:', tursoErr);
  }

  // 3. Check all local storage keys starting with farukat_xp_account_
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('farukat_xp_account_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const acc = JSON.parse(raw) as XpAccount;
          if (acc?.profile?.cardNumber) {
            const uid = key.replace('farukat_xp_account_', '');
            if (isCardOrUserMatch(acc.profile.cardNumber, uid, cardNumberOrId)) {
              return {
                cardNumber: acc.profile.cardNumber,
                name: acc.profile.name || 'Cinema Member',
                avatarUrl: acc.profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
                tier: acc.profile.tier || 'BRONZE',
                level: acc.currentLevel || 1,
                lifetimeXp: acc.lifetimeXp || 0,
                memberSince: acc.profile.memberSince || '2026',
                status: acc.profile.status || 'Active',
                isOfficial: acc.profile.role === 'Executive' || (acc.currentLevel || 1) >= 8,
                isProMember: Boolean(checkIsPro(acc)),
                isPro: Boolean(checkIsPro(acc)),
                badge: `Level ${acc.currentLevel || 1} ${acc.profile.tier || 'BRONZE'}`,
                bio: acc.profile.bio || 'FARUKAT Cinema Member',
                followersCount: 0,
                followingCount: 0,
                emailMasked: 'Private',
                isPublicProfile: acc.profile.isPublicProfile !== false,
                cardTheme: acc.profile.cardTheme || 'ivory-gold',
                totalWatchSeconds: acc.stats?.totalWatchSeconds || 0,
                ratingsGiven: acc.stats?.ratingsGiven || 0,
                signatureUrl: acc.profile.signatureUrl,
                userId: uid,
                equippedCosmetics: acc.equippedCosmetics || {},
                ownedCards: acc.ownedCards || [],
                ownedCosmetics: acc.ownedCosmetics || [],
              };
            }
          }
        }
      }
    }
  } catch {}

  // 4. Perform comprehensive backend sync (Turso + Firestore) to pull any cloud registered users
  try {
    await syncCommunityWithBackend();
    const refreshedMatch = findMemberByCardNumber(cardNumberOrId);
    if (refreshedMatch) return refreshedMatch;
  } catch {}

  return null;
}

/**
 * Search members by Card Number, User ID, or Name/Username
 */
export function searchMembers(query: string): PublicMemberProfile[] {
  // Trigger background sync from Firestore
  syncCommunityWithBackend().catch(() => {});

  const allMembers = getCommunityMembers();
  const currentUser = getCurrentUserPublicProfile();

  // Deduplicate combined results ensuring currentUser is first and no duplicate cards or userIds exist
  const resultMap = new Map<string, PublicMemberProfile>();
  const currentKey = (currentUser.userId && currentUser.userId !== 'guest' ? currentUser.userId : currentUser.cardNumber).toUpperCase().trim();
  resultMap.set(currentKey, currentUser);

  for (const m of allMembers) {
    if (!m || !m.cardNumber) continue;
    const key = (m.userId && m.userId !== 'guest' ? m.userId : m.cardNumber).toUpperCase().trim();
    if (!resultMap.has(key)) {
      resultMap.set(key, m);
    }
  }

  const combined = Array.from(resultMap.values());
  const q = (query || '').trim().toLowerCase();
  
  return combined.filter((member) => {
    const isMe = member.cardNumber.toUpperCase() === currentUser.cardNumber.toUpperCase() || (Boolean(member.userId) && member.userId === currentUser.userId);
    if (member.isPublicProfile === false && !isMe) {
      return false;
    }
    
    if (!q) {
      return true; // No search query, just return the filtered community
    }
    
    const matchCard = member.cardNumber.toLowerCase().includes(q) || extractCardSegment(member.cardNumber).toLowerCase().includes(q);
    const matchName = member.name.toLowerCase().includes(q);
    const matchBio = member.bio?.toLowerCase().includes(q);
    const matchId = member.userId?.toLowerCase().includes(q);
    return matchCard || matchName || matchBio || matchId;
  });
}

/**
 * Verify Card Number validity and security status
 */
export interface CardVerificationResult {
  isValid: boolean;
  status: CardStatus;
  profile?: PublicMemberProfile;
  message: string;
  verifiedAt: string;
  securityHash: string;
}

export function verifyCardNumber(cardNumber: string): CardVerificationResult {
  const verifiedAt = new Date().toISOString();
  if (!cardNumber || !cardNumber.trim()) {
    return {
      isValid: false,
      status: 'Deactivated',
      message: 'Card Number cannot be empty.',
      verifiedAt,
      securityHash: 'ERR-INVALID-FORMAT',
    };
  }

  const member = findMemberByCardNumber(cardNumber);
  if (!member) {
    return {
      isValid: false,
      status: 'Deactivated',
      message: `Card Number "${cardNumber.toUpperCase()}" is not registered in the FARUKAT member registry.`,
      verifiedAt,
      securityHash: 'ERR-NOT-FOUND',
    };
  }

  // Check ownership
  const currentUserCard = getXpAccount()?.profile?.cardNumber || '';
  const isMe = member.cardNumber === currentUserCard;

  const sanitizedProfile: PublicMemberProfile = {
    ...member,
    name: (member.isPublicProfile === false && !isMe) ? 'Private Member' : member.name,
    bio: (member.isPublicProfile === false && !isMe) ? 'Private Member Profile' : member.bio,
    emailMasked: member.emailMasked || undefined,
  };

  // Generate deterministic security verification hash
  const securityHash = `FK-SEC-${member.cardNumber.replace(/[^A-Z0-9]/g, '')}-${member.level}X`;

  return {
    isValid: member.status === 'Active',
    status: member.status,
    profile: sanitizedProfile,
    message:
      member.status === 'Active'
        ? `Verified Authenticated Card: ${sanitizedProfile.name} (${sanitizedProfile.tier} Level ${sanitizedProfile.level})`
        : `Card Status: ${member.status}`,
    verifiedAt,
    securityHash,
  };
}

// ----------------------------------------------------
// REAL PERSISTENT COMMENTS ENGINE (NO FAKE COMMENTS)
// ----------------------------------------------------

const INITIAL_MEDIA_COMMENTS: Record<string, CommentItem[]> = {};

export function getCommentsForMedia(mediaId: string): CommentItem[] {
  try {
    const raw = localStorage.getItem(MEDIA_COMMENTS_KEY);
    const store: Record<string, CommentItem[]> = raw ? JSON.parse(raw) : INITIAL_MEDIA_COMMENTS;
    return store[mediaId] || [];
  } catch {
    return [];
  }
}

export function addMediaComment(
  mediaId: string,
  text: string,
  episodeId?: string
): CommentItem | null {
  if (!text || !text.trim()) return null;

  try {
    const account = getXpAccount();
    const raw = localStorage.getItem(MEDIA_COMMENTS_KEY);
    const store: Record<string, CommentItem[]> = raw ? JSON.parse(raw) : {};
    const isProUser = checkIsPro(account);

    const newComment: CommentItem = {
      id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      mediaId,
      episodeId,
      authorName: account?.profile?.name || 'Cinema Member',
      authorCardNumber: account?.profile?.cardNumber || 'FK-PASS',
      authorAvatar: account?.profile?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      authorTier: account?.profile?.tier || 'BRONZE',
      authorLevel: account?.currentLevel || 1,
      authorIsPro: isProUser,
      userId: account?.userId || auth.currentUser?.uid || 'guest',
      text: text.trim(),
      createdAt: Date.now(),
      likesCount: 0,
      userLiked: false,
    };

    if (!store[mediaId]) {
      store[mediaId] = [];
    }

    store[mediaId].unshift(newComment);
    localStorage.setItem(MEDIA_COMMENTS_KEY, JSON.stringify(store));

    // Award XP for engaging in comments
    awardXp('Shared Cinema Review Comment', 15, 'engagement');

    return newComment;
  } catch {
    return null;
  }
}

export function toggleCommentLike(mediaId: string, commentId: string): boolean {
  try {
    const raw = localStorage.getItem(MEDIA_COMMENTS_KEY);
    const store: Record<string, CommentItem[]> = raw ? JSON.parse(raw) : {};

    if (!store[mediaId]) return false;

    const target = store[mediaId].find((c) => c.id === commentId);
    if (!target) return false;

    if (target.userLiked) {
      target.userLiked = false;
      target.likesCount = Math.max(0, target.likesCount - 1);
    } else {
      target.userLiked = true;
      target.likesCount = target.likesCount + 1;
    }

    localStorage.setItem(MEDIA_COMMENTS_KEY, JSON.stringify(store));
    return target.userLiked;
  } catch {
    return false;
  }
}

/**
 * Synchronize real Firebase Authenticated User into local VIP Account
 */
export async function syncFirebaseUserToAccount(firebaseUser: any): Promise<XpAccount> {
  const uid = firebaseUser?.uid || 'guest';
  const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || '10012002';
  const deterministicCardNumber = `FK-${cleanUid.slice(0, 4) || '8F42'}-${cleanUid.slice(4, 8) || '19C7'}`;

  const displayName = firebaseUser?.displayName || firebaseUser?.name || firebaseUser?.email?.split('@')[0] || (uid === 'guest' ? 'Guest Cinephile' : 'Cinema Member');
  const email = firebaseUser?.email || '';
  const avatarUrl =
    firebaseUser?.photoURL ||
    `https://api.dicebear.com/7.x/open-peeps/svg?seed=${cleanUid}`;

  const { loadUserAccountFromCloud, saveUserAccountToCloud } = await import('./firestoreStorage');
  let remoteAccount: XpAccount | null = null;
  if (uid !== 'guest') {
    try {
      remoteAccount = await loadUserAccountFromCloud(uid);
    } catch (e) {
      console.warn('Backend load account warning:', e);
    }
  }

  let account: XpAccount;

  if (remoteAccount) {
    // Firestore is authoritative source of truth. Preserve XP, stats, levels, achievements.
    account = remoteAccount;
    if (account.profile) {
      if (displayName && displayName !== 'Cinema Member' && displayName !== 'Guest Cinephile') {
        account.profile.name = displayName;
      }
      if (email) {
        account.profile.email = email;
      }
      if (firebaseUser?.photoURL) {
        account.profile.avatarUrl = firebaseUser.photoURL;
      }
      account.profile.cardNumber = deterministicCardNumber;
      account.profile.memberId = `FK-${uid.slice(0, 4).toUpperCase()}-PASS`;
    }
  } else {
    // Check if account already exists in local storage / memory cache
    const existing = getXpAccount(uid);
    if (existing && (existing.lifetimeXp > 0 || existing.currentXp > 0 || (existing.transactions && existing.transactions.length > 0))) {
      account = existing;
      if (account.profile) {
        if (displayName && displayName !== 'Cinema Member' && displayName !== 'Guest Cinephile') {
          account.profile.name = displayName;
        }
        if (email) account.profile.email = email;
        if (firebaseUser?.photoURL) account.profile.avatarUrl = firebaseUser.photoURL;
      }
    } else {
      account = createFreshXpAccountForUser(uid, email, displayName, avatarUrl);
      const pendingRef = localStorage.getItem('pending_referral_code');
      if (pendingRef && uid !== 'guest') {
        localStorage.removeItem('pending_referral_code');
        try {
          const { processTursoReferral } = await import('./tursoClient');
          const refResult = await processTursoReferral(pendingRef, email);
          if (refResult && refResult.success) {
            account.lifetimeXp = (account.lifetimeXp || 0) + (refResult.xpAwarded || 500);
            account.currentXp = account.lifetimeXp;
            const { calculateLevelInfo } = await import('./xpSystem');
            const lvlInfo = calculateLevelInfo(account.lifetimeXp);
            account.currentLevel = lvlInfo.level;
            account.profile.tier = lvlInfo.tier;
            if (refResult.refereeThemeAwarded) {
              if (!account.ownedCosmetics) account.ownedCosmetics = [];
              if (!account.ownedCosmetics.includes('friend-card')) {
                account.ownedCosmetics.push('friend-card');
              }
            }
          }
        } catch (refErr) {
          console.warn('Referral processing notice:', refErr);
        }
      }
    }
  }

  if (account.profile) {
    account.profile.cardNumber = deterministicCardNumber;
    account.profile.memberId = `FK-${uid.slice(0, 4).toUpperCase()}-PASS`;
    account.profile.status = 'Active';
  }

  if (uid !== 'guest') {
    try {
      await saveUserAccountToCloud(uid, account);
    } catch (err) {
      console.warn('Failed to save account to Firestore:', err);
    }
  }

  await saveXpAccount(account, false, uid);
  syncCurrentUserToDirectory(uid);
  try {
    await syncCommunityWithBackend();
  } catch {}
  return account;
}
