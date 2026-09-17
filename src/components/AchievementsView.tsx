import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Clock, 
  Flame, 
  Target, 
  Compass, 
  Heart, 
  Film, 
  Users, 
  Share2, 
  FileText, 
  Star, 
  Bookmark, 
  Volume2, 
  CreditCard, 
  Moon, 
  Layers, 
  Lock, 
  Check, 
  X,
  ChevronLeft,
  Calendar
} from 'lucide-react';
import { XpAccount } from '../types';
import { 
  CORE_ACHIEVEMENTS, 
  CoreAchievementDef,
  checkCoreAchievementEligibility,
  getIsoWeekString,
  generateDeterministicWeeklyChallenges,
  getWeeklyChallengeMeta
} from '../utils/achievementCatalog';
import { 
  fetchTursoAchievements, 
  unlockTursoAchievementClient,
  fetchTursoWeeklyChallenges,
  syncTursoWeeklyChallengesClient,
  updateTursoWeeklyChallengeProgressClient
} from '../utils/tursoClient';
import { awardXp, dispatchToast, subscribeToXpAccount } from '../utils/xpSystem';
import { auth } from '../firebase';
import { useTranslation } from '../i18n/LanguageContext';

interface AchievementsViewProps {
  account: XpAccount;
  onClose?: () => void;
  onOpenLeaderboard?: () => void;
}

function renderIcon(name: string, className = "w-4 h-4") {
  switch (name) {
    case 'Film': return <Film className={className} />;
    case 'Moon': return <Moon className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'Compass': return <Compass className={className} />;
    case 'Users': return <Users className={className} />;
    case 'Share2': return <Share2 className={className} />;
    case 'FileText': return <FileText className={className} />;
    case 'Star': return <Star className={className} />;
    case 'Bookmark': return <Bookmark className={className} />;
    case 'Volume2': return <Volume2 className={className} />;
    case 'CreditCard': return <CreditCard className={className} />;
    case 'Clock': return <Clock className={className} />;
    case 'Heart': return <Heart className={className} />;
    case 'Flame': return <Flame className={className} />;
    case 'Target': return <Target className={className} />;
    default: return <Trophy className={className} />;
  }
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({ account, onClose, onOpenLeaderboard }) => {
  const { t } = useTranslation();
  const [currentAccount, setCurrentAccount] = useState<XpAccount>(account);
  const [activeUid, setActiveUid] = useState<string>(
    auth.currentUser?.uid || account?.userId || (account?.profile as any)?.memberId || 'guest'
  );

  // Initialize unlocked achievements instantly from account state and eligibility checks (0ms load)
  const [unlockedAchievements, setUnlockedAchievements] = useState<Record<string, { unlockedAt: string; tier: number }>>(() => {
    const achMap: Record<string, { unlockedAt: string; tier: number }> = {};
    if (account?.unlockedAchievements) {
      account.unlockedAchievements.forEach(k => {
        achMap[k] = { unlockedAt: new Date().toISOString(), tier: 1 };
      });
    }
    CORE_ACHIEVEMENTS.forEach(ach => {
      if (checkCoreAchievementEligibility(ach.key, account).isMet) {
        achMap[ach.key] = { unlockedAt: new Date().toISOString(), tier: 1 };
      }
    });
    return achMap;
  });
  
  // Deterministically pre-populate weekly challenges immediately so they never fail to render
  const [weeklyChallenges, setWeeklyChallenges] = useState<any[]>(() => {
    const currentIsoWeek = getIsoWeekString();
    const templates = generateDeterministicWeeklyChallenges(currentIsoWeek);
    const stats = (account?.stats || {}) as any;
    return templates.map(t => {
      let calcProgress = 0;
      if (t.challengeKey === 'weekly_watch_hours') {
        calcProgress = Math.max(0, (stats.totalWatchSeconds || 0) / 3600);
      } else if (t.challengeKey === 'weekly_streak_keeper') {
        calcProgress = Number(stats.currentStreak || 0);
      } else if (t.challengeKey === 'weekly_curator') {
        calcProgress = (stats.ratedMediaIds?.length || 0) + (stats.totalLikesReceived || 0);
      } else if (t.challengeKey === 'weekly_critique') {
        calcProgress = stats.reviewsCount || 0;
      } else if (t.challengeKey === 'weekly_titles') {
        calcProgress = (stats.episodesCompleted || 0) + (stats.titlesWatched?.length || 0);
      }
      const isDone = calcProgress >= t.target;
      return {
        ...t,
        progress: calcProgress,
        completed: isDone
      };
    });
  });

  const [isLoading, setIsLoading] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<CoreAchievementDef | null>(null);

  const hasLoadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (account) {
      setCurrentAccount(account);
      // Synchronously update unlocked achievements map if account changes
      if (account.unlockedAchievements && account.unlockedAchievements.length > 0) {
        setUnlockedAchievements(prev => {
          const next = { ...prev };
          account.unlockedAchievements?.forEach(k => {
            if (!next[k]) {
              next[k] = { unlockedAt: new Date().toISOString(), tier: 1 };
            }
          });
          return next;
        });
      }
    }
    const uid = auth.currentUser?.uid || account?.userId || (account?.profile as any)?.memberId || 'guest';
    setActiveUid(uid);
  }, [account]);

  useEffect(() => {
    if (!activeUid || activeUid === 'guest') return;
    const unsub = subscribeToXpAccount((acc) => {
      setCurrentAccount(acc);
    }, activeUid);
    return () => unsub();
  }, [activeUid]);

  const loadTursoData = useCallback(async (uid: string) => {
    try {
      const currentIsoWeek = getIsoWeekString();

      // Parallel non-blocking Turso calls with fast settlement
      const [achievementsResult, challengesResult] = await Promise.allSettled([
        fetchTursoAchievements(uid),
        fetchTursoWeeklyChallenges(currentIsoWeek, uid)
      ]);

      if (achievementsResult.status === 'fulfilled' && Array.isArray(achievementsResult.value)) {
        const achMap: Record<string, { unlockedAt: string; tier: number }> = {};
        achievementsResult.value.forEach(a => {
          achMap[a.achievementKey] = {
            unlockedAt: a.unlockedAt,
            tier: a.tier || 1
          };
        });

        if (currentAccount?.unlockedAchievements) {
          currentAccount.unlockedAchievements.forEach(k => {
            if (!achMap[k]) {
              achMap[k] = { unlockedAt: new Date().toISOString(), tier: 1 };
            }
          });
        }
        setUnlockedAchievements(prev => ({ ...prev, ...achMap }));
      }

      let remoteChallenges: any[] = [];
      if (challengesResult.status === 'fulfilled' && challengesResult.value && challengesResult.value.length > 0) {
        remoteChallenges = challengesResult.value;
      }

      if (remoteChallenges.length > 0) {
        const hydratedChallenges = remoteChallenges.map(c => {
          const meta = getWeeklyChallengeMeta(c);
          return {
            ...c,
            title: c.title || meta.title,
            description: c.description || meta.description,
            iconName: c.iconName || meta.iconName,
          };
        });
        setWeeklyChallenges(hydratedChallenges);
      }
    } catch (err) {
      console.warn('[AchievementsView] Non-blocking data sync notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount?.unlockedAchievements]);

  useEffect(() => {
    if (hasLoadedUidRef.current === activeUid) return;
    hasLoadedUidRef.current = activeUid;
    loadTursoData(activeUid);
  }, [activeUid, loadTursoData]);

  const stats: Record<string, any> = (currentAccount?.stats || {}) as any;

  // Single-run sync for weekly challenge increments (guarded against re-trigger loops)
  const isSyncingChallengesRef = useRef(false);
  useEffect(() => {
    if (isLoading || weeklyChallenges.length === 0 || isSyncingChallengesRef.current) return;
    const currentIsoWeek = getIsoWeekString();

    const pending = weeklyChallenges.filter(wc => !wc.completed);
    if (pending.length === 0) return;

    isSyncingChallengesRef.current = true;
    (async () => {
      try {
        for (const wc of pending) {
          let calculatedValue = 0;
          if (wc.challengeKey === 'weekly_watch_hours') {
            calculatedValue = Math.max(0, (stats.totalWatchSeconds || 0) / 3600);
          } else if (wc.challengeKey === 'weekly_streak_keeper') {
            calculatedValue = Number(stats.currentStreak || 0);
          } else if (wc.challengeKey === 'weekly_curator') {
            calculatedValue = (stats.ratedMediaIds?.length || 0) + (stats.totalLikesReceived || 0);
          } else if (wc.challengeKey === 'weekly_critique') {
            calculatedValue = stats.reviewsCount || 0;
          } else if (wc.challengeKey === 'weekly_titles') {
            calculatedValue = (stats.episodesCompleted || 0) + (stats.titlesWatched?.length || 0);
          }

          if (calculatedValue > (wc.progress || 0)) {
            const updateRes = await updateTursoWeeklyChallengeProgressClient(
              currentIsoWeek,
              wc.challengeKey,
              undefined,
              calculatedValue,
              activeUid
            );

            if (updateRes.success && updateRes.challenge) {
              const meta = getWeeklyChallengeMeta(updateRes.challenge);
              const hydrated = {
                ...updateRes.challenge,
                title: updateRes.challenge.title || meta.title,
                description: updateRes.challenge.description || meta.description,
                iconName: updateRes.challenge.iconName || meta.iconName
              };

              setWeeklyChallenges(prev => prev.map(item => 
                item.challengeKey === wc.challengeKey ? hydrated : item
              ));

              if (updateRes.newlyCompleted) {
                await awardXp(`Weekly Challenge: ${hydrated.title}`, hydrated.xpReward, 'bonus', { challengeKey: wc.challengeKey });
                dispatchToast({
                  title: t('achievements.weeklyChallengeCompleted', undefined, 'Weekly Challenge Completed'),
                  description: hydrated.title,
                  type: 'achievement'
                });
              }
            }
          }
        }
      } finally {
        isSyncingChallengesRef.current = false;
      }
    })();
  }, [isLoading, stats, activeUid]);

  const orderedAchievements = useMemo(() => {
    return [...CORE_ACHIEVEMENTS].sort((a, b) => {
      const aUnlocked = Boolean(unlockedAchievements[a.key]);
      const bUnlocked = Boolean(unlockedAchievements[b.key]);
      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;

      const { progress: aProg } = checkCoreAchievementEligibility(a.key, currentAccount);
      const { progress: bProg } = checkCoreAchievementEligibility(b.key, currentAccount);
      const aInProg = !aUnlocked && aProg > 0;
      const bInProg = !bUnlocked && bProg > 0;
      if (aInProg && !bInProg) return -1;
      if (!aInProg && bInProg) return 1;

      return 0;
    });
  }, [unlockedAchievements, currentAccount]);

  const unlockedCount = Object.keys(unlockedAchievements).length;
  const totalCoreCount = CORE_ACHIEVEMENTS.length;
  const completionPercentage = totalCoreCount > 0 ? Math.min(100, Math.round((unlockedCount / totalCoreCount) * 100)) : 0;

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen bg-[#050505] text-[#F5F5F5] font-sans pb-28 px-4 pt-3 select-none overflow-x-hidden">
      
      {/* HEADER: Minimal with ONE navigation button to Leaderboard */}
      <header className="flex items-center justify-between mb-5 h-11">
        {onClose ? (
          <button
            onClick={onClose}
            aria-label={t('common.back', undefined, 'Back')}
            className="w-10 h-10 rounded-xl bg-[#111113] border border-white/5 hover:border-white/20 flex items-center justify-center text-[#F5F5F5] active:scale-95 transition"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2]" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}

        <h1 className="text-sm font-bold text-white tracking-[0.25em] uppercase font-mono">
          {t('achievements.title', undefined, 'Achievements')}
        </h1>

        {/* The ONLY navigation button to Leaderboard */}
        {onOpenLeaderboard ? (
          <button
            id="btn-achievements-to-leaderboard"
            onClick={onOpenLeaderboard}
            aria-label={t('common.leaderboard', undefined, 'Leaderboard')}
            className="w-10 h-10 rounded-xl bg-[#111113] border border-white/5 hover:border-[#E2B14C]/40 flex items-center justify-center text-[#E2B14C] active:scale-95 transition"
          >
            <Trophy className="w-4 h-4 stroke-[2]" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </header>

      {/* OVERALL PROGRESS SUMMARY */}
      <div className="mb-7 bg-[#0b0b0e] p-3.5 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
          <span className="text-zinc-300 font-medium">{t('achievements.unlockedProgress', { count: unlockedCount, total: totalCoreCount }, `${unlockedCount} of ${totalCoreCount} Unlocked`)}</span>
          <span className="text-[#E2B14C] font-bold">{completionPercentage}%</span>
        </div>
        <div className="w-full h-1.5 bg-[#15151a] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-[#E2B14C] rounded-full"
          />
        </div>
      </div>

      {/* SECTION 1: WEEKLY CHALLENGES (Clearly Separated) */}
      {weeklyChallenges.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#E2B14C]" />
              <h2 className="text-xs font-bold text-white tracking-widest uppercase font-mono">
                {t('achievements.weeklyChallenges', undefined, 'Weekly Challenges')}
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {t('achievements.resetsMonday', undefined, 'Resets Mon')}
            </span>
          </div>

          <div className="space-y-2">
            {weeklyChallenges.map((challenge) => {
              const meta = getWeeklyChallengeMeta(challenge);
              const title = t(`achievements.challenges.${challenge.challengeKey}.title`, undefined, challenge.title || meta.title);
              const target = Number(challenge.target || 1);
              const description = t(`achievements.challenges.${challenge.challengeKey}.description`, { target }, challenge.description || meta.description);
              const progress = Number(challenge.progress || 0);
              const isDone = Boolean(challenge.completed);
              const percent = Math.min(100, Math.floor((progress / target) * 100));

              return (
                <div
                  key={challenge.challengeKey}
                  className={`p-3.5 rounded-2xl border transition-colors ${
                    isDone 
                      ? 'bg-[#0b100d] border-emerald-500/20' 
                      : 'bg-[#0a0a0d] border-white/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isDone 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-[#141418] text-[#E2B14C] border border-white/5'
                    }`}>
                      {isDone ? <Check className="w-4 h-4 stroke-[2.5]" /> : renderIcon(challenge.iconName || meta.iconName, "w-4 h-4")}
                    </div>

                    {/* Content: Title & What to do */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-xs font-semibold text-white truncate">
                          {title}
                        </h3>
                        <span className={`text-[11px] font-mono font-bold shrink-0 ${
                          isDone ? 'text-emerald-400' : 'text-zinc-400'
                        }`}>
                          {isDone ? t('achievements.completed', undefined, 'Completed') : `${Math.min(target, Math.round(progress * 10) / 10)} / ${target}`}
                        </span>
                      </div>

                      {/* What to do instruction */}
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
                        {description}
                      </p>

                      {/* Progress Bar */}
                      {!isDone && (
                        <div className="w-full h-1 bg-[#15151a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E2B14C] rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2: PERMANENT MILESTONES (Clearly Separated) */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-[#E2B14C]" />
            <h2 className="text-xs font-bold text-white tracking-widest uppercase font-mono">
              {t('achievements.milestones', undefined, 'Milestones')}
            </h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {unlockedCount}/{totalCoreCount}
          </span>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {orderedAchievements.map((ach) => {
              const isUnlocked = Boolean(unlockedAchievements[ach.key]);
              const { progress, target } = checkCoreAchievementEligibility(ach.key, currentAccount);
              const percent = Math.min(100, Math.floor((progress / target) * 100));
              
              const localizedTitle = t(`achievements.definitions.${ach.key}.title`, undefined, ach.title);
              const localizedCriteria = t(`achievements.definitions.${ach.key}.criteria`, undefined, ach.criteria);
              const localizedDesc = t(`achievements.definitions.${ach.key}.description`, undefined, ach.description);

              return (
                <motion.div
                  layout
                  key={ach.key}
                  onClick={() => setSelectedAchievement(ach)}
                  className={`p-3.5 rounded-2xl border transition-colors cursor-pointer active:scale-[0.99] ${
                    isUnlocked
                      ? 'bg-[#0e0e13] border-[#E2B14C]/30'
                      : 'bg-[#08080a] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isUnlocked 
                        ? 'bg-[#E2B14C] text-black shadow-md shadow-[#E2B14C]/10' 
                        : 'bg-[#121215] text-zinc-600 border border-white/5'
                    }`}>
                      {isUnlocked ? renderIcon(ach.iconName, "w-4 h-4") : <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Content: Title & What the user has to do */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className={`text-xs font-semibold truncate ${
                          isUnlocked ? 'text-white' : 'text-zinc-300'
                        }`}>
                          {localizedTitle}
                        </h3>

                        {isUnlocked ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-[#E2B14C] font-semibold shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>{t('achievements.unlocked', undefined, 'Unlocked')}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                            {progress} / {target}
                          </span>
                        )}
                      </div>

                      {/* Explicit Instruction: What the user has to do */}
                      <p className="text-[11px] leading-relaxed mb-2.5 text-zinc-400">
                        {isUnlocked ? localizedDesc : localizedCriteria}
                      </p>

                      {/* In-Progress Bar */}
                      {!isUnlocked && (
                        <div className="w-full h-1 bg-[#141418] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-600 rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedAchievement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xs bg-[#101014] border border-white/10 rounded-2xl p-5 relative shadow-2xl"
            >
              <button
                onClick={() => setSelectedAchievement(null)}
                aria-label={t('common.close', undefined, 'Close')}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-[#181820] text-[#E2B14C] border border-white/5">
                {renderIcon(selectedAchievement.iconName, "w-6 h-6")}
              </div>

              <h3 className="text-sm font-bold text-white mb-1.5">
                {t(`achievements.definitions.${selectedAchievement.key}.title`, undefined, selectedAchievement.title)}
              </h3>

              <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                {t(`achievements.definitions.${selectedAchievement.key}.description`, undefined, selectedAchievement.description)}
              </p>

              {/* Explicit task requirement block */}
              <div className="p-3 rounded-xl bg-black/50 border border-white/5 text-xs text-zinc-300 font-mono mb-5">
                <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">
                  {t('achievements.requirement', undefined, 'Requirement')}
                </span>
                {t(`achievements.definitions.${selectedAchievement.key}.criteria`, undefined, selectedAchievement.criteria)}
              </div>

              <button
                onClick={() => setSelectedAchievement(null)}
                className="w-full h-11 rounded-xl bg-[#1c1c24] hover:bg-[#24242e] text-white text-xs font-semibold active:scale-98 transition"
              >
                {t('achievements.done', undefined, 'Done')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
