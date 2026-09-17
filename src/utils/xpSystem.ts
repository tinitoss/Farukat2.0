import {
  XpAccount,
  UserProfile,
  UserStats,
  XpTransaction,
  LevelInfo,
  MembershipTier,
  CardTheme,
  PerkItem,
} from '../types';
import { auth, db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { loadUserAccountFromCloud, saveUserAccountToCloud } from './firestoreStorage';
import { getCalculatedTotalWatchSeconds } from './watchProgressManager';
import { awardTursoXp, updateTursoProfile, syncTursoStreak } from './tursoClient';
import { isQuotaError, isQuotaExceeded, markQuotaExceeded } from './quotaHelper';
import { sheetDbSaveTable } from './sheetdb';
import { getLevelTitle, LEVEL_TITLE_TIERS } from './levelTitles';
import { evaluateAchievements } from './achievementSystem';
import { notifyLevelUp } from './inAppNotificationSystem';
import {
  calculateRankInfo,
  RANK_LADDER,
  RANK_VISUAL_THEMES,
  getRankTheme,
  RankTierName,
  RankDefinition,
  CalculatedRankInfo,
  LEVEL_500_XP_THRESHOLD,
  XP_PER_RANK_STEP,
} from './rankSystem';

export {
  getLevelTitle,
  LEVEL_TITLE_TIERS,
  calculateRankInfo,
  RANK_LADDER,
  RANK_VISUAL_THEMES,
  getRankTheme,
  LEVEL_500_XP_THRESHOLD,
  XP_PER_RANK_STEP,
};
export type { RankTierName, RankDefinition, CalculatedRankInfo };

export const XP_ACCOUNT_KEY = 'farukat_xp_account_v2';
export const XP_EVENT_NAME = 'farukat_xp_updated';

/**
 * Streak milestone XP rewards:
 * 10-day streak -> +200 XP
 * 25-day streak -> +444 XP
 * 67-day streak -> +676 XP
 * 99-day streak -> +1 XP
 * 100-day streak -> +990 XP
 */
export const STREAK_MILESTONES: Record<number, number> = {
  10: 200,
  25: 444,
  67: 676,
  99: 1,
  100: 990,
};

// In-memory cache isolated strictly per Firebase User UID
const userAccountCache = new Map<string, XpAccount>();

export const clearXpAccountCache = () => {
  userAccountCache.clear();
};

export const getActiveUserIdForXp = (explicitUid?: string): string => {
  if (explicitUid && explicitUid.trim()) return explicitUid.trim();
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  try {
    const sessionRaw = sessionStorage.getItem('farukat_current_session_v2') || localStorage.getItem('farukat_current_session_v2');
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session?.uid) return session.uid;
    }
  } catch {}
  return 'guest';
};

// LEVEL THRESHOLDS & PROGRESSION CONFIG (MAX LEVEL 500)
const LEVEL_CUMULATIVE_ANCHORS = [
  { lvl: 1, xp: 0 },
  { lvl: 10, xp: 2300 },
  { lvl: 41, xp: 45000 },
  { lvl: 50, xp: 56000 },
  { lvl: 100, xp: 150000 },
  { lvl: 200, xp: 500000 },
  { lvl: 300, xp: 1200000 },
  { lvl: 400, xp: 2500000 },
  { lvl: 500, xp: 5000000 },
];

export const getMinXpForLevel = (l: number): number => {
  if (l <= 1) return 0;
  if (l >= 500) return 5000000 + (l - 500) * 10000;

  for (let i = 0; i < LEVEL_CUMULATIVE_ANCHORS.length - 1; i++) {
    const a1 = LEVEL_CUMULATIVE_ANCHORS[i];
    const a2 = LEVEL_CUMULATIVE_ANCHORS[i + 1];
    if (l >= a1.lvl && l <= a2.lvl) {
      const progress = (l - a1.lvl) / (a2.lvl - a1.lvl);
      if (a1.xp === 0) {
        return Math.round(Math.pow(progress, 1.6) * a2.xp);
      }
      const ratio = a2.xp / a1.xp;
      return Math.round(a1.xp * Math.pow(ratio, progress));
    }
  }
  return 5000000;
};

export const LEVEL_TIERS: {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  tier: MembershipTier;
  perkUnlocked: string;
}[] = (() => {
  const tiers = [];
  const basePerks = [
    'Standard Access',
    'Bronze Card Glow & HD Audio',
    'Silver Card Frame & AI Fast-Track',
    'Gold Hologram & Custom Card Themes',
    'Digital Member Pass & 4K Studio Masters',
    'Obsidian Matte Card & Director Vault',
    'Diamond Prism Card & Executive Room',
    'Custom Member Badge & Premiere Tickets',
    'Gold Monogram Hologram on 3D Card',
    'Permanent Legend Status & All Perks',
  ];

  for (let l = 1; l <= 500; l++) {
    const minXp = getMinXpForLevel(l);
    const maxXp = l < 500 ? getMinXpForLevel(l + 1) : 5100000;

    let tier: MembershipTier = 'DIAMOND';
    if (l === 1) tier = 'STANDARD';
    else if (l === 2) tier = 'BRONZE';
    else if (l === 3) tier = 'SILVER';
    else if (l === 4) tier = 'GOLD';
    else if (l === 5) tier = 'PLATINUM';
    else if (l === 6) tier = 'OBSIDIAN';

    const title = getLevelTitle(l);

    let perkUnlocked = `Exclusive Lvl ${l} Cinema Badge & VIP Perks`;
    if (l <= 10 && basePerks[l - 1]) {
      perkUnlocked = basePerks[l - 1];
    }

    tiers.push({
      level: l,
      title,
      minXp,
      maxXp,
      tier,
      perkUnlocked,
    });
  }
  return tiers;
})();

// AVAILABLE PERKS IN STORE

// AVAILABLE PERKS IN STORE
export const PERKS_CATALOG: PerkItem[] = [
  {
    id: 'theme_obsidian',
    name: 'Obsidian Matte 3D Card Skin',
    description: 'Ultra-exclusive dark obsidian luxury card finish with metallic gold trim.',
    costXp: 80,
    icon: 'Sparkles',
    type: 'card_theme',
    themeId: 'obsidian-gold',
    unlocked: false,
  },
  {
    id: 'theme_cyber',
    name: 'Holographic Cyber Prism Skin',
    description: 'Futuristic iridescent glass foil reflection that dynamically reflects light on tilt.',
    costXp: 120,
    icon: 'Layers',
    type: 'card_theme',
    themeId: 'cyber-hologram',
    unlocked: false,
  },
  {
    id: 'theme_ruby',
    name: 'Crimson Velvet & Chrome Skin',
    description: 'Cinematic crimson brushed aluminum finish for the ultimate FARUKAT cinema look.',
    costXp: 100,
    icon: 'Shield',
    type: 'card_theme',
    themeId: 'crimson-ruby',
    unlocked: false,
  },
  {
    id: 'perk_4k_audio',
    name: 'HQ Studio Master Audio Boost',
    description: 'Unlock simulated dynamic range expansion and virtual studio spatializer.',
    costXp: 60,
    icon: 'Headphones',
    type: 'theater_perk',
    unlocked: false,
  },
  {
    id: 'perk_director_badge',
    name: 'Executive Producer Profile Badge',
    description: 'Displays a golden Executive Producer badge on your 3D digital card.',
    costXp: 150,
    icon: 'Crown',
    type: 'vip_badge',
    unlocked: false,
  },
];

// UNIQUE MEMBER ID GENERATOR
const generateMemberId = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FK-${rand}-X8`;
};

// UNIQUE CARD NUMBER GENERATOR (STANDARDIZED PERMANENT VIP PASS NUMBER E.G. FK-8F42-19C7)
const generateCardNumber = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rand4 = () => {
    let s = '';
    for (let i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  };
  return `FK-${rand4()}-${rand4()}`;
};

// CALCULATE LEVEL INFO FROM REAL LIFETIME XP
export const calculateLevelInfo = (lifetimeXp: number): LevelInfo => {
  if (lifetimeXp >= LEVEL_500_XP_THRESHOLD) {
    const rank = calculateRankInfo(lifetimeXp);
    const level = 500 + Math.floor((lifetimeXp - LEVEL_500_XP_THRESHOLD) / 10000);
    const minXp = rank.minXp;
    const nextLevelXp = rank.nextRankXp ?? rank.minXp;
    const currentLevelBaseXp = minXp;
    const xpEarnedInCurrentLevel = rank.xpEarnedInRank;
    const xpNeededForNext = rank.xpNeededForNextRank;
    const progressPercent = rank.progressPercent;

    return {
      level,
      title: rank.label || 'Bronze I',
      tier: 'DIAMOND',
      minXp,
      nextLevelXp,
      currentLevelBaseXp,
      xpNeededForNext,
      xpEarnedInCurrentLevel,
      progressPercent,
      perkUnlocked: rank.isMaster
        ? 'Permanent Apex MASTER Status'
        : `Exclusive ${rank.label} Rank Perks`,
      isRanked: true,
      rankTier: rank.tier,
      rankSub: rank.subRank,
      rankLabel: rank.label,
      nextRankLabel: rank.nextRankLabel,
      isMaster: rank.isMaster,
    };
  }

  let currentTierIndex = 0;
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (lifetimeXp >= LEVEL_TIERS[i].minXp) {
      currentTierIndex = i;
    } else {
      break;
    }
  }

  const currentConfig = LEVEL_TIERS[currentTierIndex];
  const nextConfig = LEVEL_TIERS[currentTierIndex + 1] || {
    ...currentConfig,
    minXp: currentConfig.maxXp,
    maxXp: currentConfig.maxXp + 2000,
  };

  const level = currentConfig.level;
  const minXp = currentConfig.minXp;
  const nextLevelXp = currentConfig.maxXp;
  const xpEarnedInCurrentLevel = lifetimeXp - minXp;
  const xpNeededForNext = Math.max(0, nextLevelXp - lifetimeXp);
  const range = nextLevelXp - minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpEarnedInCurrentLevel / range) * 100)));

  return {
    level,
    title: currentConfig.title,
    tier: currentConfig.tier,
    minXp,
    nextLevelXp,
    currentLevelBaseXp: minXp,
    xpNeededForNext,
    xpEarnedInCurrentLevel,
    progressPercent,
    perkUnlocked: currentConfig.perkUnlocked,
    isRanked: false,
    rankTier: null,
    rankSub: null,
    rankLabel: null,
    nextRankLabel: null,
    isMaster: false,
  };
};

// Global sync lock to prevent concurrent redundant requests
let isSyncingXp = false;

// SYNC ACCOUNT WITH FIRESTORE
export const syncXpAccountWithBackend = async (explicitUid?: string) => {
  const uid = getActiveUserIdForXp(explicitUid);
  if (!uid || uid === 'guest') return getXpAccount(uid);
  if (isSyncingXp) return getXpAccount(uid);

  isSyncingXp = true;
  try {
    const remoteAccount = await loadUserAccountFromCloud(uid);
    if (remoteAccount) {
      const normalized = normalizeAccount(remoteAccount, uid);
      userAccountCache.set(uid, normalized);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`farukat_xp_account_${uid}`, JSON.stringify(normalized));
        } catch {}
      }
      return normalized;
    }
  } catch (err) {
    console.error('Failed to sync XP Account with cloud', err);
  } finally {
    isSyncingXp = false;
  }
  return getXpAccount(uid);
};

// PRO Status Verification Helper
export function checkIsPro(data: any): boolean {
  if (!data) return false;
  if (data.isProMember === true || data.isPro === true || data.tier === 'DIAMOND') return true;
  if (data.profile) {
    if (data.profile.isProMember === true || data.profile.isPro === true || data.profile.tier === 'DIAMOND') return true;
  }
  return false;
}

// Normalizes any raw account payload into a secure, typed, isolated XpAccount
function normalizeAccount(parsed: any, uid: string): XpAccount {
  const p = parsed && typeof parsed === 'object' ? parsed : {};
  let rawLifetime = Number(p.lifetimeXp) || 0;
  let rawCurrent = Number(p.currentXp) || 0;
  const rawTransactions: XpTransaction[] = Array.isArray(p.transactions) ? p.transactions : [];
  const txEarnedTotal = rawTransactions
    .filter((tx: any) => tx && tx.type === 'earned')
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

  const rawProfile = p.profile && typeof p.profile === 'object' ? p.profile : {};
  const userEmail = (rawProfile.email || auth.currentUser?.email || '').toLowerCase();
  const profileName = (rawProfile.name || '').toLowerCase();
  const isOwnerUser = userEmail === 'altinberisha434@gmail.com' || uid.toLowerCase().includes('altinberisha434');
  const isGoldPrince = Boolean(
    profileName.includes('goldprince') || 
    uid.toLowerCase().includes('goldprince') || 
    (userEmail && userEmail.includes('goldprince'))
  );

  // Sanitize false achievements auto-awarded on first launch due to historical bugs
  const totalWatchSec = Number(p.stats?.totalWatchSeconds) || 0;
  const episodesDone = Number(p.stats?.episodesCompleted) || 0;
  const ratingsGiven = Number(p.stats?.ratingsGiven) || 0;
  const reviewsCount = Number(p.stats?.reviewsCount) || 0;
  const isCardCustomized = Boolean(
    rawProfile.isCardCustomized ||
    rawProfile.signatureUrl ||
    (rawProfile.cardTheme && rawProfile.cardTheme !== 'ivory-gold' && rawProfile.cardTheme !== 'goldprince-era')
  );
  const hasLegitActivity = totalWatchSec > 60 || episodesDone > 0 || ratingsGiven > 0 || reviewsCount > 0 || isCardCustomized;

  let sanitizedTransactions = rawTransactions;
  if (!isGoldPrince && !isOwnerUser && !hasLegitActivity) {
    const invalidAchievementTitles = ['Achievement: Cardholder Elite', 'Achievement: Sound & Cinema'];
    sanitizedTransactions = rawTransactions.filter((tx: any) => {
      if (!tx || !tx.reason) return true;
      return !invalidAchievementTitles.some(title => tx.reason.includes(title));
    });
    if (sanitizedTransactions.length !== rawTransactions.length) {
      const cleanTxTotal = sanitizedTransactions
        .filter((tx: any) => tx && tx.type === 'earned')
        .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
      rawLifetime = cleanTxTotal;
      rawCurrent = cleanTxTotal;
    }
  }

  // Attempt recovery from community directory only for authenticated users with exact match
  if (rawLifetime === 0 && rawCurrent === 0 && uid && uid !== 'guest' && typeof window !== 'undefined') {
    try {
      const commRaw = localStorage.getItem('farukat_community_members_v2');
      if (commRaw) {
        const members = JSON.parse(commRaw);
        const match = members.find((m: any) => m.userId === uid || (userEmail && m.email && m.email.toLowerCase() === userEmail));
        if (match && match.lifetimeXp > 0) {
          rawLifetime = match.lifetimeXp;
          rawCurrent = match.lifetimeXp;
        }
      }
    } catch {}
  }

  const cleanEarnedTotal = sanitizedTransactions
    .filter((tx: any) => tx && tx.type === 'earned')
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

  // GoldPrince Studio Level 500+ (5,000,000+ XP) baseline + earned XP
  if (isGoldPrince) {
    rawLifetime = Math.max(rawLifetime, 5020804, 5000000 + cleanEarnedTotal);
    rawCurrent = Math.max(rawCurrent, 5020804, 5000000 + cleanEarnedTotal);
  }
  // Owner/Executive user auto-restoration
  else if (isOwnerUser) {
    rawLifetime = Math.max(rawLifetime, 5000);
    rawCurrent = Math.max(rawCurrent, 5000);
  }

  const lifetimeXp = isGoldPrince
    ? Math.max(rawLifetime, rawCurrent, 5020804, 5000000 + cleanEarnedTotal)
    : Math.max(rawLifetime, rawCurrent, cleanEarnedTotal);
  const currentXp = Math.max(rawCurrent, lifetimeXp);
  const levelInfo = calculateLevelInfo(lifetimeXp);

  const uidClean = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || '10012002';
  const defaultCardNumber = `FK-${uidClean.slice(0, 4) || '1001'}-${uidClean.slice(4, 8) || '2002'}`;

  const isPro = isGoldPrince || isOwnerUser || Boolean(rawProfile.isProMember || rawProfile.isPro || (rawProfile.tier === 'DIAMOND' && rawProfile.isProMember));
  
  const profile: UserProfile = {
    name: rawProfile.name || (isGoldPrince ? 'GoldPrince STUDIO' : (uid === 'guest' ? 'Guest Cinephile' : (isOwnerUser ? 'Farukat Executive' : 'Cinema Member'))),
    email: rawProfile.email || (isOwnerUser ? 'altinberisha434@gmail.com' : ''),
    avatarUrl: rawProfile.avatarUrl || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer',
    memberId: rawProfile.memberId || `FK-${uidClean.slice(0, 4)}-PASS`,
    cardNumber: rawProfile.cardNumber || defaultCardNumber,
    memberSince: rawProfile.memberSince || 'Jan 2026',
    tier: isPro ? 'DIAMOND' : levelInfo.tier,
    cardTheme: rawProfile.cardTheme || (isGoldPrince ? 'goldprince-era' : 'ivory-gold'),
    status: rawProfile.status || 'Active',
    discoverableByCardNumber: rawProfile.discoverableByCardNumber !== false,
    isPublicProfile: rawProfile.isPublicProfile !== false,
    isProMember: isPro,
    isPro: isPro,
    bio: rawProfile.bio || (isGoldPrince ? 'Level 500 GoldPrince Studio Supreme Member' : (isOwnerUser ? 'FARUKAT Founder & Executive Director' : 'FARUKAT Cinema Member')),
    signatureUrl: rawProfile.signatureUrl,
    cardHistory: Array.isArray(rawProfile.cardHistory) ? rawProfile.cardHistory : [
      {
        id: 'ch_init_' + Date.now(),
        date: rawProfile.memberSince || 'Jan 2026',
        event: 'Digital Card Issued & Activated',
        status: 'Active',
      }
    ],

  };

  const todayIso = new Date().toISOString().split('T')[0];
  const computedSeconds = getCalculatedTotalWatchSeconds(uid);
  let storedFollowing: string[] = [];
  try {
    const rawF = typeof window !== 'undefined' ? localStorage.getItem(`farukat_user_following_${uid}`) : null;
    if (rawF) storedFollowing = JSON.parse(rawF);
  } catch {}

  const rawCurrentStreak = typeof parsed.stats?.currentStreak === 'number'
    ? parsed.stats.currentStreak
    : (parsed.stats?.currentStreak ? Number(parsed.stats.currentStreak) : 0);

  const rawLastActiveDate = parsed.stats?.lastActiveDate || parsed.stats?.lastLoginDate || null;
  let effectiveStreak = rawCurrentStreak;

  if (!rawLastActiveDate) {
    effectiveStreak = 0;
  } else {
    const [y1, m1, d1] = String(rawLastActiveDate).split('-').map(Number);
    const [y2, m2, d2] = todayIso.split('-').map(Number);
    if (!isNaN(y1) && !isNaN(m1) && !isNaN(d1)) {
      const utc1 = Date.UTC(y1, m1 - 1, d1);
      const utc2 = Date.UTC(y2, m2 - 1, d2);
      const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        // Missed a full day (24h+) without opening account - lost all streaks!
        effectiveStreak = 0;
      }
    }
  }

  const stats: UserStats = {
    ...parsed.stats,
    totalWatchSeconds: computedSeconds,
    totalWatchMinutes: Math.floor(computedSeconds / 60),
    totalWatchHours: Number((computedSeconds / 3600).toFixed(2)),
    titlesWatched: Array.isArray(parsed.stats?.titlesWatched) ? parsed.stats.titlesWatched : [],
    episodesCompleted: Number(parsed.stats?.episodesCompleted) || 0,
    ratingsGiven: Number(parsed.stats?.ratingsGiven) || 0,
    watchlistCount: Number(parsed.stats?.watchlistCount) || 0,
    downloadsCount: Number(parsed.stats?.downloadsCount) || 0,
    dailyLoginDates: Array.isArray(parsed.stats?.dailyLoginDates) ? parsed.stats.dailyLoginDates : (effectiveStreak > 0 ? [todayIso] : []),
    currentStreak: effectiveStreak,
    lastLoginDate: rawLastActiveDate || (effectiveStreak > 0 ? todayIso : undefined),
    lastActiveDate: rawLastActiveDate || (effectiveStreak > 0 ? todayIso : undefined),
    longestStreak: Math.max(Number(parsed.stats?.longestStreak) || 0, effectiveStreak),
    streakMilestonesClaimed: Array.isArray(parsed.stats?.streakMilestonesClaimed) ? parsed.stats.streakMilestonesClaimed : [],
    profileCompleted: !!parsed.stats?.profileCompleted,
    sharesCount: Number(parsed.stats?.sharesCount) || 0,
    ratedMediaIds: Array.isArray(parsed.stats?.ratedMediaIds) ? parsed.stats.ratedMediaIds : [],
    watchlistMediaIds: Array.isArray(parsed.stats?.watchlistMediaIds) ? parsed.stats.watchlistMediaIds : [],
    followedUserIds: Array.isArray(parsed.stats?.followedUserIds) && parsed.stats.followedUserIds.length > 0 ? parsed.stats.followedUserIds : storedFollowing,
    dailyWatchXpDate: parsed.stats?.dailyWatchXpDate,
    dailyWatchXpEarned: Number(parsed.stats?.dailyWatchXpEarned) || 0,
    hideWatchParty: parsed.stats?.hideWatchParty ?? (parsed.stats?.watchPartyEnabled === false ? true : false),
    watchPartyEnabled: parsed.stats?.watchPartyEnabled !== undefined ? parsed.stats.watchPartyEnabled : (parsed.stats?.hideWatchParty ? false : true),
  };

  let unlockedAchievements: string[] | undefined = Array.isArray(parsed.unlockedAchievements)
    ? parsed.unlockedAchievements
    : undefined;

  if (unlockedAchievements && !isGoldPrince && !isOwnerUser && !hasLegitActivity) {
    unlockedAchievements = unlockedAchievements.filter((k: string) => k !== 'vip_cardholder' && k !== 'audio_aficionado');
  }

  return {
    currentXp,
    lifetimeXp,
    currentLevel: levelInfo.level,
    xpSpentTotal: Number(parsed.xpSpentTotal) || 0,
    profile,
    stats,
    transactions: sanitizedTransactions,
    unlockedAchievements,
    weeklyQuestsWeekId: parsed.weeklyQuestsWeekId,
    weeklyXp: parsed.weeklyXp,
    ownedCosmetics: Array.isArray(parsed.ownedCosmetics) ? parsed.ownedCosmetics : undefined,
    equippedCosmetics: parsed.equippedCosmetics,
  };
}

// INITIALIZE OR RETRIEVE ISOLATED STORED ACCOUNT FOR THE GIVEN UID
export const getXpAccount = (explicitUid?: string): XpAccount => {
  const uid = getActiveUserIdForXp(explicitUid);

  // 1. Check in-memory isolated cache
  if (userAccountCache.has(uid)) {
    return userAccountCache.get(uid)!;
  }

  // 2. Check UID-namespaced LocalStorage
  let foundAccount: any = null;
  if (typeof window !== 'undefined') {
    try {
      const namespacedRaw = localStorage.getItem(`farukat_xp_account_${uid}`);
      if (namespacedRaw) {
        foundAccount = JSON.parse(namespacedRaw);
      }
    } catch (e) {
      console.warn(`Error parsing XP account for user ${uid}:`, e);
    }
  }

  if (foundAccount && typeof foundAccount === 'object') {
    const normalized = normalizeAccount(foundAccount, uid);
    userAccountCache.set(uid, normalized);
    return normalized;
  }

  // 3. Create fresh default account isolated for this specific UID
  const isSelf = uid === (auth.currentUser?.uid || 'guest');
  const fresh = createFreshXpAccountForUser(
    uid,
    isSelf ? (auth.currentUser?.email || '') : '',
    isSelf ? (auth.currentUser?.displayName || (uid === 'guest' ? 'Guest Cinephile' : 'Cinema Member')) : 'Cinema Member',
    isSelf ? (auth.currentUser?.photoURL || undefined) : undefined
  );
  userAccountCache.set(uid, fresh);
  return fresh;
};

export const createFreshXpAccountForUser = (
  userId: string,
  email: string,
  name: string,
  avatarUrl?: string
): XpAccount => {
  const today = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const memberSince = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
  const todayIso = today.toISOString().split('T')[0];

  const uidClean = (userId || 'USR1001').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const cardNumber = `FK-${uidClean.slice(0, 4) || '1001'}-${uidClean.slice(4, 8) || '2002'}`;

  const defaultAvatar = avatarUrl?.trim() || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=' + uidClean;

  const isOwner = (email?.toLowerCase() === 'altinberisha434@gmail.com' || userId?.toLowerCase().includes('altinberisha434'));
  const isGoldPrince = Boolean(
    name?.toLowerCase().includes('goldprince') || 
    userId?.toLowerCase().includes('goldprince') || 
    (email && email.toLowerCase().includes('goldprince'))
  );
  const defaultXp = isGoldPrince ? 5020804 : (isOwner ? 5000 : 0);
  const defaultLevel = isGoldPrince ? 502 : (isOwner ? 10 : 1);

  const initialProfile: UserProfile = {
    name: name || (isGoldPrince ? 'GoldPrince STUDIO' : (userId === 'guest' ? 'Guest Cinephile' : (isOwner ? 'Farukat Executive' : 'Cinema Member'))),
    email: email || (isOwner ? 'altinberisha434@gmail.com' : ''),
    avatarUrl: defaultAvatar,
    memberId: `FK-${uidClean.slice(0, 4) || 'MEM'}-PASS`,
    cardNumber: cardNumber,
    memberSince,
    tier: (isGoldPrince || isOwner) ? 'DIAMOND' : 'STANDARD',
    cardTheme: isGoldPrince ? 'goldprince-era' : 'ivory-gold',
    status: 'Active',
    discoverableByCardNumber: true,
    isPublicProfile: true,
    isProMember: isGoldPrince || isOwner,
    isPro: isGoldPrince || isOwner,
    bio: isGoldPrince ? 'Level 500 GoldPrince Studio Supreme Member' : (isOwner ? 'FARUKAT Founder & Executive Director' : 'FARUKAT Cinema Member'),
    cardHistory: [
      {
        id: 'ch_init_' + Date.now(),
        date: memberSince,
        event: 'Digital Card Issued & Activated',
        status: 'Active',
      },
    ],

  };

  let initFollowing: string[] = [];
  try {
    const rawF = typeof window !== 'undefined' ? localStorage.getItem(`farukat_user_following_${userId}`) : null;
    if (rawF) initFollowing = JSON.parse(rawF);
  } catch {}

  const initialStats: UserStats = {
    totalWatchSeconds: 0,
    totalWatchMinutes: 0,
    totalWatchHours: 0,
    titlesWatched: [],
    episodesCompleted: 0,
    ratingsGiven: 0,
    watchlistCount: 0,
    downloadsCount: 0,
    dailyLoginDates: [todayIso],
    currentStreak: 1,
    lastLoginDate: todayIso,
    lastActiveDate: todayIso,
    longestStreak: 1,
    streakMilestonesClaimed: [],
    profileCompleted: false,
    sharesCount: 0,
    ratedMediaIds: [],
    watchlistMediaIds: [],
    followedUserIds: initFollowing,
    dailyWatchXpDate: todayIso,
    dailyWatchXpEarned: 0,
  };

  const newAccount: XpAccount = {
    currentXp: defaultXp,
    lifetimeXp: defaultXp,
    currentLevel: defaultLevel,
    xpSpentTotal: 0,
    profile: initialProfile,
    stats: initialStats,
    transactions: [],
  };

  // Cache & save isolated to this user's storage key
  userAccountCache.set(userId, newAccount);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`farukat_xp_account_${userId}`, JSON.stringify(newAccount));
    } catch {}
  }

  return newAccount;
};

export const clearXpCache = (): void => {
  userAccountCache.clear();
};

export const sheetDbSaveXpAccount = async (account: XpAccount) => {
  try {
    const user = auth.currentUser;
    if (!user?.uid || user.uid === 'guest') return;
    await saveUserAccountToCloud(user.uid, account);
  } catch (err) {
    console.warn('Firebase user save notice:', err);
  }
};

let xpSaveDebounceTimer: any = null;

// GET START OF CURRENT WEEK (MONDAY 00:00:00.000)
export const getCurrentWeekStartTimestamp = (): number => {
  const now = new Date();
  const day = now.getDay();
  // Monday is start of current week (day 1), Sunday is day 0
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  return monday.getTime();
};

// CALCULATE REAL XP EARNED IN CURRENT WEEK FROM TRANSACTIONS
export const calculateWeeklyXpForAccount = (account: XpAccount): number => {
  if (!account) return 0;
  const weekStart = getCurrentWeekStartTimestamp();

  if (Array.isArray(account.transactions)) {
    const earnedThisWeek = account.transactions
      .filter((tx) => tx && tx.type === 'earned' && tx.timestamp >= weekStart)
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    return Math.max(0, earnedThisWeek);
  }
  return 0;
};

// PERSIST XP ACCOUNT ISOLATED TO ACTIVE USER AND DISPATCH EVENT
export const triggerAchievementCheck = async () => {
  const account = getXpAccount();
  if (!account || account.userId === 'guest') return;
  
  // Dynamic import to avoid circular dependency
  await evaluateAchievements(account);
};

export const saveXpAccount = async (account: XpAccount, localOnly = false, explicitUid?: string): Promise<void> => {
  try {
    if (!account) return;
    const activeAuthUid = auth.currentUser?.uid || 'guest';
    const uid = explicitUid ? explicitUid.trim() : (account.userId && account.userId !== 'guest' ? account.userId : activeAuthUid);

    // SECURITY SAFEGUARD: Prevent accidental session hijacking / cross-user account overwrite
    // If explicitUid is NOT provided, and the account belongs to another user, block saving over the active session.
    if (!explicitUid && account.userId && account.userId !== activeAuthUid && account.userId !== 'guest' && activeAuthUid !== 'guest') {
      console.warn('[Security Guard] Blocked attempt to overwrite active user session with another user account:', {
        accountUserId: account.userId,
        activeAuthUid,
      });
      return;
    }

    account.userId = uid;

    // Recalculate level strictly from real lifetime XP
    const levelInfo = calculateLevelInfo(account.lifetimeXp || 0);
    account.currentLevel = levelInfo.level;
    if (account.profile) {
      account.profile.tier = levelInfo.tier;
    }

    // Calculate real weekly XP
    const weekInfo = getCurrentWeekInfo();
    const weeklyEarned = calculateWeeklyXpForAccount(account);
    account.weeklyXp = {
      weekId: weekInfo.weekId,
      xpEarned: weeklyEarned,
      lastCalculatedAt: Date.now(),
    };

    // 1. UPDATE IN-MEMORY CACHE
    userAccountCache.set(uid, account);

    // 2. ISOLATED LOCAL STORAGE SAVE
    if (typeof window !== 'undefined') {
      try {
        const jsonStr = JSON.stringify(account);
        localStorage.setItem(`farukat_xp_account_${uid}`, jsonStr);
      } catch (storageErr) {
        console.warn('LocalStorage save XP notice:', storageErr);
      }
    }

    // 3. SYNC TO CLOUD FIRESTORE & TURSO DATABASE (AUTHENTICATED ONLY) - AWAIT SAVE TO GUARANTEE PERSISTENCE BEFORE SWITCH/RELOAD
    if (!localOnly && uid && uid !== 'guest') {
      // Evaluate achievements before syncing
      const { evaluateAchievements } = await import('./achievementSystem');
      await evaluateAchievements(account);

      if (xpSaveDebounceTimer) clearTimeout(xpSaveDebounceTimer);
      try {
        await saveUserAccountToCloud(uid, account);
      } catch (err) {
        console.warn('Immediate save to Firestore notice:', err);
      }

      try {
        await updateTursoProfile({
          explicitUserId: uid,
          username: account.profile?.name,
          avatar: account.profile?.avatarUrl,
          cardTheme: account.profile?.cardTheme,
          cardNumber: account.profile?.cardNumber,
          bio: account.profile?.bio,
          signatureUrl: account.profile?.signatureUrl,
          memberSince: account.profile?.memberSince,
          tier: account.profile?.tier,
          proMember: account.profile?.tier === 'DIAMOND' || (account.currentLevel || 1) >= 8,
          lifetimeXp: account.lifetimeXp,
          level: account.currentLevel,
          accountData: {
            currentLevel: account.currentLevel,
            lifetimeXp: account.lifetimeXp,
            theme: account.profile?.cardTheme
          }
        });
      } catch (tursoErr) {
        console.warn('Immediate save to Turso notice:', tursoErr);
      }
    }

    // Dispatch global event for instant UI sync ONLY if it belongs to the active session
    if (typeof window !== 'undefined' && (uid === activeAuthUid || uid === 'guest')) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(XP_EVENT_NAME, { detail: { account, uid } }));
      }, 0);
    }
  } catch (e) {
    console.error('Error saving XP account:', e);
  }
};

// LISTEN TO REAL-TIME XP ACCOUNT CHANGES (FIRESTORE ONSNAPSHOT + LOCAL EVENT)
export const subscribeToXpAccount = (callback: (account: XpAccount) => void, explicitUid?: string) => {
  const targetUid = getActiveUserIdForXp(explicitUid);

  // Deliver current local/cached account immediately
  const initialAccount = userAccountCache.get(targetUid) || getXpAccount(targetUid);
  callback(initialAccount);

  let unsubscribeFirestore = () => {};
  // Firestore onSnapshot disabled to conserve Firestore database quota and use Turso/local state

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ account: XpAccount; uid: string } | XpAccount>;
    if (customEvent.detail) {
      if ('account' in customEvent.detail && 'uid' in customEvent.detail) {
        if (customEvent.detail.uid === targetUid) {
          callback(customEvent.detail.account);
        }
      } else {
        callback(customEvent.detail as XpAccount);
      }
    } else {
      callback(getXpAccount(targetUid));
    }
  };

  window.addEventListener(XP_EVENT_NAME, handler);
  return () => {
    unsubscribeFirestore();
    window.removeEventListener(XP_EVENT_NAME, handler);
  };
};

// CENTRAL XP AWARD ENGINE (IMMUTABLE AUDIT LEDGER)
export const awardXp = async (
  reason: string,
  amount: number,
  category: XpTransaction['category'],
  metadata?: Record<string, any>,
  localOnly = false,
  explicitUid?: string
) => {
  // Prevent guests from earning XP
  const user = auth.currentUser;
  const isFirebaseGuest = (user as any)?.isGuest;
  
  let isLocalGuest = false;
  try {
    const savedSessionRaw = sessionStorage.getItem("farukat_current_session_v2");
    if (savedSessionRaw) {
      const parsed = JSON.parse(savedSessionRaw);
      if (parsed.isGuest || parsed.uid === 'guest') isLocalGuest = true;
    }
  } catch {}

  const targetUid = getActiveUserIdForXp(explicitUid);

  if (isFirebaseGuest || isLocalGuest || targetUid === 'guest') {
    return { account: getXpAccount(targetUid), leveledUp: false, newLevel: 1, earnedAchievements: [] };
  }

  if (amount <= 0) {
    return { account: getXpAccount(targetUid), leveledUp: false, newLevel: 1, earnedAchievements: [] };
  }

  const account = getXpAccount(targetUid);
  const oldLevel = account.currentLevel;
  const isProUser = checkIsPro(account);
  const effectiveAmount = isProUser ? amount * 2 : amount;
  const effectiveReason = isProUser ? `${reason} (2X PRO VIP BONUS)` : reason;

  // Process XP locally (Backend sync disabled per user request)
  // 1. Add XP Transaction
  const transaction: XpTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    amount: effectiveAmount,
    type: 'earned',
    reason: effectiveReason,
    category,
    timestamp: Date.now(),
    metadata,
  };

  account.transactions.unshift(transaction);
  account.currentXp += effectiveAmount;
  account.lifetimeXp += effectiveAmount;

  // 2. Re-calculate Level and Rank
  const oldLevelInfo = calculateLevelInfo(account.lifetimeXp - effectiveAmount);
  const newLevelInfo = calculateLevelInfo(account.lifetimeXp);
  const leveledUp = newLevelInfo.level > oldLevel;
  const rankedUp = Boolean(newLevelInfo.isRanked && (newLevelInfo.rankLabel !== oldLevelInfo.rankLabel));
  account.currentLevel = newLevelInfo.level;
  account.profile.tier = newLevelInfo.tier;

  // 3. Save and return
  await saveXpAccount(account, localOnly, targetUid);

  // Sync to Turso database asynchronously
  if (!localOnly && user?.uid && !isFirebaseGuest) {
    awardTursoXp(category, effectiveAmount, metadata?.referenceId).catch((err) => {
      console.warn('[Turso XP] Async award sync warning:', err?.message || err);
    });
  }

  // Show Toast Event
  dispatchToast({
    title: rankedUp
      ? `Promoted to ${newLevelInfo.rankLabel}!`
      : leveledUp
      ? `Level Up! Level ${newLevelInfo.level}`
      : `+${amount} XP Earned!`,
    description: rankedUp
      ? `You advanced to ${newLevelInfo.rankLabel} in the Prestige Ladder`
      : reason,
    type: (leveledUp || rankedUp) ? 'levelup' : 'xp',
    level: leveledUp ? newLevelInfo.level : undefined,
  });

  // Dispatch In-App Notification on Level/Rank Advance
  if (leveledUp || rankedUp) {
    try {
      notifyLevelUp(
        newLevelInfo.level,
        rankedUp && newLevelInfo.rankLabel ? newLevelInfo.rankLabel : (newLevelInfo.tier || 'Cinema Member')
      );
    } catch (notifErr) {
      console.warn('[XP System] Level notification dispatch warning:', notifErr);
    }
  }

  return { account, leveledUp, newLevel: newLevelInfo.level };
};

// SPEND XP ENGINE
export const spendXp = async (
  reason: string,
  amount: number,
  perkId?: string
): Promise<{ success: boolean; account: XpAccount; error?: string }> => {
  const account = getXpAccount();

  if (account.currentXp < amount) {
    return {
      success: false,
      account,
      error: `Insufficient XP. You have ${account.currentXp} XP, but this perk requires ${amount} XP.`,
    };
  }

  // Deduct
  account.currentXp -= amount;
  account.xpSpentTotal += amount;

  const transaction: XpTransaction = {
    id: `tx_spend_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    amount,
    type: 'spent',
    reason,
    category: 'perk_redemption',
    timestamp: Date.now(),
    metadata: { perkId },
  };

  account.transactions.unshift(transaction);
  await saveXpAccount(account);

  dispatchToast({
    title: `-${amount} XP Redeemed`,
    description: reason,
    type: 'spend',
  });

  return { success: true, account };
};

// WEEKLY ROTATING QUESTS ENGINE
export const getCurrentWeekInfo = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  const year = now.getFullYear();
  const weekId = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

  const daysUntilSunday = (7 - now.getDay()) % 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  nextSunday.setHours(23, 59, 59, 999);
  
  return { year, weekNumber, weekId, resetTime: nextSunday.getTime() };
};

// ACTION HOOKS TO RECORD REAL EVENTS
export const recordDailyLogin = async (explicitUid?: string) => {
  const account = getXpAccount(explicitUid);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayIso = `${year}-${month}-${day}`;

  const targetUid = explicitUid || account.userId || 'usr_anonymous';
  const dailyClaimKey = `farukat_daily_login_claimed_${targetUid}_${todayIso}`;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(dailyClaimKey) === 'true') {
      return;
    }
  } catch {}

  if (!account.stats.streakMilestonesClaimed) {
    account.stats.streakMilestonesClaimed = [];
  }
  if (!account.stats.dailyLoginDates) {
    account.stats.dailyLoginDates = [];
  }

  const lastDateStr = account.stats.lastLoginDate || account.stats.lastActiveDate;

  if (lastDateStr) {
    const [y1, m1, d1] = lastDateStr.split('-').map(Number);
    const [y2, m2, d2] = todayIso.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // SAME day: Do NOT increment again (only one increment per calendar day)
      try {
        localStorage.setItem(dailyClaimKey, 'true');
      } catch {}
      return;
    } else if (diffDays === 1) {
      // NEW calendar day exactly 1 day after last active day: increment by +1
      account.stats.currentStreak = (account.stats.currentStreak || 0) + 1;
    } else if (diffDays > 1) {
      // Missed a full day (skipped calendar day): reset streak to 0, start new streak at 1
      account.stats.currentStreak = 1;
    }
  } else {
    // First active calendar day
    account.stats.currentStreak = 1;
  }

  try {
    localStorage.setItem(dailyClaimKey, 'true');
  } catch {}

  account.stats.longestStreak = Math.max(account.stats.longestStreak || 0, account.stats.currentStreak);
  account.stats.lastLoginDate = todayIso;
  account.stats.lastActiveDate = todayIso;
  if (!account.stats.dailyLoginDates.includes(todayIso)) {
    account.stats.dailyLoginDates.push(todayIso);
  }

  await saveXpAccount(account, false, explicitUid);

  // Normal Daily Login Bonus
  await awardXp(`Daily Login Bonus (${account.stats.currentStreak}-Day Streak)`, 25, 'daily_login', {
    streak: account.stats.currentStreak,
  }, false, explicitUid);

  // Check Milestone XP Bonuses (10, 25, 67, 99, 100)
  const currentStreak = account.stats.currentStreak;
  const milestoneBonus = STREAK_MILESTONES[currentStreak];

  if (milestoneBonus !== undefined && !account.stats.streakMilestonesClaimed.includes(currentStreak)) {
    account.stats.streakMilestonesClaimed.push(currentStreak);
    await saveXpAccount(account, false, explicitUid);

    await awardXp(
      `${currentStreak}-Day Streak Milestone Bonus`,
      milestoneBonus,
      'bonus',
      { milestoneStreak: currentStreak },
      false,
      explicitUid
    );

    dispatchToast({
      title: `${currentStreak}-Day Streak! +${milestoneBonus} XP`,
      description: 'Day Streak milestone unlocked',
      type: 'achievement',
      icon: 'flame',
    });
  }

  // Persist current_streak, last_active_date, longest_streak to Turso users table
  syncTursoStreak({
    clientDate: todayIso,
    explicitUserId: explicitUid || account.userId
  }).catch((err) => {
    console.warn('[Turso DB] Streak sync notice:', err);
  });
};

export const recordWatchTimeSeconds = (mediaId: string, secondsCount: number, localOnly = false) => {
  if (secondsCount <= 0) return;
  const account = getXpAccount();
  
  if (account.stats.totalWatchSeconds === undefined) account.stats.totalWatchSeconds = 0;
  
  const oldSeconds = account.stats.totalWatchSeconds;
  // Accumulate actual seconds watched across all videos in real time (precise to decimal second)
  account.stats.totalWatchSeconds = Number((account.stats.totalWatchSeconds + secondsCount).toFixed(1));

  // Precise calculations of minutes and hours updated instantly
  account.stats.totalWatchMinutes = Math.floor(account.stats.totalWatchSeconds / 60);
  account.stats.totalWatchHours = Number((account.stats.totalWatchSeconds / 3600).toFixed(2));

  if (!account.stats.titlesWatched.includes(mediaId)) {
    account.stats.titlesWatched.push(mediaId);
  }

  saveXpAccount(account, localOnly);

  // Every 30 seconds of cumulative watch time -> +5 XP (Max 300 XP per day)
  const oldMilestones = Math.floor(oldSeconds / 30);
  const newMilestones = Math.floor(account.stats.totalWatchSeconds / 30);

  if (newMilestones > oldMilestones) {
    const today = new Date().toISOString().split('T')[0];
    if (account.stats.dailyWatchXpDate !== today) {
      account.stats.dailyWatchXpDate = today;
      account.stats.dailyWatchXpEarned = 0;
    }

    const currentDailyWatchXp = account.stats.dailyWatchXpEarned || 0;
    const MAX_DAILY_WATCH_XP = 300;

    if (currentDailyWatchXp >= MAX_DAILY_WATCH_XP) {
      saveXpAccount(account, localOnly);
      return;
    }

    const diff = newMilestones - oldMilestones;
    const requestedXp = diff * 5;
    const allowedXp = Math.min(requestedXp, MAX_DAILY_WATCH_XP - currentDailyWatchXp);

    if (allowedXp > 0) {
      account.stats.dailyWatchXpEarned = currentDailyWatchXp + allowedXp;
      saveXpAccount(account, localOnly);
      awardXp(`Streaming Milestone (+${diff * 30}s Watch Time)`, allowedXp, 'watch_time', { mediaId }, localOnly);
    }
  } else {
    saveXpAccount(account, localOnly);
  }
};

export const recordCompletedWatch = (mediaId: string, mediaTitle: string) => {
  const account = getXpAccount();
  account.stats.episodesCompleted += 1;
  saveXpAccount(account);

  awardXp(`Finished Streaming: ${mediaTitle}`, 50, 'completion', { mediaId });
};

export const recordWatchlistAction = (count: number, isAdding: boolean, mediaId?: string) => {
  const account = getXpAccount();
  account.stats.watchlistCount = count;

  if (!account.stats.watchlistMediaIds) {
    account.stats.watchlistMediaIds = [];
  }

  if (isAdding) {
    if (mediaId) {
      if (account.stats.watchlistMediaIds.includes(mediaId)) {
        saveXpAccount(account);
        return;
      }
      account.stats.watchlistMediaIds.push(mediaId);
    }
    saveXpAccount(account);
    awardXp('Added Title to Watchlist', 10, 'watchlist', { mediaId });
  } else {
    saveXpAccount(account);
  }
};

export const recordRatingAction = (count: number, mediaTitle?: string, mediaId?: string) => {
  const account = getXpAccount();
  account.stats.ratingsGiven = count;

  if (!account.stats.ratedMediaIds) {
    account.stats.ratedMediaIds = [];
  }

  // Prevent duplicate rating XP exploit
  if (mediaId) {
    if (account.stats.ratedMediaIds.includes(mediaId)) {
      saveXpAccount(account);
      return;
    }
    account.stats.ratedMediaIds.push(mediaId);
  }

  saveXpAccount(account);
  awardXp(`Reviewed: ${mediaTitle || 'Cinema Title'}`, 15, 'rating');
};

export const recordDownloadAction = (count: number) => {
  const account = getXpAccount();
  account.stats.downloadsCount = count;
  saveXpAccount(account);

  awardXp('Saved Title to Offline Vault', 15, 'download');
};

export const recordProfileUpdate = async (name: string, avatarUrl: string, theme?: CardTheme, signatureUrl?: string) => {
  const account = getXpAccount();
  const wasCompleted = account.stats.profileCompleted;

  account.profile.name = name.trim() || account.profile.name;
  account.profile.avatarUrl = avatarUrl.trim() || account.profile.avatarUrl;
  if (theme) {
    account.profile.cardTheme = theme;
  }
  if (signatureUrl) {
    account.profile.signatureUrl = signatureUrl;
  }
  account.stats.profileCompleted = true;
  await saveXpAccount(account);

  // Directly push to Turso immediately
  const uid = getActiveUserIdForXp();
  if (uid && uid !== 'guest') {
    try {
      await updateTursoProfile({
        explicitUserId: uid,
        username: account.profile.name,
        avatar: account.profile.avatarUrl,
        cardTheme: account.profile.cardTheme,
        cardNumber: account.profile.cardNumber,
        bio: account.profile.bio,
        signatureUrl: account.profile.signatureUrl,
        lifetimeXp: account.lifetimeXp,
        level: account.currentLevel,
      });
    } catch (tursoErr) {
      console.warn('Direct Turso profile update notice:', tursoErr);
    }
  }

  if (!wasCompleted) {
    awardXp('Completed Profile Setup', 30, 'profile');
  }
};

// TOAST NOTIFICATION EVENT DISPATCHER
export interface XpToastData {
  title: string;
  description: string;
  type: 'xp' | 'levelup' | 'spend' | 'achievement';
  level?: number;
  icon?: 'flame' | 'zap' | 'shield' | 'trophy';
}

let lastToastTime = 0;
let lastToastSig = '';

export const dispatchToast = (data: XpToastData) => {
  if (typeof window !== 'undefined') {
    const now = Date.now();
    const sig = `${data.type}_${data.level || ''}_${data.title}_${data.description}`;
    if (sig === lastToastSig && now - lastToastTime < 2000) {
      return; // Suppress duplicate rapid toast
    }
    lastToastTime = now;
    lastToastSig = sig;

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('farukat_toast', { detail: data }));
    }, 0);
  }
};

export const subscribeToToasts = (callback: (data: XpToastData) => void) => {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<XpToastData>;
    if (customEvent.detail) {
      const title = String(customEvent.detail.title || '').toLowerCase();
      const description = String(customEvent.detail.description || '').toLowerCase();
      if (
        title.includes('quota') ||
        title.includes('database is full') ||
        title.includes('data full') ||
        description.includes('quota') ||
        description.includes('database is full') ||
        description.includes('data full')
      ) {
        console.warn('[Toast Filtered] Suppressed quota/database full toast:', customEvent.detail);
        return;
      }
      callback(customEvent.detail);
    }
  };
  window.addEventListener('farukat_toast', handler);
  return () => window.removeEventListener('farukat_toast', handler);
};
