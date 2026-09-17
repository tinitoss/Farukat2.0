import { getXpAccount, checkIsPro, awardXp } from './xpSystem';

// Local storage key for rewards state
const REWARD_STATE_KEY = 'fpx_reward_state';

export interface RewardState {
  lastLoginDate: string | null;
  loginStreak: number;
  totalWatchSeconds: number;
  unclaimedWatchSeconds: number;
  milestones: Record<string, boolean>;
  history: RewardHistoryItem[];
}

export interface RewardHistoryItem {
  id: string;
  type: 'LOGIN' | 'WATCH' | 'MILESTONE';
  title: string;
  amount: number;
  timestamp: number;
}

export const MILESTONES = {
  FIRST_SALE: { id: 'FIRST_SALE', title: 'First Watched Series', amount: 100 },
  HOLD_3_ASSETS: { id: 'HOLD_3_ASSETS', title: 'Completed 3 Episodes', amount: 150 },
  PORTFOLIO_PROFIT_10: { id: 'PORTFOLIO_PROFIT_10', title: '10 Episode Milestone', amount: 200 }
};

export class RewardService {
  private static getState(userId: string): RewardState {
    const defaultState: RewardState = {
      lastLoginDate: null,
      loginStreak: 0,
      totalWatchSeconds: 0,
      unclaimedWatchSeconds: 0,
      milestones: {},
      history: []
    };
    try {
      const raw = localStorage.getItem(`${REWARD_STATE_KEY}_${userId}`);
      if (raw) {
        return { ...defaultState, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn("Failed to parse reward state", e);
    }
    return defaultState;
  }

  private static saveState(userId: string, state: RewardState) {
    try {
      localStorage.setItem(`${REWARD_STATE_KEY}_${userId}`, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save reward state", e);
    }
  }

  private static addHistory(state: RewardState, item: Omit<RewardHistoryItem, 'id' | 'timestamp'>) {
    state.history.unshift({
      ...item,
      id: `rew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    });
    // Keep history bounded
    if (state.history.length > 50) {
      state.history = state.history.slice(0, 50);
    }
  }

  public static async processDailyLogin(userId: string) {
    if (!userId || userId === 'guest') return null;
    
    const state = this.getState(userId);
    const today = new Date().toISOString().split('T')[0];
    
    if (state.lastLoginDate === today) {
      return null; // Already claimed today
    }
    
    let isConsecutive = false;
    if (state.lastLoginDate) {
      const lastDate = new Date(state.lastLoginDate);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        isConsecutive = true;
      }
    }
    
    const isProUser = checkIsPro(getXpAccount(userId));

    if (isConsecutive) {
      state.loginStreak += 1;
    } else if (isProUser && state.loginStreak > 1) {
      // PRO Streak Guard: Preserve streak if PRO member missed a day!
      state.loginStreak = state.loginStreak;
    } else {
      state.loginStreak = 1;
    }
    
    state.lastLoginDate = today;
    
    // Multiplier max 3x (e.g. up to 150 XP base)
    const multiplier = Math.min(state.loginStreak, 3);
    const baseReward = 50 * multiplier;
    const rewardAmount = isProUser ? baseReward * 2 : baseReward;
    const rewardTitle = `Daily Login (Streak: ${state.loginStreak})${isProUser ? ' [2X PRO & Streak Guard Active]' : ''}`;
    
    this.addHistory(state, {
      type: 'LOGIN',
      title: rewardTitle,
      amount: rewardAmount
    });
    
    this.saveState(userId, state);
    
    // Award XP
    await awardXp(rewardTitle, rewardAmount, 'bonus', { streak: state.loginStreak });
    
    return rewardAmount;
  }

  public static async addWatchTime(userId: string, seconds: number) {
    if (!userId || userId === 'guest') return 0;
    
    const state = this.getState(userId);
    state.totalWatchSeconds += seconds;
    state.unclaimedWatchSeconds += seconds;
    
    let totalAwarded = 0;
    // 5 minutes = 300 seconds
    while (state.unclaimedWatchSeconds >= 300) {
      state.unclaimedWatchSeconds -= 300;
      totalAwarded += 10;
    }
    
    if (totalAwarded > 0) {
      this.addHistory(state, {
        type: 'WATCH',
        title: 'Watch Time XP Reward',
        amount: totalAwarded
      });
      
      this.saveState(userId, state);
      
      await awardXp('Watch Time XP Reward', totalAwarded, 'watch_time');
    } else {
      this.saveState(userId, state);
    }
    
    return totalAwarded;
  }

  public static async checkMilestone(userId: string, milestoneKey: keyof typeof MILESTONES) {
    if (!userId || userId === 'guest') return null;
    
    const state = this.getState(userId);
    const milestone = MILESTONES[milestoneKey];
    
    if (!milestone) return null;
    if (state.milestones[milestone.id]) return null; // Already achieved
    
    state.milestones[milestone.id] = true;
    
    this.addHistory(state, {
      type: 'MILESTONE',
      title: `Milestone: ${milestone.title}`,
      amount: milestone.amount
    });
    
    this.saveState(userId, state);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('milestone_updated', { detail: { userId, state } }));
    }
    
    await awardXp(`Milestone: ${milestone.title}`, milestone.amount, 'bonus');
    
    return milestone;
  }
  
  public static getDashboardData(userId: string): RewardState {
    return this.getState(userId);
  }
}
