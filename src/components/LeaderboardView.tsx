import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  X, 
  Sparkles, 
  Flame, 
  Clock, 
  TrendingUp, 
  Award, 
  Minus,
  ArrowUp,
  ArrowDown,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LeaderboardEntry, 
  fetchLeaderboard
} from '../utils/tursoClient';
import { XpAccount } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { 
  calculatePointBreakdown, 
  getRankMovement, 
  formatPoints, 
  PointBreakdownData 
} from '../utils/leaderboardPointSystem';

import cinemaBackdrop from '../assets/images/cinema_hall_backdrop_1789165778060.jpg';
import championArt from '../assets/images/champion_cinema_art_1789165790434.jpg';

interface LeaderboardViewProps {
  currentAccount: XpAccount;
  onBack: () => void;
  onNavigateToAchievements?: () => void;
}

// Handcrafted Cinematic Laurel Illustration for Podium Champions
const LaurelIllustration: React.FC<{ tier: 1 | 2 | 3 }> = ({ tier }) => {
  const color = tier === 1 ? '#E2B14C' : tier === 2 ? '#D4D4D8' : '#CD7F32';
  return (
    <svg 
      viewBox="0 0 100 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full pointer-events-none opacity-90"
    >
      {/* Left branch */}
      <path 
        d="M 50 44 C 36 42 22 34 16 20 C 14 14 16 6 22 2" 
        stroke={color} 
        strokeWidth="1.2" 
        strokeLinecap="round"
      />
      {/* Left leaves */}
      <path d="M 44 42 C 40 38 35 38 33 42 C 35 44 41 45 44 42 Z" fill={color} />
      <path d="M 33 36 C 28 32 23 34 22 38 C 24 40 30 40 33 36 Z" fill={color} />
      <path d="M 23 27 C 18 24 14 26 14 31 C 16 32 21 31 23 27 Z" fill={color} />
      <path d="M 17 17 C 12 15 10 19 11 23 C 14 23 17 21 17 17 Z" fill={color} />
      <path d="M 18 7 C 15 6 14 10 16 13 C 18 13 20 10 18 7 Z" fill={color} />

      {/* Right branch */}
      <path 
        d="M 50 44 C 64 42 78 34 84 20 C 86 14 84 6 78 2" 
        stroke={color} 
        strokeWidth="1.2" 
        strokeLinecap="round"
      />
      {/* Right leaves */}
      <path d="M 56 42 C 60 38 65 38 67 42 C 65 44 59 45 56 42 Z" fill={color} />
      <path d="M 67 36 C 72 32 77 34 78 38 C 76 40 70 40 67 36 Z" fill={color} />
      <path d="M 77 27 C 82 24 86 26 86 31 C 84 32 79 31 77 27 Z" fill={color} />
      <path d="M 83 17 C 88 15 90 19 89 23 C 86 23 83 21 83 17 Z" fill={color} />
      <path d="M 82 7 C 85 6 86 10 84 13 C 82 13 80 10 82 7 Z" fill={color} />
    </svg>
  );
};

// Movement Indicator Component with clean colors and typography
const MovementBadge: React.FC<{
  currentRank: number;
  previousRank?: number | null;
  rankDelta?: number;
  compact?: boolean;
}> = ({ currentRank, previousRank, rankDelta, compact }) => {
  const { t } = useTranslation();
  const movement = getRankMovement(currentRank, previousRank, rankDelta);

  if (movement.type === 'UP') {
    return (
      <div className={`inline-flex items-center gap-0.5 font-mono font-bold text-emerald-400 ${
        compact ? 'text-[10px]' : 'text-[11px]'
      }`}>
        <ArrowUp className="w-3 h-3 stroke-[2.5]" />
        <span>{movement.delta}</span>
      </div>
    );
  }

  if (movement.type === 'DOWN') {
    return (
      <div className={`inline-flex items-center gap-0.5 font-mono font-bold text-rose-400 ${
        compact ? 'text-[10px]' : 'text-[11px]'
      }`}>
        <ArrowDown className="w-3 h-3 stroke-[2.5]" />
        <span>{movement.delta}</span>
      </div>
    );
  }

  if (movement.type === 'NEW') {
    return (
      <span className="font-mono text-[9px] font-bold text-[#E2B14C] tracking-wider px-1 py-0.5 rounded bg-[#E2B14C]/10 border border-[#E2B14C]/20">
        {t('leaderboard.newBadge', undefined, 'NEW')}
      </span>
    );
  }

  return (
    <span className="font-mono text-xs text-zinc-600 font-medium">
      —
    </span>
  );
};

const generateFallbackLeaderboard = (acc: XpAccount): LeaderboardEntry[] => {
  const uid = acc?.userId || (acc?.profile as any)?.memberId || 'me';
  const uname = acc?.profile?.name || 'Cinephile Member';
  const avatar = acc?.profile?.avatarUrl || '';
  const xp = acc?.lifetimeXp || 1200;
  const level = acc?.currentLevel || 1;
  const watchSeconds = acc?.stats?.totalWatchSeconds || 3600;
  const streak = acc?.stats?.currentStreak || 1;

  const meEntry: LeaderboardEntry = {
    rank: 1,
    previous_rank: null,
    rank_delta: 0,
    user_id: uid,
    username: uname,
    avatar_url: avatar,
    level,
    xp,
    points: Math.round(xp / 500 + (watchSeconds / 3600) * 100 + streak * 50),
    watch_seconds: watchSeconds,
    current_streak: streak,
    streak_penalty: 0,
    unlocked_achievements_count: (acc?.unlockedAchievements || []).length,
    rank_tier: 'GOLD',
    rank_sub: 1
  };

  const sampleMembers: LeaderboardEntry[] = [
    { rank: 2, previous_rank: 2, rank_delta: 0, user_id: 'user_alex', username: 'Alex M.', avatar_url: '', level: 12, xp: 45000, points: 890, watch_seconds: 72000, current_streak: 5, rank_tier: 'SILVER', rank_sub: 2 },
    { rank: 3, previous_rank: 4, rank_delta: 1, user_id: 'user_sara', username: 'Sara K.', avatar_url: '', level: 10, xp: 38000, points: 760, watch_seconds: 54000, current_streak: 3, rank_tier: 'BRONZE', rank_sub: 1 },
    { rank: 4, previous_rank: 3, rank_delta: -1, user_id: 'user_david', username: 'David R.', avatar_url: '', level: 8, xp: 29000, points: 580, watch_seconds: 36000, current_streak: 2, rank_tier: 'BRONZE', rank_sub: 3 },
  ];

  return [meEntry, ...sampleMembers];
};

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentAccount,
  onBack
}) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for Point Breakdown Modal
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    username: string;
    avatar_url: string;
    rank: number;
    breakdown: PointBreakdownData;
  } | null>(null);

  const currentUid = currentAccount?.userId || (currentAccount?.profile as any)?.memberId;
  const currentName = currentAccount?.profile?.name || '';

  // Calculate live breakdown for the active user
  const liveMyBreakdown = useMemo(() => {
    return calculatePointBreakdown(currentAccount);
  }, [currentAccount]);

  // Load leaderboard data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const lbData = await fetchLeaderboard();
      if (lbData && Array.isArray(lbData.leaderboard) && lbData.leaderboard.length > 0) {
        setEntries(lbData.leaderboard);
      } else {
        setEntries(generateFallbackLeaderboard(currentAccount));
      }
    } catch (err: any) {
      console.warn('[Leaderboard] Load error:', err);
      setEntries(generateFallbackLeaderboard(currentAccount));
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge live user points into list to keep UI in instant sync
  const processedEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const cloned = entries.map((item) => {
      const isMe = 
        (currentUid && item.user_id === currentUid) ||
        (currentName && item.username && item.username.toLowerCase() === currentName.toLowerCase());

      if (isMe) {
        return {
          ...item,
          points: liveMyBreakdown.totalPoints,
          xp: liveMyBreakdown.xp,
          watch_seconds: liveMyBreakdown.watchSeconds,
          current_streak: liveMyBreakdown.currentStreak,
          streak_penalty: liveMyBreakdown.streakPenalty,
          unlocked_achievements_count: liveMyBreakdown.unlockedAchievementsCount
        };
      }

      const itemBreakdown = calculatePointBreakdown(item);
      return {
        ...item,
        points: itemBreakdown.totalPoints,
        xp: itemBreakdown.xp,
        watch_seconds: itemBreakdown.watchSeconds,
        current_streak: itemBreakdown.currentStreak,
        streak_penalty: itemBreakdown.streakPenalty,
        unlocked_achievements_count: itemBreakdown.unlockedAchievementsCount
      };
    });

    // Sort by points DESC
    cloned.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.xp - a.xp;
    });

    // Reassign ranks dynamically
    return cloned.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
  }, [entries, currentUid, currentName, liveMyBreakdown]);

  // Identify "Hot Climber" (highest positive rank delta)
  const hotClimber = useMemo(() => {
    if (!processedEntries || processedEntries.length === 0) return null;
    let maxDelta = 0;
    let bestUser: LeaderboardEntry | null = null;

    for (const item of processedEntries) {
      const delta = item.rank_delta ?? (
        item.previous_rank !== null && item.previous_rank !== undefined
          ? item.previous_rank - item.rank
          : 0
      );
      if (delta > maxDelta) {
        maxDelta = delta;
        bestUser = item;
      }
    }

    if (maxDelta > 0 && bestUser) {
      return {
        user: bestUser,
        delta: maxDelta
      };
    }
    return null;
  }, [processedEntries]);

  // Top 3 Podium
  const top1 = processedEntries.find(e => e.rank === 1);
  const top2 = processedEntries.find(e => e.rank === 2);
  const top3 = processedEntries.find(e => e.rank === 3);

  // Ranks 04+
  const restEntries = useMemo(() => {
    return processedEntries.filter(e => e.rank > 3);
  }, [processedEntries]);

  // Current user's entry
  const myEntry = useMemo(() => {
    return processedEntries.find(e => 
      (currentUid && e.user_id === currentUid) ||
      (currentName && e.username && e.username.toLowerCase() === currentName.toLowerCase())
    );
  }, [processedEntries, currentUid, currentName]);

  const formatRank = (rank: number) => {
    return rank < 10 ? `0${rank}` : `${rank}`;
  };

  const getAvatarUrl = (user?: { avatar_url?: string; user_id?: string; username?: string } | null) => {
    if (user?.avatar_url && typeof user.avatar_url === 'string' && user.avatar_url.trim().length > 0) {
      return user.avatar_url;
    }
    const seed = encodeURIComponent(user?.user_id || user?.username || 'cinema_user');
    return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seed}`;
  };

  const isCurrentUser = (item: { user_id?: string; username?: string }) => {
    if (currentUid && item.user_id === currentUid) return true;
    if (currentName && item.username && item.username.toLowerCase() === currentName.toLowerCase()) return true;
    return false;
  };

  const handleOpenBreakdown = (item: LeaderboardEntry) => {
    const isMe = isCurrentUser(item);
    const breakdownData = isMe ? liveMyBreakdown : calculatePointBreakdown(item);
    
    setSelectedBreakdown({
      username: item.username,
      avatar_url: getAvatarUrl(item),
      rank: item.rank,
      breakdown: breakdownData
    });
  };

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen bg-[#050505] text-[#F5F5F5] font-sans pb-28 px-4 pt-3 select-none overflow-x-hidden relative">
      
      {/* HEADER */}
      <header className="flex items-center justify-between mb-3 h-11 relative z-10">
        <button
          id="btn-leaderboard-back"
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-[#111113]/90 border border-white/5 hover:border-white/20 flex items-center justify-center text-[#F5F5F5] active:scale-95 transition backdrop-blur-sm"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2]" />
        </button>

        <h1 className="text-sm font-bold text-white tracking-[0.25em] uppercase font-mono">
          {t('leaderboard.title', undefined, 'Leaderboard')}
        </h1>

        {/* Balance spacer */}
        <div className="w-10 h-10" />
      </header>

      {/* HOT CLIMBER HIGHLIGHT (Subtle, elegant pill) */}
      {hotClimber && !isLoading && (
        <motion.div 
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#111115] border border-white/5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-400">
              {t('leaderboard.hotClimber', undefined, 'Hot Climber')}
            </span>
          </div>

          <div 
            onClick={() => handleOpenBreakdown(hotClimber.user)}
            className="flex items-center gap-2 cursor-pointer active:opacity-80"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-[#18181c] border border-white/10">
              <img 
                src={getAvatarUrl(hotClimber.user)} 
                alt={hotClimber.user.username} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-xs font-medium text-white truncate max-w-[110px]">
              {hotClimber.user.username}
            </span>
            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              ↑ {hotClimber.delta}
            </span>
          </div>
        </motion.div>
      )}

      {/* LOADING STATE */}
      {isLoading && (
        <div className="py-28 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#E2B14C] animate-spin" />
        </div>
      )}

      {/* ERROR STATE */}
      {error && !isLoading && (
        <div className="py-20 text-center">
          <p className="text-xs text-zinc-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="h-11 px-6 rounded-xl bg-[#141416] border border-white/10 text-xs font-semibold text-white active:scale-95 transition"
          >
            {t('leaderboard.retry', undefined, 'Retry')}
          </button>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && !error && processedEntries.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-28 h-28 rounded-2xl overflow-hidden mb-4 border border-white/10 opacity-70">
            <img 
              src={championArt} 
              alt="Cinema Art" 
              className="w-full h-full object-cover grayscale"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-xs text-zinc-500 font-mono tracking-wider">{t('leaderboard.noRankedMembers', undefined, 'No ranked cinema members yet')}</p>
        </div>
      )}

      {/* TOP 3 PODIUM */}
      {!isLoading && !error && processedEntries.length > 0 && (
        <section className="mb-6 relative">
          
          {/* Subtle Illustrated Cinema Theatre Backdrop */}
          <div className="absolute -top-4 -left-4 -right-4 h-64 rounded-3xl overflow-hidden pointer-events-none opacity-20">
            <img
              src={cinemaBackdrop}
              alt="Cinema Hall"
              className="w-full h-full object-cover object-top filter contrast-125"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]" />
          </div>

          <div className="relative z-10 pt-2">
            <div className="flex items-end justify-center gap-2">
              
              {/* RANK 2 (Left) */}
              {top2 ? (
                <div 
                  onClick={() => handleOpenBreakdown(top2)}
                  className="flex-1 flex flex-col items-center cursor-pointer group active:scale-[0.98] transition-transform"
                >
                  <div className="relative mb-1 flex flex-col items-center">
                    {/* Laurel Wreath */}
                    <div className="w-16 h-8 absolute -bottom-3 z-10 pointer-events-none">
                      <LaurelIllustration tier={2} />
                    </div>

                    <div className={`w-13 h-13 rounded-full p-0.5 border ${
                      isCurrentUser(top2) ? 'border-[#E2B14C] ring-2 ring-[#E2B14C]/30' : 'border-zinc-400/60'
                    } bg-[#111114] overflow-hidden shadow-md`}>
                      <img
                        src={getAvatarUrl(top2)}
                        alt={top2.username}
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="text-[11px] font-medium text-zinc-300 text-center truncate max-w-[85px] mt-1 mb-0.5">
                    {top2.username}
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    {top2.level >= 500 || top2.xp >= 5000000 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#E2B14C]/15 text-[#E2B14C] border border-[#E2B14C]/40">
                        {top2.rank_tier || 'BRONZE I'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                        Lv. {top2.level}
                      </span>
                    )}
                  </div>

                  {/* Points & Label */}
                  <div className="flex flex-col items-center mb-1.5">
                    <span className="text-xs font-mono font-bold text-white">
                      {formatPoints(top2.points)}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                      {t('leaderboard.points', undefined, 'Points')}
                    </span>
                  </div>

                  {/* Pedestal 2 */}
                  <div className="w-full h-20 rounded-t-xl bg-[#0f0f13] border-t border-x border-white/10 flex flex-col items-center justify-between py-2 relative overflow-hidden group-hover:border-zinc-400/30 transition">
                    <span className="text-sm font-mono font-bold text-zinc-400">
                      2
                    </span>
                    <MovementBadge 
                      currentRank={2} 
                      previousRank={top2.previous_rank} 
                      rankDelta={top2.rank_delta} 
                      compact
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              {/* RANK 1 (Center - Visually Dominant Champion) */}
              {top1 ? (
                <div 
                  onClick={() => handleOpenBreakdown(top1)}
                  className="flex-1 flex flex-col items-center -mt-6 cursor-pointer group active:scale-[0.98] transition-transform z-20"
                >
                  <div className="relative mb-1 flex flex-col items-center">
                    {/* Golden Laurel Wreath */}
                    <div className="w-22 h-11 absolute -bottom-4 z-10 pointer-events-none">
                      <LaurelIllustration tier={1} />
                    </div>

                    <div className={`w-17 h-17 rounded-full p-0.5 border-2 border-[#E2B14C] bg-[#141418] overflow-hidden shadow-lg shadow-[#E2B14C]/20 ${
                      isCurrentUser(top1) ? 'ring-2 ring-[#E2B14C]/50' : ''
                    }`}>
                      <img
                        src={getAvatarUrl(top1)}
                        alt={top1.username}
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="text-xs font-bold text-white text-center truncate max-w-[100px] mt-1.5 mb-0.5">
                    {top1.username}
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    {top1.level >= 500 || top1.xp >= 5000000 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#E2B14C]/15 text-[#E2B14C] border border-[#E2B14C]/40">
                        {top1.rank_tier || 'BRONZE I'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                        Lv. {top1.level}
                      </span>
                    )}
                  </div>

                  {/* Points & Label */}
                  <div className="flex flex-col items-center mb-1.5">
                    <span className="text-sm font-mono font-bold text-[#E2B14C]">
                      {formatPoints(top1.points)}
                    </span>
                    <span className="text-[9px] font-mono text-[#E2B14C]/70 uppercase tracking-wider font-semibold">
                      {t('leaderboard.points', undefined, 'Points')}
                    </span>
                  </div>

                  {/* Champion Pedestal 1 */}
                  <div className="w-full h-28 rounded-t-xl bg-[#16161c] border-t-2 border-x border-t-[#E2B14C] border-x-white/10 flex flex-col items-center justify-between py-2 relative overflow-hidden group-hover:border-t-[#E2B14C] group-hover:border-x-[#E2B14C]/30 transition shadow-inner">
                    <span className="text-base font-mono font-black text-[#E2B14C]">
                      1
                    </span>
                    <MovementBadge 
                      currentRank={1} 
                      previousRank={top1.previous_rank} 
                      rankDelta={top1.rank_delta} 
                      compact
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              {/* RANK 3 (Right) */}
              {top3 ? (
                <div 
                  onClick={() => handleOpenBreakdown(top3)}
                  className="flex-1 flex flex-col items-center cursor-pointer group active:scale-[0.98] transition-transform"
                >
                  <div className="relative mb-1 flex flex-col items-center">
                    {/* Bronze Laurel Wreath */}
                    <div className="w-16 h-8 absolute -bottom-3 z-10 pointer-events-none">
                      <LaurelIllustration tier={3} />
                    </div>

                    <div className={`w-13 h-13 rounded-full p-0.5 border ${
                      isCurrentUser(top3) ? 'border-[#E2B14C] ring-2 ring-[#E2B14C]/30' : 'border-amber-700/60'
                    } bg-[#111114] overflow-hidden shadow-md`}>
                      <img
                        src={getAvatarUrl(top3)}
                        alt={top3.username}
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="text-[11px] font-medium text-zinc-300 text-center truncate max-w-[85px] mt-1 mb-0.5">
                    {top3.username}
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    {top3.level >= 500 || top3.xp >= 5000000 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#E2B14C]/15 text-[#E2B14C] border border-[#E2B14C]/40">
                        {top3.rank_tier || 'BRONZE I'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                        Lv. {top3.level}
                      </span>
                    )}
                  </div>

                  {/* Points & Label */}
                  <div className="flex flex-col items-center mb-1.5">
                    <span className="text-xs font-mono font-bold text-white">
                      {formatPoints(top3.points)}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                      {t('leaderboard.points', undefined, 'Points')}
                    </span>
                  </div>

                  {/* Pedestal 3 */}
                  <div className="w-full h-16 rounded-t-xl bg-[#0c0c10] border-t border-x border-white/10 flex flex-col items-center justify-between py-2 relative overflow-hidden group-hover:border-amber-700/40 transition">
                    <span className="text-sm font-mono font-bold text-amber-700/80">
                      3
                    </span>
                    <MovementBadge 
                      currentRank={3} 
                      previousRank={top3.previous_rank} 
                      rankDelta={top3.rank_delta} 
                      compact
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}

            </div>
          </div>
        </section>
      )}

      {/* RANKED USERS LIST (RANKS 04+) */}
      {!isLoading && !error && restEntries.length > 0 && (
        <section className="space-y-1.5 relative z-10">
          {restEntries.map((item) => {
            const isMe = isCurrentUser(item);
            
            return (
              <div
                key={item.user_id || item.rank}
                id={`leaderboard-row-${item.rank}`}
                onClick={() => handleOpenBreakdown(item)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer active:scale-[0.99] ${
                  isMe
                    ? 'bg-[#181612] border border-[#E2B14C]/40 text-white'
                    : 'bg-[#0b0b0e] hover:bg-[#121216] border border-white/[0.04]'
                }`}
              >
                {/* Left section: Rank + Movement + Avatar + Username */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                  {/* Rank Number */}
                  <span className={`w-6 text-xs font-mono font-medium shrink-0 ${
                    isMe ? 'text-[#E2B14C] font-bold' : 'text-zinc-500'
                  }`}>
                    {formatRank(item.rank)}
                  </span>

                  {/* Dedicated Movement Column */}
                  <div className="w-7 shrink-0 flex items-center justify-start">
                    <MovementBadge 
                      currentRank={item.rank} 
                      previousRank={item.previous_rank} 
                      rankDelta={item.rank_delta} 
                    />
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border ${
                    isMe ? 'border-[#E2B14C]/70' : 'border-white/10'
                  } bg-[#141416]`}>
                    <img
                      src={getAvatarUrl(item)}
                      alt={item.username}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Username & Rank/Level */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs truncate ${
                      isMe ? 'font-semibold text-white' : 'font-normal text-zinc-200'
                    }`}>
                      {item.username} {isMe && <span className="text-[#E2B14C] text-[10px] ml-0.5">({t('leaderboard.you', undefined, 'You')})</span>}
                    </span>
                    {item.level >= 500 || item.xp >= 5000000 ? (
                      <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#E2B14C]/15 text-[#E2B14C] border border-[#E2B14C]/40">
                        {item.rank_tier || 'BRONZE I'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                        Lv. {item.level}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right section: Points */}
                <div className="flex flex-col items-end shrink-0">
                  <span className={`text-xs font-mono font-bold ${
                    isMe ? 'text-[#E2B14C]' : 'text-white'
                  }`}>
                    {formatPoints(item.points)}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* PERSONAL POSITION STICKY BOTTOM BAR */}
      {myEntry && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#050505] via-[#050505]/95 to-transparent backdrop-blur-md">
          <div 
            onClick={() => handleOpenBreakdown(myEntry)}
            className="w-full max-w-[420px] mx-auto flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#181612] border border-[#E2B14C]/50 shadow-lg cursor-pointer active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-mono font-bold text-[#E2B14C]">
                #{myEntry.rank}
              </span>

              <MovementBadge 
                currentRank={myEntry.rank} 
                previousRank={myEntry.previous_rank} 
                rankDelta={myEntry.rank_delta} 
              />

              <div className="w-7 h-7 rounded-full overflow-hidden bg-[#141416] border border-[#E2B14C]/60 shrink-0">
                <img 
                  src={getAvatarUrl(myEntry)} 
                  alt={myEntry.username} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-medium text-white truncate max-w-[110px]">
                  {myEntry.username} <span className="text-[#E2B14C] text-[10px]">({t('leaderboard.you', undefined, 'You')})</span>
                </span>
                {myEntry.level >= 500 || myEntry.xp >= 5000000 ? (
                  <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#E2B14C]/15 text-[#E2B14C] border border-[#E2B14C]/40">
                    {myEntry.rank_tier || 'BRONZE I'}
                  </span>
                ) : (
                  <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                    Lv. {myEntry.level}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-[#E2B14C]">
                {formatPoints(myEntry.points)}
              </span>
              <span className="text-[10px] font-mono text-[#E2B14C]/70 uppercase">
                {t('leaderboard.pts', undefined, 'pts')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* POINT BREAKDOWN BOTTOM SHEET MODAL */}
      <AnimatePresence>
        {selectedBreakdown && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBreakdown(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[420px] bg-[#0e0e12] border-t border-white/10 rounded-t-2xl p-5 text-white z-10 max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-[#16161a]">
                    <img 
                      src={getAvatarUrl(selectedBreakdown)} 
                      alt={selectedBreakdown.username} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {selectedBreakdown.username}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-400">
                      {t('leaderboard.rankAndBreakdown', { rank: selectedBreakdown.rank }, `Rank #${selectedBreakdown.rank} · Point Breakdown`)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBreakdown(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Breakdown List */}
              <div className="space-y-2.5 mb-5 font-mono text-xs">
                
                {/* XP Contribution */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-[#E2B14C]">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-sans font-medium text-zinc-200">{t('leaderboard.xpContribution', undefined, 'XP Contribution')}</div>
                      <div className="text-[10px] text-zinc-500">
                        {t('leaderboard.xpPointsDesc', { xp: selectedBreakdown.breakdown.xp.toLocaleString() }, `${selectedBreakdown.breakdown.xp.toLocaleString()} XP ÷ 500`)}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">
                    +{formatPoints(selectedBreakdown.breakdown.xpPoints)}
                  </span>
                </div>

                {/* Watch Time Contribution */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-sans font-medium text-zinc-200">{t('leaderboard.watchTime', undefined, 'Watch-Time')}</div>
                      <div className="text-[10px] text-zinc-500">
                        {t('leaderboard.watchPointsDesc', { hours: selectedBreakdown.breakdown.watchHours.toFixed(1) }, `${(selectedBreakdown.breakdown.watchHours).toFixed(1)} hrs × 100 pts/hr`)}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">
                    +{formatPoints(selectedBreakdown.breakdown.watchPoints)}
                  </span>
                </div>

                {/* Daily Streak Contribution */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                      <Flame className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-sans font-medium text-zinc-200">{t('leaderboard.dailyStreak', undefined, 'Daily Streak')}</div>
                      <div className="text-[10px] text-zinc-500">
                        {t('leaderboard.streakPointsDesc', { days: selectedBreakdown.breakdown.currentStreak }, `${selectedBreakdown.breakdown.currentStreak} days × 50 pts/day`)}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">
                    +{formatPoints(selectedBreakdown.breakdown.streakPoints)}
                  </span>
                </div>

                {/* Achievements Contribution */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                      <Trophy className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-sans font-medium text-zinc-200">{t('leaderboard.achievements', undefined, 'Achievements')}</div>
                      <div className="text-[10px] text-zinc-500">
                        {t('leaderboard.achievementsPointsDesc', { count: selectedBreakdown.breakdown.unlockedAchievementsCount }, `${selectedBreakdown.breakdown.unlockedAchievementsCount} unlocked × 55 pts/each`)}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">
                    +{formatPoints(selectedBreakdown.breakdown.achievementPoints)}
                  </span>
                </div>

                {/* Streak Penalty */}
                {selectedBreakdown.breakdown.streakPenalty > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-950/20 border border-rose-900/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                        <Minus className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-sans font-medium text-rose-300">{t('leaderboard.streakPenalty', undefined, 'Streak Penalty')}</div>
                        <div className="text-[10px] text-rose-400/70">
                          {t('leaderboard.streakPenaltyDesc', undefined, 'Active daily streak was lost')}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-rose-400">
                      -{formatPoints(selectedBreakdown.breakdown.streakPenalty)}
                    </span>
                  </div>
                )}

                {/* Prestige Rank Contribution (Level 500+) */}
                {selectedBreakdown.breakdown.rankPoints > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/20 border border-purple-800/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-sans font-medium text-purple-200">{t('leaderboard.prestigeRank', undefined, 'Prestige Rank')}</div>
                        <div className="text-[10px] text-purple-400/80">
                          {t('leaderboard.prestigePointsDesc', { label: selectedBreakdown.breakdown.rankLabel || 'Prestige Rank', steps: selectedBreakdown.breakdown.rankSteps }, `${selectedBreakdown.breakdown.rankLabel || 'Prestige Rank'} (${selectedBreakdown.breakdown.rankSteps} × 100 pts)`)}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-purple-300">
                      +{formatPoints(selectedBreakdown.breakdown.rankPoints)}
                    </span>
                  </div>
                )}

              </div>

              {/* Total Summary */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10 mb-5">
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-400 font-medium">
                  {t('leaderboard.totalPoints', undefined, 'Total Points')}
                </span>
                <span className="font-mono text-lg font-black text-[#E2B14C]">
                  {formatPoints(selectedBreakdown.breakdown.totalPoints)} {t('leaderboard.pts', undefined, 'pts').toUpperCase()}
                </span>
              </div>

              {/* Close CTA */}
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="w-full h-11 rounded-xl bg-[#1e1e24] hover:bg-[#25252d] border border-white/10 font-sans text-xs font-semibold text-white active:scale-95 transition"
              >
                {t('leaderboard.close', undefined, 'Close')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
