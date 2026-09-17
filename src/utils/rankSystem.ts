export type RankTierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Legendary' | 'MASTER';

export interface RankDefinition {
  id: string;
  tier: RankTierName;
  subRank: number | null; // 1, 2, 3 or null for MASTER
  label: string; // e.g. "Bronze I", "Legendary III", "MASTER"
  minXp: number;
  maxXp: number | null; // null for MASTER
}

export const LEVEL_500_XP_THRESHOLD = 5000000;
export const XP_PER_RANK_STEP = 10000;

export const RANK_TIER_ORDER: RankTierName[] = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Legendary',
  'MASTER',
];

// 18 sub-ranks (6 tiers * 3 sub-ranks) + MASTER ceiling = 19 ranks
export const RANK_LADDER: RankDefinition[] = (() => {
  const ladder: RankDefinition[] = [];
  const tiers: Array<Exclude<RankTierName, 'MASTER'>> = [
    'Bronze',
    'Silver',
    'Gold',
    'Platinum',
    'Diamond',
    'Legendary',
  ];

  let currentMinXp = LEVEL_500_XP_THRESHOLD;
  for (const tier of tiers) {
    for (let sub = 1; sub <= 3; sub++) {
      const roman = sub === 1 ? 'I' : sub === 2 ? 'II' : 'III';
      const label = `${tier} ${roman}`;
      const maxXp = currentMinXp + XP_PER_RANK_STEP;
      ladder.push({
        id: `${tier.toLowerCase()}_${sub}`,
        tier,
        subRank: sub,
        label,
        minXp: currentMinXp,
        maxXp,
      });
      currentMinXp = maxXp;
    }
  }

  // MASTER ceiling
  ladder.push({
    id: 'master',
    tier: 'MASTER',
    subRank: null,
    label: 'MASTER',
    minXp: currentMinXp,
    maxXp: null,
  });

  return ladder;
})();

export interface CalculatedRankInfo {
  isRanked: boolean;
  tier: RankTierName | null;
  subRank: number | null;
  label: string | null;
  nextRankLabel: string | null;
  isMaster: boolean;
  minXp: number;
  nextRankXp: number | null;
  xpEarnedInRank: number;
  xpNeededForNextRank: number;
  progressPercent: number;
}

/**
 * Calculates rank state if lifetimeXp >= 5,000,000 (Level 500 cap).
 */
export function calculateRankInfo(lifetimeXp: number): CalculatedRankInfo {
  if (lifetimeXp < LEVEL_500_XP_THRESHOLD) {
    return {
      isRanked: false,
      tier: null,
      subRank: null,
      label: null,
      nextRankLabel: null,
      isMaster: false,
      minXp: 0,
      nextRankXp: null,
      xpEarnedInRank: 0,
      xpNeededForNextRank: 0,
      progressPercent: 0,
    };
  }

  // Check MASTER ceiling
  const masterDef = RANK_LADDER[RANK_LADDER.length - 1];
  if (lifetimeXp >= masterDef.minXp) {
    return {
      isRanked: true,
      tier: 'MASTER',
      subRank: null,
      label: 'MASTER',
      nextRankLabel: null,
      isMaster: true,
      minXp: masterDef.minXp,
      nextRankXp: null,
      xpEarnedInRank: lifetimeXp - masterDef.minXp,
      xpNeededForNextRank: 0,
      progressPercent: 100,
    };
  }

  // Find corresponding rank step
  for (let i = 0; i < RANK_LADDER.length - 1; i++) {
    const r = RANK_LADDER[i];
    const nextR = RANK_LADDER[i + 1];
    if (lifetimeXp >= r.minXp && (r.maxXp === null || lifetimeXp < r.maxXp)) {
      const xpEarnedInRank = lifetimeXp - r.minXp;
      const range = (r.maxXp || r.minXp + XP_PER_RANK_STEP) - r.minXp;
      const xpNeededForNextRank = Math.max(0, (r.maxXp || r.minXp + XP_PER_RANK_STEP) - lifetimeXp);
      const progressPercent = Math.min(100, Math.max(0, Math.round((xpEarnedInRank / range) * 100)));

      return {
        isRanked: true,
        tier: r.tier,
        subRank: r.subRank,
        label: r.label,
        nextRankLabel: nextR ? nextR.label : null,
        isMaster: false,
        minXp: r.minXp,
        nextRankXp: r.maxXp,
        xpEarnedInRank,
        xpNeededForNextRank,
        progressPercent,
      };
    }
  }

  // Default fallback to Bronze I
  const bronze1 = RANK_LADDER[0];
  return {
    isRanked: true,
    tier: bronze1.tier,
    subRank: bronze1.subRank,
    label: bronze1.label,
    nextRankLabel: RANK_LADDER[1]?.label || null,
    isMaster: false,
    minXp: bronze1.minXp,
    nextRankXp: bronze1.maxXp,
    xpEarnedInRank: 0,
    xpNeededForNextRank: XP_PER_RANK_STEP,
    progressPercent: 0,
  };
}

export interface RankVisualTheme {
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeGlow: string;
  progressBar: string;
  iconColor: string;
}

export const RANK_VISUAL_THEMES: Record<RankTierName, RankVisualTheme> = {
  Bronze: {
    textColor: 'text-[#d9824c]',
    badgeBg: 'bg-[#cd7f32]/15',
    badgeBorder: 'border-[#cd7f32]/40',
    badgeGlow: 'shadow-[0_0_12px_rgba(205,127,50,0.25)]',
    progressBar: 'bg-gradient-to-r from-[#a35222] to-[#d9824c]',
    iconColor: '#d9824c',
  },
  Silver: {
    textColor: 'text-[#e5e7eb]',
    badgeBg: 'bg-[#9ca3af]/15',
    badgeBorder: 'border-[#d1d5db]/35',
    badgeGlow: 'shadow-[0_0_12px_rgba(209,213,219,0.2)]',
    progressBar: 'bg-gradient-to-r from-[#6b7280] via-[#9ca3af] to-[#e5e7eb]',
    iconColor: '#e5e7eb',
  },
  Gold: {
    textColor: 'text-[#fbbf24]',
    badgeBg: 'bg-[#f59e0b]/15',
    badgeBorder: 'border-[#fbbf24]/40',
    badgeGlow: 'shadow-[0_0_14px_rgba(251,191,36,0.3)]',
    progressBar: 'bg-gradient-to-r from-[#b45309] to-[#fbbf24]',
    iconColor: '#fbbf24',
  },
  Platinum: {
    textColor: 'text-[#93c5fd]',
    badgeBg: 'bg-[#38bdf8]/15',
    badgeBorder: 'border-[#7dd3fc]/45',
    badgeGlow: 'shadow-[0_0_15px_rgba(56,189,248,0.25)]',
    progressBar: 'bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#bae6fd]',
    iconColor: '#93c5fd',
  },
  Diamond: {
    textColor: 'text-[#67e8f9]',
    badgeBg: 'bg-[#06b6d4]/15',
    badgeBorder: 'border-[#67e8f9]/50',
    badgeGlow: 'shadow-[0_0_16px_rgba(103,232,249,0.35)]',
    progressBar: 'bg-gradient-to-r from-[#0891b2] via-[#67e8f9] to-[#ffffff]',
    iconColor: '#67e8f9',
  },
  Legendary: {
    textColor: 'text-[#e2b14c]',
    badgeBg: 'bg-[#e2b14c]/20',
    badgeBorder: 'border-[#e2b14c]/70',
    badgeGlow: 'shadow-[0_0_20px_rgba(226,177,76,0.45)] ring-1 ring-[#e2b14c]/40',
    progressBar: 'bg-gradient-to-r from-[#b38328] via-[#e2b14c] to-[#ffe082]',
    iconColor: '#e2b14c',
  },
  MASTER: {
    textColor: 'text-white',
    badgeBg: 'bg-gradient-to-r from-[#e2b14c]/25 via-[#a855f7]/25 to-[#e2b14c]/25',
    badgeBorder: 'border-[#e2b14c] ring-1 ring-[#a855f7]/60',
    badgeGlow: 'shadow-[0_0_24px_rgba(226,177,76,0.5),0_0_12px_rgba(168,85,247,0.4)]',
    progressBar: 'bg-gradient-to-r from-[#e2b14c] via-[#c084fc] to-[#ffffff]',
    iconColor: '#e2b14c',
  },
};

/**
 * Helper to get theme for rank tier or fallback to bronze
 */
export function getRankTheme(tier?: RankTierName | string | null): RankVisualTheme {
  if (!tier) return RANK_VISUAL_THEMES.Bronze;
  const match = Object.keys(RANK_VISUAL_THEMES).find(
    k => k.toLowerCase() === tier.toLowerCase()
  ) as RankTierName | undefined;
  return match ? RANK_VISUAL_THEMES[match] : RANK_VISUAL_THEMES.Bronze;
}
