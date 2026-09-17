import { XpAccount } from '../types';
import { auth } from '../firebase';
import {
  CORE_ACHIEVEMENTS,
  CoreAchievementDef,
  evaluateAndUnlockAchievements,
  checkCoreAchievementEligibility
} from './achievementCatalog';
import {
  fetchTursoAchievements,
  unlockTursoAchievementClient
} from './tursoClient';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'watching' | 'reviews' | 'collections' | 'publishing' | 'community' | 'milestones';
  requirement: number;
  xpReward: number;
  iconName?: string;
}

// Re-export core catalog
export { CORE_ACHIEVEMENTS } from './achievementCatalog';

export const ACHIEVEMENTS: Achievement[] = CORE_ACHIEVEMENTS.map(c => ({
  id: c.key,
  title: c.title,
  description: c.description,
  category: (c.category === 'viewing' ? 'watching' : c.category === 'curation' ? 'collections' : 'community') as any,
  requirement: 1,
  xpReward: c.xpReward,
  iconName: c.iconName
}));

export const getAchievementProgress = (achievementId: string, account: XpAccount): { current: number; requirement: number; percent: number } => {
  const result = checkCoreAchievementEligibility(achievementId, account);
  const percent = Math.min(100, Math.floor((result.progress / Math.max(1, result.target)) * 100));
  return {
    current: result.progress,
    requirement: result.target,
    percent
  };
};

export const evaluateAchievements = async (account: XpAccount): Promise<{ unlocked: any[] }> => {
  const uid = account.userId || auth.currentUser?.uid || (account.profile as any)?.memberId;
  if (!uid || uid === 'guest') return { unlocked: [] };

  try {
    // 1. Fetch permanent unlocked achievements from Turso
    const tursoList = await fetchTursoAchievements(uid);
    const existingUnlockedKeys = new Set<string>([
      ...(account.unlockedAchievements || []),
      ...tursoList.map(a => a.achievementKey)
    ]);

    // 2. Evaluate and unlock new achievements
    const newlyUnlockedDefs = await evaluateAndUnlockAchievements(account, Array.from(existingUnlockedKeys));

    // 3. Update account locally
    account.unlockedAchievements = Array.from(existingUnlockedKeys);

    return { unlocked: newlyUnlockedDefs };
  } catch (err) {
    console.warn('[Achievement System] Evaluation warning:', err);
    return { unlocked: [] };
  }
};
