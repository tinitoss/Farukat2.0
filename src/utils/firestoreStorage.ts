import { XpAccount } from '../types';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { isQuotaError, isQuotaExceeded, markQuotaExceeded } from './quotaHelper';
import {
  getTursoProfile,
  updateTursoProfile,
  getTursoXp,
  awardTursoXp
} from './tursoClient';

/**
 * Load User Account from Turso Cloud Database with LocalStorage Fallback
 */
export async function loadUserAccountFromCloud(userId: string): Promise<XpAccount | null> {
  if (!userId || userId === 'guest') return null;

  // 1. LocalStorage cached copy for instant load
  let cachedAcc: XpAccount | null = null;
  try {
    const cached = localStorage.getItem(`farukat_xp_account_${userId}`);
    if (cached) {
      cachedAcc = JSON.parse(cached) as XpAccount;
    }
  } catch (e) {
    console.warn('Local storage cache load notice:', e);
  }

  // 2. Fetch fresh profile and XP from Turso
  try {
    const [profileRes, xpRes] = await Promise.allSettled([
      getTursoProfile(),
      getTursoXp()
    ]);

    const profileData = profileRes.status === 'fulfilled' ? profileRes.value.profile : null;
    const xpData = xpRes.status === 'fulfilled' ? xpRes.value : null;

    if (profileData || xpData) {
      const mergedAcc: XpAccount = cachedAcc || {
        currentXp: 0,
        lifetimeXp: 0,
        currentLevel: 1,
        xpSpentTotal: 0,
        profile: {
          name: 'Cinema Member',
          email: '',
          avatarUrl: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer',
          memberId: `FK-${userId.slice(0, 4).toUpperCase()}-PASS`,
          cardNumber: `FK-${userId.slice(0, 4).toUpperCase()}-2002`,
          memberSince: 'Sep 2026',
          tier: 'BRONZE',
          cardTheme: 'ivory-gold',
          status: 'Active',
          discoverableByCardNumber: true,
          isPublicProfile: true,
          isProMember: false,
          isPro: false,
          bio: 'FARUKAT Cinema Member',
          cardHistory: []
        },
        stats: {
          totalWatchSeconds: 0,
          totalWatchMinutes: 0,
          totalWatchHours: 0,
          titlesWatched: [],
          episodesCompleted: 0,
          ratingsGiven: 0,
          watchlistCount: 0,
          downloadsCount: 0,
          dailyLoginDates: profileData?.last_active_date ? [String(profileData.last_active_date)] : [],
          currentStreak: profileData?.current_streak ? Number(profileData.current_streak) : 0,
          lastLoginDate: profileData?.last_active_date ? String(profileData.last_active_date) : undefined,
          lastActiveDate: profileData?.last_active_date ? String(profileData.last_active_date) : undefined,
          profileCompleted: false,
          sharesCount: 0,
          ratedMediaIds: [],
          watchlistMediaIds: [],
          dailyWatchXpDate: new Date().toISOString().split('T')[0],
          dailyWatchXpEarned: 0
        },
        transactions: []
      };

      if (profileData) {
        mergedAcc.profile.name = profileData.username || mergedAcc.profile.name;
        mergedAcc.profile.avatarUrl = profileData.avatar || mergedAcc.profile.avatarUrl;
        mergedAcc.profile.tier = profileData.tier || mergedAcc.profile.tier;
        mergedAcc.profile.isProMember = !!profileData.pro_member;
        mergedAcc.profile.isPro = !!profileData.pro_member;
        if (profileData.card_theme) {
          mergedAcc.profile.cardTheme = profileData.card_theme;
        }
        if (profileData.card_number) {
          mergedAcc.profile.cardNumber = profileData.card_number;
        }
        if (profileData.bio) {
          mergedAcc.profile.bio = profileData.bio;
        }
        if (profileData.signature_url) {
          mergedAcc.profile.signatureUrl = profileData.signature_url;
        }
        if (profileData.member_since) {
          mergedAcc.profile.memberSince = profileData.member_since;
        }
      }

      if (xpData) {
        mergedAcc.currentXp = xpData.xp ?? mergedAcc.currentXp;
        mergedAcc.lifetimeXp = xpData.xp ?? mergedAcc.lifetimeXp;
        mergedAcc.currentLevel = xpData.level ?? mergedAcc.currentLevel;
        if (Array.isArray(xpData.transactions)) {
          mergedAcc.transactions = xpData.transactions.map((tx: any) => ({
            id: tx.id,
            title: tx.action,
            amount: tx.amount,
            type: tx.amount >= 0 ? 'earned' : 'spent',
            timestamp: new Date(tx.createdAt).getTime() || Date.now(),
            date: tx.createdAt
          }));
        }
      }

      try {
        localStorage.setItem(`farukat_xp_account_${userId}`, JSON.stringify(mergedAcc));
      } catch {}

      return mergedAcc;
    }
  } catch (err) {
    console.warn('[Turso Cloud Storage] Failed to load from Turso:', err);
  }

  return cachedAcc;
}

/**
 * Save User Account state to Turso Cloud Database and Firestore
 */
export async function saveUserAccountToCloud(userId: string, account: XpAccount): Promise<void> {
  if (!userId || userId === 'guest' || !account) return;

  // 1. Optimistic Local Cache update
  try {
    localStorage.setItem(`farukat_xp_account_${userId}`, JSON.stringify(account));
  } catch (e) {
    console.warn('Local storage cache save failed:', e);
  }

  // 2. Persist comprehensive profile & theme updates to Turso
  try {
    if (account.profile) {
      await updateTursoProfile({
        explicitUserId: userId,
        username: account.profile.name,
        avatar: account.profile.avatarUrl,
        cardTheme: account.profile.cardTheme,
        cardNumber: account.profile.cardNumber,
        bio: account.profile.bio,
        signatureUrl: account.profile.signatureUrl,
        memberSince: account.profile.memberSince,
        tier: account.profile.tier,
        proMember: account.profile.tier === 'DIAMOND' || (account.currentLevel || 1) >= 8,
        accountData: {
          currentLevel: account.currentLevel,
          lifetimeXp: account.lifetimeXp,
          theme: account.profile.cardTheme
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Turso Cloud Storage] Failed to sync profile to Turso:', err);
  }

  // 3. Persist to Firestore (required for syncCommunityWithBackend)
  if (!isQuotaExceeded()) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, account, { merge: true });
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded(err);
      }
      console.warn('[Firestore] Failed to sync account to Firestore:', err);
    }
  }
}

/**
 * Helper to save user data tables (watchlists, ratings, etc.) to LocalStorage
 */
export async function saveUserDataTable(tableName: string, userId: string, data: any): Promise<void> {
  if (!userId || userId === 'guest') return;
  try {
    localStorage.setItem(`farukat_${tableName}_${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn(`[LocalStorage] Failed to save table ${tableName}:`, err);
  }
}

/**
 * Helper to load user data tables from LocalStorage
 */
export async function loadUserDataTable(tableName: string, userId: string, defaultVal: any = null): Promise<any | null> {
  if (!userId || userId === 'guest') return defaultVal;
  try {
    const raw = localStorage.getItem(`farukat_${tableName}_${userId}`);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (err) {
    console.warn(`[LocalStorage] Failed to load table ${tableName}:`, err);
    return defaultVal;
  }
}

