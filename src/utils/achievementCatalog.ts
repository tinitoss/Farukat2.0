import { XpAccount } from '../types';
import { awardXp, dispatchToast } from './xpSystem';
import { notifyAchievementUnlocked } from './inAppNotificationSystem';
import {
  unlockTursoAchievementClient,
  syncTursoTierProgressClient,
  updateTursoWeeklyChallengeProgressClient
} from './tursoClient';

// -----------------------------------------------------------------------------
// 1. PERMANENT CORE ACHIEVEMENTS
// -----------------------------------------------------------------------------

export interface CoreAchievementDef {
  key: string;
  title: string;
  description: string;
  criteria: string;
  category: 'viewing' | 'community' | 'social' | 'curation';
  xpReward: number;
  iconName: string;
}

export const CORE_ACHIEVEMENTS: CoreAchievementDef[] = [
  {
    key: 'first_watch',
    title: 'First Watch',
    description: 'Began your cinematic journey by streaming your first title on Farukat.',
    criteria: 'Stream at least 1 video or movie',
    category: 'viewing',
    xpReward: 100,
    iconName: 'Film'
  },
  {
    key: 'night_owl',
    title: 'Night Owl',
    description: 'Immersed in midnight cinema between 00:00 and 05:00 UTC.',
    criteria: 'Watch any content during late night hours',
    category: 'viewing',
    xpReward: 150,
    iconName: 'Moon'
  },
  {
    key: 'binge_5_in_day',
    title: 'Binge Master',
    description: 'Completed 5 episodes or movies within a single calendar day.',
    criteria: 'Complete 5 titles in one day',
    category: 'viewing',
    xpReward: 250,
    iconName: 'Layers'
  },
  {
    key: 'genre_explorer',
    title: 'Genre Explorer',
    description: 'Expanded cinematic horizons by exploring titles across 5 distinct genres.',
    criteria: 'Watch content from 5 different genres',
    category: 'viewing',
    xpReward: 200,
    iconName: 'Compass'
  },
  {
    key: 'party_starter',
    title: 'Party Starter',
    description: 'Hosted or participated in your first synchronized Watch Party room.',
    criteria: 'Host or join a Watch Party session',
    category: 'social',
    xpReward: 250,
    iconName: 'Users'
  },
  {
    key: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Shared Farukat with fellow cinephiles using your VIP referral pass.',
    criteria: 'Share your referral link or recruit a member',
    category: 'social',
    xpReward: 200,
    iconName: 'Share2'
  },
  {
    key: 'cinema_critic',
    title: 'Cinema Critic',
    description: 'Contributed insightful critical perspective by writing your first review.',
    criteria: 'Publish at least 1 movie review',
    category: 'community',
    xpReward: 150,
    iconName: 'FileText'
  },
  {
    key: 'star_rater',
    title: 'Five Star Juror',
    description: 'Evaluated cinematic merit by submitting ratings for 5 distinct titles.',
    criteria: 'Submit ratings for 5 different movies',
    category: 'community',
    xpReward: 150,
    iconName: 'Star'
  },
  {
    key: 'vault_builder',
    title: 'Vault Builder',
    description: 'Built a curated personal archive by adding 10 movies to collections.',
    criteria: 'Add 10 titles to your watchlist or playlists',
    category: 'curation',
    xpReward: 150,
    iconName: 'Bookmark'
  },
  {
    key: 'audio_aficionado',
    title: 'Sound & Cinema',
    description: 'Experienced Farukat with custom ambient audio or audio player enabled.',
    criteria: 'Engage with soundtrack playback or audio mode',
    category: 'curation',
    xpReward: 100,
    iconName: 'Volume2'
  },
  {
    key: 'vip_cardholder',
    title: 'Cardholder Elite',
    description: 'Acquired a Silver Tier membership or personalized your digital pass.',
    criteria: 'Reach Silver Tier or customize your card',
    category: 'social',
    xpReward: 300,
    iconName: 'CreditCard'
  },
  {
    key: 'century_club',
    title: 'Century Club',
    description: 'Logged over 100 cumulative minutes of motion picture playback.',
    criteria: 'Accumulate 100 minutes of watch time',
    category: 'viewing',
    xpReward: 250,
    iconName: 'Clock'
  }
];

// Helper to test if a core achievement condition is met
export function checkCoreAchievementEligibility(
  key: string,
  account: XpAccount,
  additionalContext?: {
    watchSeconds?: number;
    currentHour?: number;
    dailyWatchedCount?: number;
    genresCount?: number;
    hasWatchParty?: boolean;
    hasSharedReferral?: boolean;
    hasAudio?: boolean;
  }
): { isMet: boolean; progress: number; target: number } {
  const stats = (account?.stats || {}) as Record<string, any>;
  const ctx = additionalContext || {};

  switch (key) {
    case 'first_watch': {
      const watched = (stats.episodesCompleted || 0) + (stats.titlesWatched?.length || 0);
      return { isMet: watched >= 1, progress: Math.min(1, watched), target: 1 };
    }
    case 'night_owl': {
      const hour = ctx.currentHour !== undefined ? ctx.currentHour : new Date().getUTCHours();
      const isLateNight = hour >= 0 && hour < 5;
      const isMet = isLateNight && ((stats.episodesCompleted || 0) > 0 || (ctx.watchSeconds || 0) > 60);
      return { isMet, progress: isMet ? 1 : 0, target: 1 };
    }
    case 'binge_5_in_day': {
      const count = ctx.dailyWatchedCount || stats.episodesCompleted || 0;
      return { isMet: count >= 5, progress: Math.min(5, count), target: 5 };
    }
    case 'genre_explorer': {
      const genres = ctx.genresCount || (stats.titlesWatched ? Math.min(5, Math.ceil(stats.titlesWatched.length / 2)) : 0);
      return { isMet: genres >= 5, progress: Math.min(5, genres), target: 5 };
    }
    case 'party_starter': {
      const hasParty = Boolean(ctx.hasWatchParty || (account as any)?.hasJoinedWatchParty);
      return { isMet: hasParty, progress: hasParty ? 1 : 0, target: 1 };
    }
    case 'social_butterfly': {
      const hasReferral = Boolean(
        ctx.hasSharedReferral ||
        (stats.referralsCompleted && stats.referralsCompleted > 0) ||
        (stats.followedUserIds && stats.followedUserIds.length > 0)
      );
      return { isMet: hasReferral, progress: hasReferral ? 1 : 0, target: 1 };
    }
    case 'cinema_critic': {
      const reviews = stats.reviewsCount || 0;
      return { isMet: reviews >= 1, progress: Math.min(1, reviews), target: 1 };
    }
    case 'star_rater': {
      const ratings = (stats.ratingsGiven || 0) + (stats.ratedMediaIds?.length || 0);
      return { isMet: ratings >= 5, progress: Math.min(5, ratings), target: 5 };
    }
    case 'vault_builder': {
      const vaultCount = (stats.watchlistCount || 0) + (stats.createdPlaylistIds?.length || 0);
      return { isMet: vaultCount >= 10, progress: Math.min(10, vaultCount), target: 10 };
    }
    case 'audio_aficionado': {
      let hasListenedAudio = false;
      try {
        hasListenedAudio = typeof window !== 'undefined' && localStorage.getItem('farukat_has_listened_audio') === 'true';
      } catch {}
      const hasAudio = Boolean(
        ctx.hasAudio ||
        stats.hasListenedAudio ||
        stats.audioPlayerEngaged ||
        stats.soundtrackPlayed ||
        hasListenedAudio ||
        (account as any)?.hasUsedAudioPlayer
      );
      return { isMet: hasAudio, progress: hasAudio ? 1 : 0, target: 1 };
    }
    case 'vip_cardholder': {
      const tier = account?.profile?.tier;
      const isSilverOrHigher = tier === 'SILVER' || tier === 'GOLD' || tier === 'PLATINUM' || tier === 'OBSIDIAN' || tier === 'DIAMOND';
      const isCardCustomized = Boolean(
        (account?.profile as any)?.isCardCustomized ||
        account?.profile?.signatureUrl ||
        (account?.profile?.cardTheme && account.profile.cardTheme !== 'ivory-gold' && account.profile.cardTheme !== 'goldprince-era')
      );
      const isMet = isSilverOrHigher || isCardCustomized || (account.lifetimeXp || 0) >= 500;
      return { isMet, progress: isMet ? 1 : 0, target: 1 };
    }
    case 'century_club': {
      const totalMins = Math.floor(((stats.totalWatchSeconds || 0) + (ctx.watchSeconds || 0)) / 60);
      return { isMet: totalMins >= 100, progress: Math.min(100, totalMins), target: 100 };
    }
    default:
      return { isMet: false, progress: 0, target: 1 };
  }
}

// -----------------------------------------------------------------------------
// 2. INFINITE ALGORITHMIC TIERS
// -----------------------------------------------------------------------------

export type TierCategory = 'watch_time' | 'genre_exploration' | 'social_likes' | 'day_streak';

export interface TierCategoryDef {
  category: TierCategory;
  name: string;
  unit: string;
  iconName: string;
  description: string;
  getTargetForTier: (tier: number) => number;
  getXpRewardForTier: (tier: number) => number;
  formatValue: (val: number) => string;
}

export const TIER_CATEGORIES: Record<TierCategory, TierCategoryDef> = {
  watch_time: {
    category: 'watch_time',
    name: 'Cumulative Watch Time',
    unit: 'hours',
    iconName: 'Clock',
    description: 'Tracks total hours of cinema screened across all time',
    getTargetForTier: (tier: number) => {
      // Tier 1 = 1h, Tier 2 = 3h, Tier 3 = 8h, Tier 4 = 20h, Tier 5 = 50h, etc.
      if (tier <= 1) return 1;
      return Math.round(1 * Math.pow(2.5, tier - 1));
    },
    getXpRewardForTier: (tier: number) => {
      return Math.round(100 * Math.pow(tier, 1.35));
    },
    formatValue: (hours: number) => `${Math.round(hours * 10) / 10}h`
  },
  genre_exploration: {
    category: 'genre_exploration',
    name: 'Genre Exploration',
    unit: 'genres',
    iconName: 'Compass',
    description: 'Tracks unique film categories discovered in your library',
    getTargetForTier: (tier: number) => {
      // Tier 1: 2, Tier 2: 4, Tier 3: 6, Tier 4: 8, Tier 5: 10...
      return Math.min(20, Math.max(2, tier * 2));
    },
    getXpRewardForTier: (tier: number) => {
      return Math.round(150 * Math.pow(tier, 1.3));
    },
    formatValue: (genres: number) => `${Math.floor(genres)} genres`
  },
  social_likes: {
    category: 'social_likes',
    name: 'Social & Community',
    unit: 'likes',
    iconName: 'Heart',
    description: 'Tracks lifetime ratings, reviews, and community likes',
    getTargetForTier: (tier: number) => {
      // Tier 1: 5, Tier 2: 12, Tier 3: 28, Tier 4: 65, Tier 5: 150...
      if (tier <= 1) return 5;
      return Math.round(5 * Math.pow(2.3, tier - 1));
    },
    getXpRewardForTier: (tier: number) => {
      return Math.round(80 * Math.pow(tier, 1.3));
    },
    formatValue: (likes: number) => `${Math.floor(likes)} likes`
  },
  day_streak: {
    category: 'day_streak',
    name: 'Daily Active Streak',
    unit: 'days',
    iconName: 'Flame',
    description: 'Tracks consecutive active calendar days of engagement',
    getTargetForTier: (tier: number) => {
      const presets = [3, 7, 14, 30, 60, 100, 150, 200, 300];
      if (tier <= presets.length) {
        return presets[tier - 1];
      }
      return 300 + (tier - presets.length) * 50;
    },
    getXpRewardForTier: (tier: number) => {
      return Math.round(150 * Math.pow(tier, 1.4));
    },
    formatValue: (days: number) => `${Math.floor(days)} days`
  }
};

// Calculate progress percentage and remaining toward current tier target
export function getTierCalculation(
  category: TierCategory,
  currentTier: number,
  currentValue: number
): {
  currentTier: number;
  currentValue: number;
  prevTarget: number;
  nextTarget: number;
  progressPercent: number;
  xpReward: number;
  isReadyToAdvance: boolean;
} {
  const def = TIER_CATEGORIES[category];
  const prevTarget = currentTier > 1 ? def.getTargetForTier(currentTier - 1) : 0;
  const nextTarget = def.getTargetForTier(currentTier);
  const xpReward = def.getXpRewardForTier(currentTier);

  const span = Math.max(1, nextTarget - prevTarget);
  const progressInTier = Math.max(0, currentValue - prevTarget);
  const progressPercent = Math.min(100, Math.floor((progressInTier / span) * 100));
  const isReadyToAdvance = currentValue >= nextTarget;

  return {
    currentTier,
    currentValue,
    prevTarget,
    nextTarget,
    progressPercent,
    xpReward,
    isReadyToAdvance
  };
}

// -----------------------------------------------------------------------------
// 3. AUTOMATED WEEKLY CHALLENGES (ISO WEEK DETERMINISTIC)
// -----------------------------------------------------------------------------

export interface WeeklyChallengeTemplate {
  challengeKey: string;
  title: string;
  descriptionTemplate: (target: number) => string;
  iconName: string;
  computeTarget: (seed: number) => number;
  computeXp: (target: number) => number;
}

export const WEEKLY_CHALLENGE_TEMPLATES: WeeklyChallengeTemplate[] = [
  {
    challengeKey: 'weekly_watch_hours',
    title: 'Cinema Marathon',
    descriptionTemplate: (target) => `Watch ${target} hours of cinema this week`,
    iconName: 'Clock',
    computeTarget: (seed) => 2 + (seed % 3), // 2, 3, or 4 hours
    computeXp: (target) => 200 + target * 50
  },
  {
    challengeKey: 'weekly_genre_dive',
    title: 'Genre Spotlight',
    descriptionTemplate: (_target) => `Screen at least 1 feature film from this week's spotlight`,
    iconName: 'Compass',
    computeTarget: (_seed) => 1,
    computeXp: (_target) => 200
  },
  {
    challengeKey: 'weekly_party_host',
    title: 'Party Connoisseur',
    descriptionTemplate: (_target) => `Host or join a synchronized Watch Party screening`,
    iconName: 'Users',
    computeTarget: (_seed) => 1,
    computeXp: (_target) => 300
  },
  {
    challengeKey: 'weekly_critique',
    title: 'Critic Columnist',
    descriptionTemplate: (target) => `Publish ${target} thoughtful reviews or ratings`,
    iconName: 'FileText',
    computeTarget: (seed) => 1 + (seed % 2), // 1 or 2 reviews
    computeXp: (target) => 150 + target * 50
  },
  {
    challengeKey: 'weekly_streak_keeper',
    title: 'Streak Vanguard',
    descriptionTemplate: (target) => `Maintain your active login streak for ${target} days this week`,
    iconName: 'Flame',
    computeTarget: (seed) => 3 + (seed % 3), // 3, 4, or 5 days
    computeXp: (target) => 200 + target * 40
  },
  {
    challengeKey: 'weekly_curator',
    title: 'Community Curator',
    descriptionTemplate: (target) => `Give ${target} likes to titles or community members`,
    iconName: 'Heart',
    computeTarget: (seed) => 3 + (seed % 3), // 3, 4, or 5 likes
    computeXp: (target) => 150 + target * 20
  },
  {
    challengeKey: 'weekly_titles',
    title: 'Triple Feature',
    descriptionTemplate: (target) => `Stream ${target} different episodes or movies`,
    iconName: 'Film',
    computeTarget: (seed) => 3 + (seed % 2), // 3 or 4 titles
    computeXp: (target) => 250 + target * 40
  }
];

// Helper to reliably resolve human-readable title, plain description and icon for any weekly challenge
export function getWeeklyChallengeMeta(challenge: { challengeKey: string; target?: number }): {
  title: string;
  description: string;
  iconName: string;
} {
  const target = Number(challenge.target || 1);
  const template = WEEKLY_CHALLENGE_TEMPLATES.find(t => t.challengeKey === challenge.challengeKey);
  if (template) {
    return {
      title: template.title,
      description: template.descriptionTemplate(target),
      iconName: template.iconName
    };
  }

  switch (challenge.challengeKey) {
    case 'weekly_watch_hours':
      return {
        title: 'Cinema Marathon',
        description: `Watch ${target} hours of cinema this week`,
        iconName: 'Clock'
      };
    case 'weekly_genre_dive':
      return {
        title: 'Genre Spotlight',
        description: `Screen at least 1 feature film from this week's spotlight`,
        iconName: 'Compass'
      };
    case 'weekly_party_host':
      return {
        title: 'Party Connoisseur',
        description: 'Host or join a synchronized Watch Party screening',
        iconName: 'Users'
      };
    case 'weekly_critique':
      return {
        title: 'Critic Columnist',
        description: `Publish ${target} thoughtful reviews or ratings`,
        iconName: 'FileText'
      };
    case 'weekly_streak_keeper':
      return {
        title: 'Streak Vanguard',
        description: `Maintain your active login streak for ${target} days this week`,
        iconName: 'Flame'
      };
    case 'weekly_curator':
      return {
        title: 'Community Curator',
        description: `Give ${target} likes to titles or community members`,
        iconName: 'Heart'
      };
    case 'weekly_titles':
      return {
        title: 'Triple Feature',
        description: `Stream ${target} different episodes or movies`,
        iconName: 'Film'
      };
    default: {
      const cleanName = challenge.challengeKey
        .replace(/^weekly_/, '')
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return {
        title: cleanName || 'Weekly Challenge',
        description: `Complete ${target} required actions this week`,
        iconName: 'Trophy'
      };
    }
  }
}

// Calculate ISO Week (e.g., "2026-W37")
export function getIsoWeekString(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Calculate upcoming Monday 00:00:00 UTC
export function getNextMondayUtc(date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d;
}

// Formatter for countdown to next Monday UTC
export function formatTimeRemainingToMondayUtc(date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  formatted: string;
  isEndingSoon: boolean; // < 24 hours
} {
  const nextMonday = getNextMondayUtc(date);
  const totalMs = Math.max(0, nextMonday.getTime() - date.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let formatted = '';
  if (days > 0) {
    formatted = `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes}m remaining`;
  } else {
    formatted = `${minutes}m ${seconds}s remaining`;
  }

  const isEndingSoon = totalMs < 24 * 60 * 60 * 1000;

  return { days, hours, minutes, seconds, totalMs, formatted, isEndingSoon };
}

// Deterministically pick exactly 3 challenges based on ISO week string
export function generateDeterministicWeeklyChallenges(isoWeek: string): Array<{
  challengeKey: string;
  title: string;
  description: string;
  target: number;
  xpReward: number;
  iconName: string;
}> {
  // Parse year and week
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  const year = match ? parseInt(match[1], 10) : 2026;
  const week = match ? parseInt(match[2], 10) : 1;
  const baseSeed = (year * 100) + week;

  const templates = [...WEEKLY_CHALLENGE_TEMPLATES];
  const selected: Array<{
    challengeKey: string;
    title: string;
    description: string;
    target: number;
    xpReward: number;
    iconName: string;
  }> = [];

  // Pick 3 distinct indices using deterministic pseudo-random shuffling
  for (let i = 0; i < 3; i++) {
    const seed = (baseSeed * 31 + i * 17 + 13) % 9973;
    const index = (seed + i) % templates.length;
    const picked = templates.splice(index, 1)[0];
    const target = picked.computeTarget(seed);
    const xpReward = picked.computeXp(target);

    selected.push({
      challengeKey: picked.challengeKey,
      title: picked.title,
      description: picked.descriptionTemplate(target),
      target,
      xpReward,
      iconName: picked.iconName
    });
  }

  return selected;
}

// -----------------------------------------------------------------------------
// 4. UNIFIED EVALUATION DISPATCHER
// -----------------------------------------------------------------------------

export async function evaluateAndUnlockAchievements(
  account: XpAccount,
  unlockedKeys: string[],
  additionalContext?: any
): Promise<CoreAchievementDef[]> {
  const newlyUnlocked: CoreAchievementDef[] = [];
  const uid = account.userId || (account.profile as any)?.memberId;

  for (const def of CORE_ACHIEVEMENTS) {
    if (unlockedKeys.includes(def.key)) continue;

    const { isMet } = checkCoreAchievementEligibility(def.key, account, additionalContext);
    if (isMet) {
      unlockedKeys.push(def.key);
      newlyUnlocked.push(def);

      // Persist permanently to Turso
      await unlockTursoAchievementClient(def.key, 1, uid);

      // Award XP
      await awardXp(`Achievement: ${def.title}`, def.xpReward, 'bonus', { achievementKey: def.key }, true);

      // Dispatch celebratory Toast (strictly NO EMOJI)
      dispatchToast({
        title: 'Achievement Unlocked',
        description: `${def.title} (+${def.xpReward} XP)`,
        type: 'achievement'
      });

      // Dispatch In-App Notification
      try {
        notifyAchievementUnlocked({
          key: def.key,
          title: def.title,
          xpReward: def.xpReward
        });
      } catch (notifErr) {
        console.warn('[Achievement] Notification dispatch warning:', notifErr);
      }
    }
  }

  return newlyUnlocked;
}
