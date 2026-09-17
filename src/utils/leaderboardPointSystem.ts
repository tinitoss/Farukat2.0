import { XpAccount } from '../types';
import { LeaderboardEntry } from './tursoClient';
import { calculateRankInfo } from './rankSystem';

export interface PointBreakdownData {
  xp: number;
  xpPoints: number;
  watchSeconds: number;
  watchHours: number;
  watchPoints: number;
  currentStreak: number;
  streakPoints: number;
  streakPenalty: number;
  isStreakLost: boolean;
  unlockedAchievementsCount: number;
  achievementPoints: number;
  rankSteps: number;
  rankLabel: string | null;
  rankPoints: number;
  totalPoints: number;
}

/**
 * Calculates accurate leaderboard points and detailed breakdown from account or entry data
 */
export function calculatePointBreakdown(
  data: {
    xp?: number;
    lifetimeXp?: number;
    currentXp?: number;
    stats?: {
      totalWatchSeconds?: number;
      currentStreak?: number;
      lastActiveDate?: string;
      lastLoginDate?: string;
      streakLost?: boolean;
      streakBroken?: boolean;
    };
    watch_seconds?: number;
    current_streak?: number;
    last_active_date?: string;
    streak_penalty?: number;
    unlocked_achievements_count?: number;
    unlockedAchievements?: string[];
    rank_tier?: string;
    points?: number;
  } | null | undefined
): PointBreakdownData {
  const xp = Number(
    data?.lifetimeXp ?? 
    data?.xp ?? 
    data?.currentXp ?? 
    0
  );

  const watchSeconds = Number(
    data?.stats?.totalWatchSeconds ?? 
    data?.watch_seconds ?? 
    0
  );

  const rawStreak = Number(
    data?.stats?.currentStreak ?? 
    data?.current_streak ?? 
    0
  );

  const lastActiveStr = data?.stats?.lastActiveDate || data?.stats?.lastLoginDate || data?.last_active_date;
  let currentStreak = rawStreak;

  // Streak expiration validation:
  // If user has not opened their account for a single day (> 24h, i.e., diffDays > 1), streak is lost (0)
  if (currentStreak > 0 && lastActiveStr) {
    const todayIso = new Date().toISOString().split('T')[0];
    const [y1, m1, d1] = String(lastActiveStr).split('-').map(Number);
    const [y2, m2, d2] = todayIso.split('-').map(Number);
    if (!isNaN(y1) && !isNaN(m1) && !isNaN(d1)) {
      const utc1 = Date.UTC(y1, m1 - 1, d1);
      const utc2 = Date.UTC(y2, m2 - 1, d2);
      const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        currentStreak = 0;
      }
    }
  } else if (currentStreak > 0 && !lastActiveStr) {
    currentStreak = 0;
  }

  const isStreakLost = Boolean(
    data?.stats?.streakLost || 
    data?.stats?.streakBroken || 
    (data?.streak_penalty && data.streak_penalty > 0)
  );

  const streakPenalty = isStreakLost ? 500 : 0;

  const xpPoints = Math.round(xp / 500);
  const watchHours = watchSeconds / 3600;
  const watchPoints = Math.round(watchHours * 100);
  const streakPoints = currentStreak * 50;

  const unlockedAchievementsCount = Number(
    data?.unlocked_achievements_count ??
    data?.unlockedAchievements?.length ??
    0
  );
  const achievementPoints = unlockedAchievementsCount * 55;

  // Prestige Rank Points (Active for Level 500+ / 5,000,000+ XP)
  // 19 prestige rank steps from Bronze I to MASTER. Each unlocked rank grants 100 leaderboard points.
  let rankSteps = 0;
  let rankLabel: string | null = null;
  let rankPoints = 0;

  if (xp >= 5000000) {
    rankSteps = Math.min(19, 1 + Math.floor((xp - 5000000) / 10000));
    const rankInfo = calculateRankInfo(xp);
    rankLabel = data?.rank_tier || rankInfo.label || `Rank ${rankSteps}`;
    rankPoints = rankSteps * 100;
  }

  const calculatedTotal = Math.max(
    0,
    Math.round(xpPoints + watchPoints + streakPoints + achievementPoints + rankPoints - streakPenalty)
  );
  const totalPoints = calculatedTotal;

  return {
    xp,
    xpPoints,
    watchSeconds,
    watchHours,
    watchPoints,
    currentStreak,
    streakPoints,
    streakPenalty,
    isStreakLost,
    unlockedAchievementsCount,
    achievementPoints,
    rankSteps,
    rankLabel,
    rankPoints,
    totalPoints
  };
}

export type MovementType = 'UP' | 'DOWN' | 'SAME' | 'NEW';

export interface RankMovement {
  type: MovementType;
  delta: number;
  label: string;
}

/**
 * Derives the movement indicator from current rank and previous rank / rank_delta
 */
export function getRankMovement(
  currentRank: number,
  previousRank?: number | null,
  rankDelta?: number
): RankMovement {
  if (rankDelta !== undefined && rankDelta !== 0) {
    if (rankDelta > 0) {
      return { type: 'UP', delta: rankDelta, label: `↑ ${rankDelta}` };
    } else {
      return { type: 'DOWN', delta: Math.abs(rankDelta), label: `↓ ${Math.abs(rankDelta)}` };
    }
  }

  if (previousRank === null || previousRank === undefined) {
    return { type: 'NEW', delta: 0, label: 'NEW' };
  }

  if (previousRank > currentRank) {
    const delta = previousRank - currentRank;
    return { type: 'UP', delta, label: `↑ ${delta}` };
  } else if (previousRank < currentRank) {
    const delta = currentRank - previousRank;
    return { type: 'DOWN', delta, label: `↓ ${delta}` };
  } else {
    return { type: 'SAME', delta: 0, label: '—' };
  }
}

/**
 * Format points with thousand separators (e.g. 10,002)
 */
export function formatPoints(points: number): string {
  return Math.round(points).toLocaleString('en-US');
}
