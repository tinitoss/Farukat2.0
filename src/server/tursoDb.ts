import { createClient, Client } from '@libsql/client';
import { getLevelTitle } from '../utils/levelTitles';
import { calculateRankInfo } from '../utils/rankSystem';

const rawUrl = process.env.TURSO_DATABASE_URL || process.env.STORAGE_URL || process.env.DATABASE_URL || process.env.LIBSQL_URL || "libsql://database-bole-fountain-vercel-icfg-wtfhxgjjiy9lmfiuh8gfv964.aws-us-east-1.turso.io";
const rawToken = process.env.TURSO_AUTH_TOKEN || process.env.STORAGE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk2NzIzMDYsImlkIjoiMDFhMGFmZGYtZTkwMS03ZWE0LTk0MmYtZGIzNzdlMGU5NzAwIiwia2lkIjoiSS12NFl1YVl2YmpkZUFSQUgyNHpSSE1SdkZvbGNYZ08tVVdpODdneEpwSSIsInJpZCI6IjlhOTdhNzQ3LTQwYWUtNDZkMy1iN2M4LWU2ZmYwN2E4NTFkZCJ9.smbyj94XyW6Ope6EdhfxIe2a8Tg3Y_c5KEZymuwySVumMazh5rHi2iZtGSFbTmCVWHxDSKjjOHPLldanhBOfDw";

const TURSO_AUTH_TOKEN = rawToken.trim().replace(/^["']|["']$/g, '');
let cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
// Use https:// for remote Turso on serverless / Vercel to avoid WebSocket connection drops
if (cleanUrl.startsWith('libsql://')) {
  cleanUrl = cleanUrl.replace('libsql://', 'https://');
}
const TURSO_URL = cleanUrl;

const localDbPath = process.env.VERCEL || process.env.NETLIFY ? "file:/tmp/local_turso.db" : "file:local_turso.db";

let tursoClient: Client | null = null;
let isUsingLocalFallback = false;

export function getTursoClient(): Client {
  if (!tursoClient) {
    const hasToken = Boolean(TURSO_AUTH_TOKEN && TURSO_AUTH_TOKEN.trim().length > 0);
    const targetUrl = hasToken ? TURSO_URL : localDbPath;

    if (!hasToken) {
      isUsingLocalFallback = true;
      console.log(`[Turso DB] TURSO_AUTH_TOKEN is not configured. Falling back to local SQLite database (${localDbPath})...`);
    } else {
      console.log(`[Turso DB] Initializing connection to ${TURSO_URL}...`);
    }

    try {
      tursoClient = createClient({
        url: targetUrl,
        authToken: hasToken ? TURSO_AUTH_TOKEN : undefined,
      });
    } catch (err) {
      console.warn(`[Turso DB] Failed to create client for ${targetUrl}, switching to ${localDbPath}:`, err);
      tursoClient = createClient({ url: localDbPath });
      isUsingLocalFallback = true;
    }
  }
  return tursoClient;
}

export function switchToLocalFallback(): Client {
  if (!isUsingLocalFallback) {
    console.warn(`[Turso DB] Remote database authorization failed (401). Switching to local SQLite database (${localDbPath})...`);
    tursoClient = createClient({ url: localDbPath });
    isUsingLocalFallback = true;
    initTursoTables().catch(err => console.error('[Turso DB] Fallback schema init notice:', err));
  }
  return tursoClient!;
}

export async function executeWithTursoFallback<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  let client = getTursoClient();
  try {
    return await fn(client);
  } catch (err: any) {
    if (!isUsingLocalFallback && err?.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('SERVER_ERROR'))) {
      client = switchToLocalFallback();
      return await fn(client);
    }
    throw err;
  }
}

/**
 * Initialize all database tables, relationships, unique constraints, and indexes
 */
export async function initTursoTables(): Promise<boolean> {
  return executeWithTursoFallback(async (client) => {
    try {
      // Execute DDL statements sequentially or in batch
      await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        avatar TEXT,
        tier TEXT DEFAULT 'BRONZE',
        pro_member INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        current_streak INTEGER DEFAULT 0,
        last_active_date TEXT,
        longest_streak INTEGER DEFAULT 0,
        streak_milestones_claimed TEXT DEFAULT '[]',
        total_watch_seconds REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_xp (
        user_id TEXT PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
      );

      CREATE TABLE IF NOT EXISTS xp_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reference_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_xp_tx_user_created ON xp_transactions(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS likes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
      );

      CREATE INDEX IF NOT EXISTS idx_likes_content ON likes(content_id);
      CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT NOT NULL,
        text TEXT NOT NULL,
        parent_comment_id TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_comments_content_created ON comments(content_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

      CREATE TABLE IF NOT EXISTS comment_likes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        comment_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, comment_id)
      );

      CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
      CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

      CREATE TABLE IF NOT EXISTS watch_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        progress_seconds INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        last_watched_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
      );

      CREATE INDEX IF NOT EXISTS idx_watch_user_content ON watch_progress(user_id, content_id);

      CREATE TABLE IF NOT EXISTS watch_rewards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        milestone TEXT NOT NULL,
        xp_awarded INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id, milestone)
      );

      CREATE INDEX IF NOT EXISTS idx_rewards_user ON watch_rewards(user_id);

      CREATE TABLE IF NOT EXISTS media_catalog_state (
        id TEXT PRIMARY KEY DEFAULT 'global',
        custom_videos TEXT DEFAULT '[]',
        hidden_ids TEXT DEFAULT '[]',
        deleted_ids TEXT DEFAULT '[]',
        new_ids TEXT DEFAULT '[]',
        removed_new_ids TEXT DEFAULT '[]',
        hero_settings TEXT DEFAULT '[]',
        custom_sections TEXT DEFAULT '[]',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referrer_user_id TEXT NOT NULL,
        referee_user_id TEXT NOT NULL,
        referral_code_used TEXT NOT NULL,
        xp_awarded_referrer INTEGER DEFAULT 500,
        xp_awarded_referee INTEGER DEFAULT 500,
        friend_theme_awarded_referrer INTEGER DEFAULT 0,
        friend_theme_awarded_referee INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(referee_user_id)
      );

      CREATE TABLE IF NOT EXISTS unlocked_themes (
        user_id TEXT NOT NULL,
        theme_name TEXT NOT NULL,
        unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        unlock_source TEXT DEFAULT 'level',
        PRIMARY KEY(user_id, theme_name)
      );

      CREATE TABLE IF NOT EXISTS referral_flags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        flagged_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        user_id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS watch_party_rooms (
        party_id TEXT PRIMARY KEY,
        host_uid TEXT NOT NULL,
        media_id TEXT NOT NULL,
        media_title TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        room_code TEXT,
        started_at INTEGER,
        is_playing INTEGER DEFAULT 0,
        last_state_change_at INTEGER,
        total_paused_duration REAL DEFAULT 0,
        current_position REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_watch_rooms_code ON watch_party_rooms(room_code);
      CREATE INDEX IF NOT EXISTS idx_watch_rooms_status ON watch_party_rooms(status);

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        achievement_key TEXT NOT NULL,
        unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        tier INTEGER DEFAULT 1,
        UNIQUE(user_id, achievement_key)
      );

      CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

      CREATE TABLE IF NOT EXISTS user_tier_progress (
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        current_tier INTEGER DEFAULT 1,
        progress_value REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, category)
      );

      CREATE INDEX IF NOT EXISTS idx_tier_progress_user ON user_tier_progress(user_id);

      CREATE TABLE IF NOT EXISTS weekly_challenges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        iso_week TEXT NOT NULL,
        challenge_key TEXT NOT NULL,
        target REAL NOT NULL,
        progress REAL DEFAULT 0,
        completed INTEGER DEFAULT 0,
        xp_reward INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        UNIQUE(user_id, iso_week, challenge_key)
      );

      CREATE INDEX IF NOT EXISTS idx_weekly_user_week ON weekly_challenges(user_id, iso_week);

      CREATE TABLE IF NOT EXISTS in_app_notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        priority TEXT DEFAULT 'NORMAL',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        action_payload TEXT DEFAULT '{}',
        group_key TEXT,
        image_url TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        read_at TEXT,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON in_app_notifications(user_id, is_read, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_group ON in_app_notifications(user_id, group_key);

      CREATE TABLE IF NOT EXISTS leaderboard_cache (
        rank INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar_url TEXT,
        level INTEGER NOT NULL,
        xp INTEGER NOT NULL,
        rank_tier TEXT NOT NULL,
        rank_sub INTEGER,
        computed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_cache(rank);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_xp_xp ON user_xp(xp DESC);
    `);

    // Ensure watch_party_rooms columns exist for pre-existing tables
    const watchRoomCols = [
      `ALTER TABLE watch_party_rooms ADD COLUMN started_at INTEGER;`,
      `ALTER TABLE watch_party_rooms ADD COLUMN is_playing INTEGER DEFAULT 0;`,
      `ALTER TABLE watch_party_rooms ADD COLUMN last_state_change_at INTEGER;`,
      `ALTER TABLE watch_party_rooms ADD COLUMN total_paused_duration REAL DEFAULT 0;`,
      `ALTER TABLE watch_party_rooms ADD COLUMN current_position REAL DEFAULT 0;`
    ];
    for (const sql of watchRoomCols) {
      try {
        await client.execute(sql);
      } catch (_colErr) {}
    }

    // Ensure hero_settings and custom_sections columns exist for pre-existing tables
    try {
      await client.execute(`ALTER TABLE comments ADD COLUMN parent_comment_id TEXT;`);
    } catch (_migErr) {}
    try {
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);`);
    } catch (_migErr) {}
    try {
      await client.execute(`ALTER TABLE media_catalog_state ADD COLUMN hero_settings TEXT DEFAULT '[]';`);
    } catch (_migErr) {}
    try {
      await client.execute(`ALTER TABLE media_catalog_state ADD COLUMN custom_sections TEXT DEFAULT '[]';`);
    } catch (_migErr) {}

    // Ensure digital card and profile columns exist on user_profiles
    const userProfileCols = [
      `ALTER TABLE user_profiles ADD COLUMN card_number TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN card_theme TEXT DEFAULT 'ivory-gold';`,
      `ALTER TABLE user_profiles ADD COLUMN bio TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN signature_url TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN member_since TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN account_data TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN card_id TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN has_received_friend_card_theme INTEGER DEFAULT 0;`,
      `ALTER TABLE user_profiles ADD COLUMN total_referrals_completed INTEGER DEFAULT 0;`,
      `ALTER TABLE user_profiles ADD COLUMN email TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN device_fingerprint TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN current_streak INTEGER DEFAULT 0;`,
      `ALTER TABLE user_profiles ADD COLUMN last_active_date TEXT;`,
      `ALTER TABLE user_profiles ADD COLUMN longest_streak INTEGER DEFAULT 0;`,
      `ALTER TABLE user_profiles ADD COLUMN streak_milestones_claimed TEXT DEFAULT '[]';`,
      `ALTER TABLE user_profiles ADD COLUMN total_watch_seconds REAL DEFAULT 0;`,
      `ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0;`,
      `ALTER TABLE users ADD COLUMN last_active_date TEXT;`,
      `ALTER TABLE users ADD COLUMN longest_streak INTEGER DEFAULT 0;`,
      `ALTER TABLE users ADD COLUMN streak_milestones_claimed TEXT DEFAULT '[]';`,
      `ALTER TABLE users ADD COLUMN total_watch_seconds REAL DEFAULT 0;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN points INTEGER DEFAULT 0;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN previous_rank INTEGER;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN rank_delta INTEGER DEFAULT 0;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN watch_seconds REAL DEFAULT 0;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN current_streak INTEGER DEFAULT 0;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN streak_penalty INTEGER DEFAULT 0;`,
      `ALTER TABLE leaderboard_cache ADD COLUMN unlocked_achievements_count INTEGER DEFAULT 0;`
    ];
    for (const sql of userProfileCols) {
      try {
        await client.execute(sql);
      } catch (_colErr) {}
    }

    try {
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_profiles_card_number ON user_profiles(card_number);`);
    } catch (_idxErr) {}

    console.log('[Turso DB] Tables and indexes initialized successfully.');
    return true;
  } catch (err: any) {
    console.error('[Turso DB] Table initialization error:', err.message);
    return false;
  }
  });
}

// -----------------------------------------------------------------------------
// HELPER METHODS FOR TURSO DATABASE OPERATIONS
// -----------------------------------------------------------------------------

// Calculate Level from XP efficiently (matching client xpSystem.ts up to level 500)
export function calculateLevelFromXp(xp: number): number {
  const lifetimeXp = Number(xp || 0);
  if (lifetimeXp <= 0) return 1;
  if (lifetimeXp >= 5000000) {
    return 500 + Math.floor((lifetimeXp - 5000000) / 10000);
  }

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

  const getMinXpForLevel = (l: number): number => {
    if (l <= 1) return 0;
    if (l >= 500) return 5000000;

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

  let currentLevel = 1;
  for (let l = 1; l <= 500; l++) {
    const minXp = getMinXpForLevel(l);
    if (lifetimeXp >= minXp) {
      currentLevel = l;
    } else {
      break;
    }
  }
  return currentLevel;
}

/**
 * Derive standardized card number from user id
 */
export function deriveCardNumberFromUserId(userId: string): string {
  if (!userId) return 'FK-1001-2002';
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const p1 = clean.slice(0, 4).padEnd(4, '0');
  const p2 = clean.slice(4, 8).padEnd(4, '0');
  return `FK-${p1}-${p2}`;
}

/**
 * Ensure user profile exists in user_profiles to satisfy foreign key constraints
 */
export async function ensureUserProfileExists(userId: string, username?: string, avatar?: string) {
  if (!userId) return;
  const client = getTursoClient();
  try {
    const defaultUsername = username || 'Cinema Member';
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${userId}`;
    const defaultCard = deriveCardNumberFromUserId(userId);
    await client.execute({
      sql: `INSERT OR IGNORE INTO user_profiles (user_id, username, avatar, tier, pro_member, card_number, card_theme) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, defaultUsername, defaultAvatar, 'BRONZE', 0, defaultCard, 'ivory-gold']
    });
  } catch (err: any) {
    console.warn('[Turso DB] ensureUserProfileExists notice:', err.message);
  }
}

/**
 * Get or create User Profile
 */
export async function getOrCreateUserProfile(userId: string, username?: string, avatar?: string) {
  await ensureUserProfileExists(userId, username, avatar);
  const client = getTursoClient();
  const existing = await client.execute({
    sql: `SELECT user_id, username, avatar, tier, pro_member, card_number, card_theme, bio, signature_url, member_since, account_data, current_streak, last_active_date, longest_streak, streak_milestones_claimed, total_watch_seconds, created_at, updated_at FROM user_profiles WHERE user_id = ?`,
    args: [userId]
  });

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    let needsUpdate = false;
    let newUsername = String(row.username || '');
    let newAvatar = String(row.avatar || '');
    let cardNumber = row.card_number ? String(row.card_number) : '';

    if (!cardNumber) {
      cardNumber = deriveCardNumberFromUserId(userId);
      needsUpdate = true;
    }

    if (username && username !== newUsername) {
      newUsername = username;
      needsUpdate = true;
    }
    if (avatar && avatar !== newAvatar) {
      newAvatar = avatar;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await client.execute({
        sql: `UPDATE user_profiles SET username = ?, avatar = ?, card_number = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        args: [newUsername, newAvatar, cardNumber, userId]
      });
    }

    let milestonesClaimed: number[] = [];
    try {
      if (typeof row.streak_milestones_claimed === 'string') {
        milestonesClaimed = JSON.parse(row.streak_milestones_claimed);
      } else if (Array.isArray(row.streak_milestones_claimed)) {
        milestonesClaimed = row.streak_milestones_claimed;
      }
    } catch {}

    const today = new Date().toISOString().split('T')[0];
    const lastActive = (row.last_active_date as string) || null;
    let effectiveStreak = Number(row.current_streak || 0);
    if (!lastActive) {
      effectiveStreak = 0;
    } else {
      const [y1, m1, d1] = lastActive.split('-').map(Number);
      const [y2, m2, d2] = today.split('-').map(Number);
      if (!isNaN(y1) && !isNaN(m1) && !isNaN(d1)) {
        const utc1 = Date.UTC(y1, m1 - 1, d1);
        const utc2 = Date.UTC(y2, m2 - 1, d2);
        const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) {
          effectiveStreak = 0;
          client.execute({
            sql: `UPDATE user_profiles SET current_streak = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            args: [userId]
          }).catch(() => {});
          client.execute({
            sql: `UPDATE users SET current_streak = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            args: [userId]
          }).catch(() => {});
        }
      }
    }

    return {
      userId,
      user_id: userId,
      username: newUsername || 'Cinema Member',
      avatar: newAvatar || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer',
      tier: String(row.tier || 'BRONZE'),
      proMember: Boolean(row.pro_member),
      pro_member: Boolean(row.pro_member),
      cardNumber: cardNumber,
      card_number: cardNumber,
      cardTheme: String(row.card_theme || 'ivory-gold'),
      card_theme: String(row.card_theme || 'ivory-gold'),
      bio: row.bio ? String(row.bio) : '',
      signatureUrl: row.signature_url ? String(row.signature_url) : '',
      signature_url: row.signature_url ? String(row.signature_url) : '',
      memberSince: row.member_since ? String(row.member_since) : '2026',
      member_since: row.member_since ? String(row.member_since) : '2026',
      currentStreak: effectiveStreak,
      current_streak: effectiveStreak,
      lastActiveDate: (row.last_active_date as string) || null,
      last_active_date: (row.last_active_date as string) || null,
      longestStreak: Number(row.longest_streak || 0),
      longest_streak: Number(row.longest_streak || 0),
      streakMilestonesClaimed: milestonesClaimed,
      streak_milestones_claimed: milestonesClaimed,
      totalWatchSeconds: Number(row.total_watch_seconds || 0),
      total_watch_seconds: Number(row.total_watch_seconds || 0),
    };
  }

  // Create new user profile
  const defaultUsername = username || 'Cinema Member';
  const defaultAvatar = avatar || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer';
  const defaultCard = deriveCardNumberFromUserId(userId);

  await client.execute({
    sql: `INSERT INTO user_profiles (user_id, username, avatar, tier, pro_member, card_number, card_theme, member_since) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, defaultUsername, defaultAvatar, 'BRONZE', 0, defaultCard, 'ivory-gold', '2026']
  });

  // Initialize initial Fara balance (100)
  await client.execute({
    sql: `INSERT OR IGNORE INTO fara_balances (user_id, balance) VALUES (?, ?)`,
    args: [userId, 100]
  });

  // Initialize initial XP (0)
  await client.execute({
    sql: `INSERT OR IGNORE INTO user_xp (user_id, xp, level) VALUES (?, ?, ?)`,
    args: [userId, 0, 1]
  });

  return {
    userId,
    user_id: userId,
    username: defaultUsername,
    avatar: defaultAvatar,
    tier: 'BRONZE',
    proMember: false,
    pro_member: false,
    cardNumber: defaultCard,
    card_number: defaultCard,
    cardTheme: 'ivory-gold',
    card_theme: 'ivory-gold',
    bio: '',
    signatureUrl: '',
    signature_url: '',
    memberSince: '2026',
    member_since: '2026'
  };
}

/**
 * Update comprehensive user profile & digital pass settings in Turso
 */
export async function updateTursoUserProfile(params: {
  userId: string;
  username?: string;
  avatar?: string;
  cardTheme?: string;
  cardNumber?: string;
  bio?: string;
  signatureUrl?: string;
  memberSince?: string;
  tier?: string;
  proMember?: boolean;
  accountData?: any;
  lifetimeXp?: number;
  level?: number;
}) {
  const { userId, username, avatar, cardTheme, cardNumber, bio, signatureUrl, memberSince, tier, proMember, accountData, lifetimeXp: paramXp, level: paramLevel } = params;
  if (!userId) return null;

  await ensureUserProfileExists(userId, username, avatar);
  const client = getTursoClient();

  let resolvedXp = paramXp;
  let resolvedLevel = paramLevel;
  if (resolvedXp === undefined && accountData) {
    const parsed = typeof accountData === 'string' ? JSON.parse(accountData) : accountData;
    if (parsed.lifetimeXp !== undefined) resolvedXp = Number(parsed.lifetimeXp);
    else if (parsed.xp !== undefined) resolvedXp = Number(parsed.xp);
    if (parsed.currentLevel !== undefined) resolvedLevel = Number(parsed.currentLevel);
    else if (parsed.level !== undefined) resolvedLevel = Number(parsed.level);
  }

  if (resolvedXp !== undefined) {
    if (resolvedLevel === undefined) {
      resolvedLevel = calculateLevelFromXp(resolvedXp);
    }
    await client.execute({
      sql: `INSERT INTO user_xp (user_id, xp, level) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              xp = MAX(user_xp.xp, excluded.xp),
              level = MAX(user_xp.level, excluded.level),
              updated_at = CURRENT_TIMESTAMP`,
      args: [userId, resolvedXp, resolvedLevel]
    });
  }

  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const args: any[] = [];

  if (username !== undefined) {
    updates.push('username = ?');
    args.push(username);
  }
  if (avatar !== undefined) {
    updates.push('avatar = ?');
    args.push(avatar);
  }
  if (cardTheme !== undefined) {
    updates.push('card_theme = ?');
    args.push(cardTheme);
  }
  if (cardNumber !== undefined) {
    updates.push('card_number = ?');
    args.push(cardNumber);
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    args.push(bio);
  }
  if (signatureUrl !== undefined) {
    updates.push('signature_url = ?');
    args.push(signatureUrl);
  }
  if (memberSince !== undefined) {
    updates.push('member_since = ?');
    args.push(memberSince);
  }
  if (tier !== undefined) {
    updates.push('tier = ?');
    args.push(tier);
  }
  if (proMember !== undefined) {
    updates.push('pro_member = ?');
    args.push(proMember ? 1 : 0);
  }
  if (accountData !== undefined) {
    updates.push('account_data = ?');
    args.push(typeof accountData === 'string' ? accountData : JSON.stringify(accountData));
  }

  args.push(userId);

  await client.execute({
    sql: `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = ?`,
    args
  });

  return getOrCreateUserProfile(userId);
}

/**
 * Helper to strip theme prefixes for fuzzy matching
 */
function cleanCardQuery(raw: string): string {
  if (!raw) return '';
  let s = raw.trim().toUpperCase();
  // Strip theme prefix FK-(BTS|TL|DTK|BR|24M|SCI|GPA|APA|FA|DL)-
  s = s.replace(/^FK-(?:BTS|TL|DTK|BR|24M|SCI|GPA|APA|FA|DL)-/i, '');
  // Strip FK-
  s = s.replace(/^FK-/i, '');
  return s;
}

/**
 * Map detected theme prefix in query to theme id
 */
function detectThemeFromCardId(cardId: string): string | null {
  const upper = (cardId || '').toUpperCase();
  if (upper.includes('FK-BTS-')) return 'bts-edition';
  if (upper.includes('FK-TL-')) return 'toolate-edition';
  if (upper.includes('FK-DTK-')) return 'detektivi-edition';
  if (upper.includes('FK-BR-')) return 'baba-ramiz-edition';
  if (upper.includes('FK-24M-')) return 'horror-24m-edition';
  if (upper.includes('FK-SCI-')) return 'scifi-universe-edition';
  if (upper.includes('FK-GPA-')) return 'goldprince-era';
  if (upper.includes('FK-APA-')) return 'alttprince-era';
  if (upper.includes('FK-FA-')) return 'farukat-era';
  if (upper.includes('FK-DL-')) return 'dardi-ladi-edition';
  return null;
}

/**
 * Find user / member by Card Number, Card Segment, User ID, or Username in Turso database
 */
export async function lookupTursoMember(queryId: string) {
  if (!queryId) return null;
  const client = getTursoClient();

  const qClean = queryId.trim();
  const qUpper = qClean.toUpperCase();
  const seg = cleanCardQuery(qClean);
  const segNoDash = seg.replace(/[^A-Z0-9]/g, '');
  const last4 = segNoDash.length >= 4 ? segNoDash.slice(-4) : segNoDash;
  const detectedTheme = detectThemeFromCardId(qClean);

  const sql = `
    SELECT p.user_id, p.username, p.avatar, p.tier, p.pro_member, p.card_number, p.card_theme,
           p.bio, p.signature_url, p.member_since, p.created_at, p.updated_at,
           x.xp, x.level
    FROM user_profiles p
    LEFT JOIN user_xp x ON p.user_id = x.user_id
    WHERE 
      LOWER(p.user_id) = LOWER(?)
      OR UPPER(p.card_number) = ?
      OR UPPER(p.card_number) LIKE ?
      OR UPPER(p.user_id) LIKE ?
      OR (LENGTH(?) >= 3 AND UPPER(p.card_number) LIKE ?)
      OR LOWER(p.username) = LOWER(?)
    LIMIT 1
  `;
  const args = [
    qClean,
    qUpper,
    '%' + seg,
    '%' + segNoDash + '%',
    last4,
    '%' + last4,
    qClean
  ];

  const res = await client.execute({ sql, args });
  if (res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];
  const derivedCard = deriveCardNumberFromUserId(String(row.user_id));
  const baseCard = row.card_number ? String(row.card_number) : derivedCard;
  const activeTheme = detectedTheme || (row.card_theme ? String(row.card_theme) : 'ivory-gold');

  const xpNum = Number(row.xp || 0);
  const levelNum = calculateLevelFromXp(xpNum);
  const isSpecialAdmin = isSpecialAdminUser(String(row.user_id));

  return {
    cardNumber: baseCard,
    cardTheme: activeTheme,
    name: String(row.username || 'Cinema Member'),
    avatarUrl: String(row.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${row.user_id}`),
    tier: isSpecialAdmin ? 'DIAMOND' : String(row.tier || 'BRONZE'),
    level: levelNum,
    lifetimeXp: xpNum,
    memberSince: String(row.member_since || '2026'),
    status: 'Active',
    isOfficial: isSpecialAdmin || levelNum >= 8 || row.tier === 'DIAMOND',
    isProMember: Boolean(row.pro_member) || isSpecialAdmin,
    isPro: Boolean(row.pro_member) || isSpecialAdmin,
    badge: `Level ${levelNum} ${row.tier || 'BRONZE'}`,
    bio: String(row.bio || (isSpecialAdmin ? 'FARUKAT Founder & Executive Director' : 'FARUKAT Cinema Member')),
    followersCount: 0,
    followingCount: 0,
    emailMasked: 'Private',
    isPublicProfile: true,
    totalWatchSeconds: 0,
    ratingsGiven: 0,
    signatureUrl: row.signature_url ? String(row.signature_url) : undefined,
    userId: String(row.user_id),
  };
}

/**
 * Fetch all registered members from Turso for directory and community discovery
 */
export async function getAllTursoMembers() {
  const client = getTursoClient();
  const res = await client.execute(`
    SELECT p.user_id, p.username, p.avatar, p.tier, p.pro_member, p.card_number, p.card_theme,
           p.bio, p.signature_url, p.member_since,
           x.xp, x.level
    FROM user_profiles p
    LEFT JOIN user_xp x ON p.user_id = x.user_id
    WHERE p.user_id != 'guest'
    ORDER BY x.xp DESC, p.created_at DESC
    LIMIT 100
  `);

  return res.rows.map((row) => {
    const derivedCard = deriveCardNumberFromUserId(String(row.user_id));
    const baseCard = row.card_number ? String(row.card_number) : derivedCard;
    const xpNum = Number(row.xp || 0);
    const levelNum = calculateLevelFromXp(xpNum);
    const isSpecialAdmin = isSpecialAdminUser(String(row.user_id));

    return {
      cardNumber: baseCard,
      cardTheme: String(row.card_theme || 'ivory-gold'),
      name: String(row.username || 'Cinema Member'),
      avatarUrl: String(row.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${row.user_id}`),
      tier: isSpecialAdmin ? 'DIAMOND' : String(row.tier || 'BRONZE'),
      level: levelNum,
      lifetimeXp: xpNum,
      memberSince: String(row.member_since || '2026'),
      status: 'Active',
      isOfficial: isSpecialAdmin || levelNum >= 8 || row.tier === 'DIAMOND',
      isProMember: Boolean(row.pro_member) || isSpecialAdmin,
      isPro: Boolean(row.pro_member) || isSpecialAdmin,
      badge: `Level ${levelNum} ${row.tier || 'BRONZE'}`,
      bio: String(row.bio || 'FARUKAT Cinema Member'),
      followersCount: 0,
      followingCount: 0,
      emailMasked: 'Private',
      isPublicProfile: true,
      totalWatchSeconds: 0,
      ratingsGiven: 0,
      signatureUrl: row.signature_url ? String(row.signature_url) : undefined,
      userId: String(row.user_id),
    };
  });
}

/**
 * Get User XP and Level
 */
export async function getUserXp(userId: string) {
  const profile = await getOrCreateUserProfile(userId);
  const isGoldPrince = userId.toLowerCase().includes('goldprince') || (profile?.username && String(profile.username).toLowerCase().includes('goldprince'));
  const client = getTursoClient();
  const xpRes = await client.execute({
    sql: `SELECT xp, level FROM user_xp WHERE user_id = ?`,
    args: [userId]
  });

  let currentXp = isGoldPrince ? 5000000 : 0;
  let level = isGoldPrince ? 500 : 1;

  if (xpRes.rows.length > 0) {
    const dbXp = Number(xpRes.rows[0].xp || 0);
    currentXp = isGoldPrince ? Math.max(dbXp, 5000000) : dbXp;
    level = calculateLevelFromXp(currentXp);
  } else {
    await client.execute({
      sql: `INSERT OR IGNORE INTO user_xp (user_id, xp, level) VALUES (?, ?, ?)`,
      args: [userId, currentXp, level]
    });
  }

  const txRes = await client.execute({
    sql: `SELECT id, action, amount, reference_id, created_at FROM xp_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    args: [userId]
  });

  return {
    user_id: userId,
    xp: currentXp,
    level,
    transactions: txRes.rows.map(r => ({
      id: String(r.id),
      action: String(r.action),
      amount: Number(r.amount),
      referenceId: r.reference_id ? String(r.reference_id) : undefined,
      createdAt: String(r.created_at)
    }))
  };
}

/**
 * Award XP to user with idempotency / duplicate protection
 */
export async function awardUserXp(userId: string, action: string, amount: number, referenceId?: string, username?: string, avatar?: string) {
  await ensureUserProfileExists(userId, username, avatar);
  const client = getTursoClient();

  if (referenceId) {
    const existing = await client.execute({
      sql: `SELECT id FROM xp_transactions WHERE user_id = ? AND action = ? AND reference_id = ?`,
      args: [userId, action, referenceId]
    });
    if (existing.rows.length > 0) {
      const currentXpData = await getUserXp(userId);
      return { success: true, alreadyAwarded: true, xp: currentXpData.xp, level: currentXpData.level };
    }
  }

  const txId = 'xp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  await client.batch([
    {
      sql: `INSERT OR IGNORE INTO user_profiles (user_id, username, avatar) VALUES (?, ?, ?)`,
      args: [userId, username || 'Cinema Member', avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${userId}`]
    },
    {
      sql: `INSERT INTO xp_transactions (id, user_id, action, amount, reference_id) VALUES (?, ?, ?, ?, ?)`,
      args: [txId, userId, action, amount, referenceId || null]
    },
    {
      sql: `INSERT INTO user_xp (user_id, xp, level) VALUES (?, ?, 1)
            ON CONFLICT(user_id) DO UPDATE SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP`,
      args: [userId, amount, amount]
    }
  ]);

  const updatedXpData = await getUserXp(userId);
  // Update level field in user_xp
  await client.execute({
    sql: `UPDATE user_xp SET level = ? WHERE user_id = ?`,
    args: [updatedXpData.level, userId]
  });

  return {
    success: true,
    txId,
    action,
    amountAwarded: amount,
    xp: updatedXpData.xp,
    level: updatedXpData.level
  };
}

/**
 * Helper to check if a user is the special admin/owner user
 */
export function isSpecialAdminUser(userId?: string, userEmail?: string): boolean {
  if (!userId && !userEmail) return false;
  const uid = (userId || '').toLowerCase();
  const email = (userEmail || '').toLowerCase();
  return (
    uid === 'ymudlk8zzqzbnxelx9yncavvptv2' ||
    uid.includes('altinberisha434') ||
    email === 'altinberisha434@gmail.com'
  );
}

/**
 * Likes Toggle and Queries
 */
export async function getContentLikes(contentId: string, userId?: string) {
  const client = getTursoClient();

  const countRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM likes WHERE content_id = ?`,
    args: [contentId]
  });

  const count = Number(countRes.rows[0]?.cnt || 0);
  let userLiked = false;

  if (userId) {
    const userRes = await client.execute({
      sql: `SELECT id FROM likes WHERE user_id = ? AND content_id = ?`,
      args: [userId, contentId]
    });
    userLiked = userRes.rows.length > 0;
  }

  return {
    contentId,
    content_id: contentId,
    likesCount: count,
    likes_count: count,
    userLiked,
    isLiked: userLiked,
    liked: userLiked
  };
}

export async function getUserLikedContentIds(userId: string): Promise<string[]> {
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT content_id FROM likes WHERE user_id = ?`,
    args: [userId]
  });
  return res.rows.map(r => String(r.content_id));
}

export async function getTopCatalogStats() {
  return await executeWithTursoFallback(async (client) => {
    try {
      const likesRes = await client.execute(
        `SELECT content_id, COUNT(*) as cnt FROM likes GROUP BY content_id ORDER BY cnt DESC LIMIT 1`
      );
      const commentsRes = await client.execute(
        `SELECT content_id, COUNT(*) as cnt FROM comments WHERE is_deleted = 0 GROUP BY content_id ORDER BY cnt DESC LIMIT 1`
      );
      const watchRes = await client.execute(
        `SELECT content_id, COUNT(*) as cnt FROM watch_progress GROUP BY content_id ORDER BY cnt DESC LIMIT 1`
      );
      return {
        mostLiked: likesRes.rows[0] ? { contentId: String(likesRes.rows[0].content_id), count: Number(likesRes.rows[0].cnt) } : null,
        mostCommented: commentsRes.rows[0] ? { contentId: String(commentsRes.rows[0].content_id), count: Number(commentsRes.rows[0].cnt) } : null,
        mostWatched: watchRes.rows[0] ? { contentId: String(watchRes.rows[0].content_id), count: Number(watchRes.rows[0].cnt) } : null,
      };
    } catch (err: any) {
      console.warn('[Turso DB] getTopCatalogStats notice:', err?.message || err);
      return { mostLiked: null, mostCommented: null, mostWatched: null };
    }
  });
}

export async function toggleLike(contentId: string, userId: string) {
  const client = getTursoClient();

  const existing = await client.execute({
    sql: `SELECT id FROM likes WHERE user_id = ? AND content_id = ?`,
    args: [userId, contentId]
  });

  let active = false;

  if (existing.rows.length > 0) {
    await client.execute({
      sql: `DELETE FROM likes WHERE user_id = ? AND content_id = ?`,
      args: [userId, contentId]
    });
    active = false;
  } else {
    const likeId = 'like_' + userId + '_' + contentId;
    await client.execute({
      sql: `INSERT OR IGNORE INTO likes (id, user_id, content_id) VALUES (?, ?, ?)`,
      args: [likeId, userId, contentId]
    });
    active = true;
  }

  const updatedInfo = await getContentLikes(contentId, userId);
  return {
    active,
    liked: active,
    isLiked: active,
    likesCount: updatedInfo.likesCount
  };
}

/**
 * Comments CRUD & Incremental Sync (with Turso per-user comment likes tracking)
 */
export async function getCommentsForContent(contentId: string, currentUserId?: string, since?: string, limit = 50, offset = 0) {
  const client = getTursoClient();
  const requestingUserId = currentUserId || '';

  let querySql = `
    SELECT 
      c.id, 
      c.user_id, 
      c.content_id, 
      c.username, 
      c.avatar, 
      c.text, 
      c.parent_comment_id,
      c.created_at,
      COUNT(cl.id) as likes_count,
      MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END) as user_liked
    FROM comments c
    LEFT JOIN comment_likes cl ON c.id = cl.comment_id
    WHERE c.content_id = ? AND c.is_deleted = 0
  `;
  const args: any[] = [requestingUserId, contentId];

  if (since) {
    querySql += ` AND c.created_at > ?`;
    args.push(since);
  }

  querySql += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);

  let res;
  try {
    res = await client.execute({ sql: querySql, args });
  } catch (err: any) {
    if (err?.message && (err.message.includes('parent_comment_id') || err.message.includes('no such column'))) {
      try {
        await client.execute(`ALTER TABLE comments ADD COLUMN parent_comment_id TEXT;`);
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);`);
      } catch (_alterErr) {}
      res = await client.execute({ sql: querySql, args });
    } else {
      throw err;
    }
  }

  return res.rows.map(r => ({
    id: String(r.id),
    commentId: String(r.id),
    contentId: String(r.content_id),
    content_id: String(r.content_id),
    userId: String(r.user_id),
    user_id: String(r.user_id),
    username: String(r.username),
    avatar: String(r.avatar),
    text: String(r.text),
    parentCommentId: r.parent_comment_id ? String(r.parent_comment_id) : null,
    parent_comment_id: r.parent_comment_id ? String(r.parent_comment_id) : null,
    createdAt: String(r.created_at),
    created_at: String(r.created_at),
    likesCount: Number(r.likes_count || 0),
    likes_count: Number(r.likes_count || 0),
    userLiked: Number(r.user_liked) === 1 || String(r.user_liked) === '1' || String(r.user_liked) === 'true',
    user_liked: Number(r.user_liked) === 1 || String(r.user_liked) === '1' || String(r.user_liked) === 'true'
  }));
}

export async function createComment(
  contentId: string,
  userId: string,
  username: string,
  avatar: string,
  text: string,
  parentCommentId?: string | null
) {
  await ensureUserProfileExists(userId, username, avatar);
  const client = getTursoClient();

  const id = (parentCommentId ? 'rep_' : 'cmt_') + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const parentId = parentCommentId && parentCommentId.trim() ? parentCommentId.trim() : null;

  try {
    await client.execute({
      sql: `INSERT INTO comments (id, user_id, content_id, username, avatar, text, parent_comment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, userId, contentId, username, avatar, text, parentId, now, now]
    });
  } catch (err: any) {
    if (err?.message && (err.message.includes('parent_comment_id') || err.message.includes('no such column'))) {
      try {
        await client.execute(`ALTER TABLE comments ADD COLUMN parent_comment_id TEXT;`);
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);`);
      } catch (_alterErr) {}
      await client.execute({
        sql: `INSERT INTO comments (id, user_id, content_id, username, avatar, text, parent_comment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, userId, contentId, username, avatar, text, parentId, now, now]
      });
    } else {
      throw err;
    }
  }

  // Award 15 XP for review comment or reply
  try {
    const xpAction = parentId ? 'Shared Cinema Review Reply' : 'Shared Cinema Review Comment';
    await awardUserXp(userId, xpAction, 15, id, username, avatar);
  } catch (xpErr: any) {
    console.warn('[Turso DB] Comment XP award notice:', xpErr.message);
  }

  // Trigger In-App Notification if this is a reply to someone else's comment
  if (parentId) {
    try {
      const parentCheck = await client.execute({
        sql: `SELECT user_id, username, text, content_id FROM comments WHERE id = ?`,
        args: [parentId]
      });
      if (parentCheck.rows.length > 0) {
        const parentAuthorId = String(parentCheck.rows[0].user_id);
        if (parentAuthorId && parentAuthorId !== userId) {
          const parentSnippet = String(parentCheck.rows[0].text || '').slice(0, 60);
          await createInAppNotificationRecord({
            userId: parentAuthorId,
            category: 'social',
            type: 'comment_reply',
            priority: 'HIGH',
            title: `${username} replied to your review`,
            message: text.length > 90 ? text.slice(0, 87) + '...' : text,
            targetType: 'video_player',
            targetId: contentId,
            actionPayload: {
              contentId,
              commentId: id,
              parentCommentId: parentId,
              actorUserId: userId,
              actorUsername: username,
              actorAvatar: avatar,
              parentCommentSnippet: parentSnippet,
            },
            imageUrl: avatar,
          });
        }
      }
    } catch (notifErr: any) {
      console.warn('[Turso DB] Comment reply notification error:', notifErr.message);
    }
  }

  return {
    id,
    commentId: id,
    contentId,
    content_id: contentId,
    userId,
    user_id: userId,
    username,
    avatar,
    text,
    parentCommentId: parentId,
    parent_comment_id: parentId,
    createdAt: now,
    created_at: now,
    likesCount: 0,
    likes_count: 0,
    userLiked: false,
    user_liked: false
  };
}

export async function deleteComment(commentId: string, userId: string) {
  const client = getTursoClient();

  const res = await client.execute({
    sql: `UPDATE comments SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    args: [commentId, userId]
  });

  return res.rowsAffected > 0;
}

/**
 * Toggle like for a specific comment (Turso comment_likes table with per-user tracking)
 */
export async function toggleCommentLike(commentId: string, userId: string) {
  const client = getTursoClient();

  // Verify comment exists and is not deleted
  const commentCheck = await client.execute({
    sql: `SELECT id, user_id, content_id FROM comments WHERE id = ? AND is_deleted = 0`,
    args: [commentId]
  });

  if (commentCheck.rows.length === 0) {
    throw new Error('Comment not found or has been deleted');
  }

  const authorId = String(commentCheck.rows[0].user_id);
  const commentContentId = String(commentCheck.rows[0].content_id || '');

  // Check if current user already liked this comment
  const existingLike = await client.execute({
    sql: `SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?`,
    args: [userId, commentId]
  });

  let active = false;
  if (existingLike.rows.length > 0) {
    // Unlike: remove row
    await client.execute({
      sql: `DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?`,
      args: [userId, commentId]
    });
    active = false;
  } else {
    // Like: insert unique row
    const likeId = `cl_${userId}_${commentId}_${Date.now()}`;
    await client.execute({
      sql: `INSERT OR IGNORE INTO comment_likes (id, user_id, comment_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [likeId, userId, commentId]
    });
    active = true;

    // Award 5 XP for social curation/engagement if liking another member's comment
    if (authorId !== userId) {
      try {
        await awardUserXp(userId, 'Liked Community Review', 5, commentId);
      } catch (err: any) {
        console.warn('[Turso DB] Comment like XP notice:', err.message);
      }

      // Trigger In-App Notification to the comment author
      try {
        const likerProfile = await getOrCreateUserProfile(userId);
        const likerName = likerProfile?.username || 'A cinema member';
        const likerAvatar = (likerProfile as any)?.avatar || (likerProfile as any)?.avatar_url || 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FarukatViewer';

        await createInAppNotificationRecord({
          userId: authorId,
          category: 'social',
          type: 'comment_like',
          priority: 'NORMAL',
          title: `${likerName} liked your review`,
          message: `Your comment received a like from ${likerName}`,
          targetType: 'video_player',
          targetId: commentContentId,
          groupKey: `comment_like_${commentId}`,
          actionPayload: {
            contentId: commentContentId,
            commentId,
            actorUserId: userId,
            actorUsername: likerName,
            actorAvatar: likerAvatar,
          },
          imageUrl: likerAvatar,
        });
      } catch (likeNotifErr: any) {
        console.warn('[Turso DB] Comment like notification error:', likeNotifErr.message);
      }
    }
  }

  // Get true fresh count from Turso
  const countRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?`,
    args: [commentId]
  });

  const likesCount = Number(countRes.rows[0]?.cnt || 0);

  return {
    success: true,
    commentId,
    active,
    liked: active,
    userLiked: active,
    likesCount
  };
}

/**
 * Get like status and count for a comment from Turso
 */
export async function getCommentLikes(commentId: string, currentUserId?: string) {
  const client = getTursoClient();

  const countRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?`,
    args: [commentId]
  });
  const likesCount = Number(countRes.rows[0]?.cnt || 0);

  let userLiked = false;
  if (currentUserId) {
    const userRes = await client.execute({
      sql: `SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?`,
      args: [currentUserId, commentId]
    });
    userLiked = userRes.rows.length > 0;
  }

  return {
    commentId,
    likesCount,
    userLiked
  };
}

/**
 * In-App Notification System Database Methods
 */
export interface InAppNotificationRecord {
  id?: string;
  userId: string;
  category: 'social' | 'achievements' | 'watching' | 'progression' | 'system';
  type: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  title: string;
  message: string;
  targetType: 'video_player' | 'media_detail' | 'achievements' | 'leaderboard' | 'membership' | 'none';
  targetId: string;
  actionPayload?: any;
  groupKey?: string | null;
  imageUrl?: string | null;
  isRead?: boolean;
}

export async function createInAppNotificationRecord(notif: InAppNotificationRecord) {
  const client = getTursoClient();
  const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const priority = notif.priority || 'NORMAL';
  const payloadStr = typeof notif.actionPayload === 'object' ? JSON.stringify(notif.actionPayload) : (notif.actionPayload || '{}');
  const now = new Date().toISOString();

  // If groupKey is provided, check if an unread notification with this groupKey already exists
  if (notif.groupKey) {
    try {
      const existing = await client.execute({
        sql: `SELECT id FROM in_app_notifications WHERE user_id = ? AND group_key = ? AND is_read = 0 LIMIT 1`,
        args: [notif.userId, notif.groupKey]
      });

      if (existing.rows.length > 0) {
        const existingId = String(existing.rows[0].id);
        await client.execute({
          sql: `UPDATE in_app_notifications SET 
                  title = ?,
                  message = ?,
                  action_payload = ?,
                  image_url = ?,
                  created_at = ?
                WHERE id = ?`,
          args: [notif.title, notif.message, payloadStr, notif.imageUrl || null, now, existingId]
        });
        return { id: existingId, updated: true };
      }
    } catch (groupErr: any) {
      console.warn('[Turso DB] Group notification check notice:', groupErr.message);
    }
  }

  await client.execute({
    sql: `INSERT INTO in_app_notifications (
            id, user_id, category, type, priority, title, message,
            target_type, target_id, action_payload, group_key, image_url,
            is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      id,
      notif.userId,
      notif.category,
      notif.type,
      priority,
      notif.title,
      notif.message,
      notif.targetType,
      notif.targetId,
      payloadStr,
      notif.groupKey || null,
      notif.imageUrl || null,
      now
    ]
  });

  return { id, created: true };
}

export async function getInAppNotifications(userId: string, limit = 50, offset = 0) {
  const client = getTursoClient();

  const countRes = await client.execute({
    sql: `SELECT COUNT(*) as unread FROM in_app_notifications WHERE user_id = ? AND is_read = 0`,
    args: [userId]
  });
  const unreadCount = Number(countRes.rows[0]?.unread || 0);

  const listRes = await client.execute({
    sql: `SELECT id, user_id, category, type, priority, title, message,
                 target_type, target_id, action_payload, group_key, image_url,
                 is_read, created_at, read_at
          FROM in_app_notifications
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
    args: [userId, limit, offset]
  });

  const notifications = listRes.rows.map(row => {
    let actionPayload: any = {};
    try {
      if (typeof row.action_payload === 'string') {
        actionPayload = JSON.parse(row.action_payload);
      }
    } catch {}

    return {
      id: String(row.id),
      userId: String(row.user_id),
      category: String(row.category),
      type: String(row.type),
      priority: String(row.priority || 'NORMAL'),
      title: String(row.title),
      message: String(row.message),
      targetType: String(row.target_type),
      targetId: String(row.target_id),
      actionPayload,
      groupKey: row.group_key ? String(row.group_key) : undefined,
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      isRead: Number(row.is_read) === 1,
      createdAt: String(row.created_at),
      readAt: row.read_at ? String(row.read_at) : undefined
    };
  });

  return { notifications, unreadCount };
}

export async function markNotificationRead(notificationId: string | undefined, userId: string, markAll = false) {
  const client = getTursoClient();
  const now = new Date().toISOString();

  if (markAll) {
    const res = await client.execute({
      sql: `UPDATE in_app_notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0`,
      args: [now, userId]
    });
    return { success: true, updated: res.rowsAffected };
  }

  if (!notificationId) return { success: false, error: 'Notification ID required' };

  const res = await client.execute({
    sql: `UPDATE in_app_notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ?`,
    args: [now, notificationId, userId]
  });

  return { success: res.rowsAffected > 0 };
}

export async function deleteInAppNotification(notificationId: string, userId: string) {
  const client = getTursoClient();

  const res = await client.execute({
    sql: `DELETE FROM in_app_notifications WHERE id = ? AND user_id = ?`,
    args: [notificationId, userId]
  });

  return { success: res.rowsAffected > 0 };
}

/**
 * Watch Progress & Milestone Rewards
 */
export async function updateWatchProgress(
  userId: string,
  contentId: string,
  progressSeconds: number,
  durationSeconds: number,
  completed = false
) {
  const client = getTursoClient();
  const id = `wp_${userId}_${contentId}`;

  await client.execute({
    sql: `INSERT INTO watch_progress (id, user_id, content_id, progress_seconds, duration_seconds, completed, last_watched_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, content_id) DO UPDATE SET
            progress_seconds = MAX(progress_seconds, ?),
            duration_seconds = MAX(duration_seconds, ?),
            completed = CASE WHEN completed = 1 THEN 1 ELSE ? END,
            last_watched_at = CURRENT_TIMESTAMP`,
    args: [id, userId, contentId, progressSeconds, durationSeconds, completed ? 1 : 0, progressSeconds, durationSeconds, completed ? 1 : 0]
  });

  return { success: true };
}

export async function getUserWatchProgressList(userId: string) {
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT content_id, progress_seconds, duration_seconds, completed, last_watched_at
          FROM watch_progress
          WHERE user_id = ?`,
    args: [userId]
  });
  return res.rows.map((r: any) => ({
    contentId: String(r.content_id),
    content_id: String(r.content_id),
    progressSeconds: Number(r.progress_seconds || 0),
    progress_seconds: Number(r.progress_seconds || 0),
    durationSeconds: Number(r.duration_seconds || 0),
    duration_seconds: Number(r.duration_seconds || 0),
    completed: Boolean(Number(r.completed) === 1),
    lastWatchedAt: String(r.last_watched_at || ''),
    last_watched_at: String(r.last_watched_at || '')
  }));
}

export async function clearUserWatchProgress(userId: string) {
  const client = getTursoClient();
  await client.execute({
    sql: `DELETE FROM watch_progress WHERE user_id = ?`,
    args: [userId]
  });
  return { success: true };
}

export async function claimWatchReward(userId: string, contentId: string, milestone: string) {
  const client = getTursoClient();

  const rewardId = `rwd_${userId}_${contentId}_${milestone}`;

  const existing = await client.execute({
    sql: `SELECT id FROM watch_rewards WHERE user_id = ? AND content_id = ? AND milestone = ?`,
    args: [userId, contentId, milestone]
  });

  if (existing.rows.length > 0) {
    return { success: true, alreadyClaimed: true, awarded: false, xpAwarded: 0 };
  }

  let xpReward = 0;

  if (milestone === 'watch_15s') {
    xpReward = 25;
  } else if (milestone === 'watch_50_percent') {
    xpReward = 50;
  } else if (milestone === 'video_completion') {
    xpReward = 100;
  } else {
    xpReward = 20;
  }

  try {
    await client.execute({
      sql: `INSERT INTO watch_rewards (id, user_id, content_id, milestone, xp_awarded) VALUES (?, ?, ?, ?, ?)`,
      args: [rewardId, userId, contentId, milestone, xpReward]
    });
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('UNIQUE constraint failed') || errMsg.includes('SQLITE_CONSTRAINT') || errMsg.includes('constraint failed')) {
      return { success: true, alreadyClaimed: true, awarded: false, xpAwarded: 0 };
    }
    throw err;
  }

  if (xpReward > 0) {
    await awardUserXp(userId, `Milestone: ${milestone}`, xpReward, rewardId);
  }

  return {
    success: true,
    alreadyClaimed: false,
    awarded: true,
    xpAwarded: xpReward
  };
}

/**
 * Streak milestone XP bonuses:
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

export async function syncTursoUserStreak(params: {
  userId: string;
  clientDate?: string;
}) {
  const { userId, clientDate } = params;
  if (!userId || userId === 'guest') {
    return {
      currentStreak: 0,
      lastActiveDate: null,
      longestStreak: 0,
      streakMilestonesClaimed: [],
      milestoneAwarded: null,
      streakChanged: false,
    };
  }

  const client = getTursoClient();

  // Ensure record exists in users
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (user_id, current_streak, longest_streak, streak_milestones_claimed)
          VALUES (?, 0, 0, '[]')`,
    args: [userId]
  });

  const rowResult = await client.execute({
    sql: `SELECT current_streak, last_active_date, longest_streak, streak_milestones_claimed FROM users WHERE user_id = ? LIMIT 1`,
    args: [userId]
  });

  let currentStreak = Number(rowResult.rows[0]?.current_streak ?? 0);
  let lastActiveDate = (rowResult.rows[0]?.last_active_date as string) || null;
  let longestStreak = Number(rowResult.rows[0]?.longest_streak ?? currentStreak);
  let claimedRaw = rowResult.rows[0]?.streak_milestones_claimed;
  let streakMilestonesClaimed: number[] = [];
  try {
    if (typeof claimedRaw === 'string') {
      streakMilestonesClaimed = JSON.parse(claimedRaw);
    } else if (Array.isArray(claimedRaw)) {
      streakMilestonesClaimed = claimedRaw;
    }
  } catch {
    streakMilestonesClaimed = [];
  }

  const today = clientDate || new Date().toISOString().split('T')[0];
  let streakChanged = false;

  if (!lastActiveDate) {
    currentStreak = 1;
    lastActiveDate = today;
    longestStreak = Math.max(longestStreak, 1);
    streakChanged = true;
  } else {
    // Diff in calendar days
    const [y1, m1, d1] = lastActiveDate.split('-').map(Number);
    const [y2, m2, d2] = today.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, do not increment again
    } else if (diffDays === 1) {
      // Consecutive calendar day
      currentStreak += 1;
      lastActiveDate = today;
      longestStreak = Math.max(longestStreak, currentStreak);
      streakChanged = true;
    } else if (diffDays > 1) {
      // Missed full day, resets to 0, start new streak at 1
      currentStreak = 1;
      lastActiveDate = today;
      longestStreak = Math.max(longestStreak, 1);
      streakChanged = true;
    }
  }

  // Check milestones
  let milestoneAwarded: { streak: number; xp: number } | null = null;
  const milestoneBonus = STREAK_MILESTONES[currentStreak];
  if (milestoneBonus !== undefined && !streakMilestonesClaimed.includes(currentStreak)) {
    streakMilestonesClaimed.push(currentStreak);
    milestoneAwarded = {
      streak: currentStreak,
      xp: milestoneBonus
    };
  }

  await client.execute({
    sql: `UPDATE users SET
            current_streak = ?,
            last_active_date = ?,
            longest_streak = ?,
            streak_milestones_claimed = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`,
    args: [
      currentStreak,
      lastActiveDate,
      longestStreak,
      JSON.stringify(streakMilestonesClaimed),
      userId
    ]
  });

  try {
    await client.execute({
      sql: `UPDATE user_profiles SET
              current_streak = ?,
              last_active_date = ?,
              longest_streak = ?,
              streak_milestones_claimed = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?`,
      args: [
        currentStreak,
        lastActiveDate,
        longestStreak,
        JSON.stringify(streakMilestonesClaimed),
        userId
      ]
    });
  } catch {}

  // If milestone was awarded, award XP in Turso
  if (milestoneAwarded) {
    try {
      await awardUserXp(
        userId,
        `${milestoneAwarded.streak}-Day Streak Milestone Bonus`,
        milestoneAwarded.xp,
        `streak_${milestoneAwarded.streak}`
      );
    } catch (xpErr) {
      console.warn('[Turso DB] Failed to credit milestone XP in Turso:', xpErr);
    }
  }

  return {
    currentStreak,
    lastActiveDate,
    longestStreak,
    streakMilestonesClaimed,
    milestoneAwarded,
    streakChanged
  };
}

export async function updateTursoWatchSeconds(userId: string, totalSeconds: number) {
  if (!userId || userId === 'guest') return;
  const client = getTursoClient();
  try {
    await client.execute({
      sql: `UPDATE users SET total_watch_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      args: [totalSeconds, userId]
    });
    await client.execute({
      sql: `UPDATE user_profiles SET total_watch_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      args: [totalSeconds, userId]
    });
  } catch {}
}


/**
 * Fetch global media catalog state from Turso
 */
export async function getTursoMediaCatalogState() {
  const client = getTursoClient();

  const fetchState = async () => {
    const res = await client.execute({
      sql: `SELECT custom_videos, hidden_ids, deleted_ids, new_ids, removed_new_ids, hero_settings, custom_sections, updated_at FROM media_catalog_state WHERE id = 'global'`,
      args: []
    });

    if (res.rows.length === 0) {
      return {
        customVideos: [],
        hiddenVideoIds: [],
        deletedVideoIds: [],
        newVideoIds: [],
        removedNewVideoIds: [],
        heroSettings: [],
        customSections: [],
        updatedAt: new Date().toISOString()
      };
    }

    const row = res.rows[0];
    return {
      customVideos: row.custom_videos ? JSON.parse(String(row.custom_videos)) : [],
      hiddenVideoIds: row.hidden_ids ? JSON.parse(String(row.hidden_ids)) : [],
      deletedVideoIds: row.deleted_ids ? JSON.parse(String(row.deleted_ids)) : [],
      newVideoIds: row.new_ids ? JSON.parse(String(row.new_ids)) : [],
      removedNewVideoIds: row.removed_new_ids ? JSON.parse(String(row.removed_new_ids)) : [],
      heroSettings: row.hero_settings ? JSON.parse(String(row.hero_settings)) : [],
      customSections: row.custom_sections ? JSON.parse(String(row.custom_sections)) : [],
      updatedAt: String(row.updated_at || new Date().toISOString())
    };
  };

  try {
    return await fetchState();
  } catch (err: any) {
    if (err?.message?.includes('no such column: hero_settings') || err?.message?.includes('no such column: custom_sections')) {
      try {
        await client.execute(`ALTER TABLE media_catalog_state ADD COLUMN hero_settings TEXT DEFAULT '[]';`);
      } catch {}
      try {
        await client.execute(`ALTER TABLE media_catalog_state ADD COLUMN custom_sections TEXT DEFAULT '[]';`);
        return await fetchState();
      } catch (retryErr: any) {
        console.error('[Turso DB] Retry after custom_sections migration failed:', retryErr.message);
      }
    }
    console.error('[Turso DB] getTursoMediaCatalogState error:', err.message);
    return {
      customVideos: [],
      hiddenVideoIds: [],
      deletedVideoIds: [],
      newVideoIds: [],
      removedNewVideoIds: [],
      heroSettings: [],
      customSections: [],
      updatedAt: new Date().toISOString()
    };
  }
}

/**
  * Save global media catalog state to Turso
  */
export async function saveTursoMediaCatalogState(state: {
  customVideos?: any[];
  hiddenVideoIds?: string[];
  deletedVideoIds?: string[];
  newVideoIds?: string[];
  removedNewVideoIds?: string[];
  heroSettings?: any[];
  customSections?: any[];
}) {
  const client = getTursoClient();
  const now = new Date().toISOString();

  const customJson = JSON.stringify(state.customVideos || []);
  const hiddenJson = JSON.stringify(state.hiddenVideoIds || []);
  const deletedJson = JSON.stringify(state.deletedVideoIds || []);
  const newJson = JSON.stringify(state.newVideoIds || []);
  const removedNewJson = JSON.stringify(state.removedNewVideoIds || []);
  const heroJson = JSON.stringify(state.heroSettings || []);
  const sectionsJson = JSON.stringify(state.customSections || []);

  try {
    await client.execute({
      sql: `INSERT INTO media_catalog_state (id, custom_videos, hidden_ids, deleted_ids, new_ids, removed_new_ids, hero_settings, custom_sections, updated_at)
            VALUES ('global', ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              custom_videos = ?,
              hidden_ids = ?,
              deleted_ids = ?,
              new_ids = ?,
              removed_new_ids = ?,
              hero_settings = ?,
              custom_sections = ?,
              updated_at = ?`,
      args: [
        customJson, hiddenJson, deletedJson, newJson, removedNewJson, heroJson, sectionsJson, now,
        customJson, hiddenJson, deletedJson, newJson, removedNewJson, heroJson, sectionsJson, now
      ]
    });
    return { success: true, updatedAt: now };
  } catch (err: any) {
    console.error('[Turso DB] saveTursoMediaCatalogState error:', err.message);
    throw err;
  }
}

/**
 * Process a valid referral signup event with anti-abuse validation and reward grants in Turso
 */
export async function processReferralSignup(params: {
  refereeUserId: string;
  refCode: string;
  email?: string;
  deviceFingerprint?: string;
}) {
  const { refereeUserId, refCode, email, deviceFingerprint } = params;
  if (!refereeUserId || !refCode) return { success: false, reason: 'missing_params' };

  const client = getTursoClient();

  // 1. Check if referee already has a referral record (prevent double processing)
  const existingRef = await client.execute({
    sql: `SELECT id FROM referrals WHERE referee_user_id = ?`,
    args: [refereeUserId]
  });
  if (existingRef.rows.length > 0) {
    return { success: false, reason: 'already_processed' };
  }

  // 2. Find referrer by card code / card_id / user_id
  const cleanRef = refCode.trim().toUpperCase();
  const referrerRes = await client.execute({
    sql: `SELECT user_id, card_number FROM user_profiles WHERE UPPER(card_number) = ? OR UPPER(user_id) = ? OR UPPER(card_id) = ? LIMIT 1`,
    args: [cleanRef, cleanRef, cleanRef]
  });

  if (referrerRes.rows.length === 0) {
    return { success: false, reason: 'invalid_referral_code' };
  }

  const referrerUserId = String(referrerRes.rows[0].user_id);

  // 3. Prevent self-referral
  if (referrerUserId === refereeUserId) {
    return { success: false, reason: 'self_referral_not_allowed' };
  }

  // 4. Anti-abuse: Check duplicate identity signals in user_profiles
  let isFlagged = false;
  let flagReason = '';
  if (email) {
    const emailMatch = await client.execute({
      sql: `SELECT user_id FROM user_profiles WHERE email = ? AND user_id != ? LIMIT 1`,
      args: [email, refereeUserId]
    });
    if (emailMatch.rows.length > 0) {
      isFlagged = true;
      flagReason = `Duplicate email: ${email}`;
    }
  }
  if (!isFlagged && deviceFingerprint) {
    const fpMatch = await client.execute({
      sql: `SELECT user_id FROM user_profiles WHERE device_fingerprint = ? AND user_id != ? LIMIT 1`,
      args: [deviceFingerprint, refereeUserId]
    });
    if (fpMatch.rows.length > 0) {
      isFlagged = true;
      flagReason = `Duplicate device fingerprint: ${deviceFingerprint}`;
    }
  }

  if (isFlagged) {
    const flagId = 'flag_' + Math.random().toString(36).substring(2, 11);
    await client.execute({
      sql: `INSERT INTO referral_flags (id, user_id, reason) VALUES (?, ?, ?)`,
      args: [flagId, refereeUserId, flagReason]
    });
    const refId = 'ref_' + Math.random().toString(36).substring(2, 11);
    await client.execute({
      sql: `INSERT INTO referrals (id, referrer_user_id, referee_user_id, referral_code_used, xp_awarded_referrer, xp_awarded_referee, friend_theme_awarded_referrer, friend_theme_awarded_referee) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [refId, referrerUserId, refereeUserId, cleanRef, 0, 0, 0, 0]
    });
    return { success: false, flagged: true, reason: flagReason };
  }

  // 5. Grant rewards: 500 XP to both referrer and referee
  await client.execute({
    sql: `INSERT INTO user_xp (user_id, xp, level) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP`,
    args: [referrerUserId, 500, 2, 500]
  });
  const refXpRes = await client.execute({ sql: `SELECT xp FROM user_xp WHERE user_id = ?`, args: [referrerUserId] });
  const refXp = Number(refXpRes.rows[0]?.xp || 500);
  const refLevel = calculateLevelFromXp(refXp);
  await client.execute({ sql: `UPDATE user_xp SET level = ? WHERE user_id = ?`, args: [refLevel, referrerUserId] });

  await client.execute({
    sql: `INSERT INTO user_xp (user_id, xp, level) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP`,
    args: [refereeUserId, 500, 2, 500]
  });
  const refereeXpRes = await client.execute({ sql: `SELECT xp FROM user_xp WHERE user_id = ?`, args: [refereeUserId] });
  const refereeXp = Number(refereeXpRes.rows[0]?.xp || 500);
  const refereeLevel = calculateLevelFromXp(refereeXp);
  await client.execute({ sql: `UPDATE user_xp SET level = ? WHERE user_id = ?`, args: [refereeLevel, refereeUserId] });

  // 6. Check Friend Card theme (once per user ever)
  let referrerThemeAwarded = 0;
  let refereeThemeAwarded = 0;

  const referrerProfileRes = await client.execute({
    sql: `SELECT has_received_friend_card_theme FROM user_profiles WHERE user_id = ?`,
    args: [referrerUserId]
  });
  const referrerHasTheme = Number(referrerProfileRes.rows[0]?.has_received_friend_card_theme || 0);
  if (referrerHasTheme === 0) {
    referrerThemeAwarded = 1;
    await client.execute({
      sql: `UPDATE user_profiles SET has_received_friend_card_theme = 1 WHERE user_id = ?`,
      args: [referrerUserId]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO unlocked_themes (user_id, theme_name, unlock_source) VALUES (?, 'friend-card', 'referral')`,
      args: [referrerUserId]
    });
  }

  const refereeProfileRes = await client.execute({
    sql: `SELECT has_received_friend_card_theme FROM user_profiles WHERE user_id = ?`,
    args: [refereeUserId]
  });
  const refereeHasTheme = Number(refereeProfileRes.rows[0]?.has_received_friend_card_theme || 0);
  if (refereeHasTheme === 0) {
    refereeThemeAwarded = 1;
    await client.execute({
      sql: `UPDATE user_profiles SET has_received_friend_card_theme = 1 WHERE user_id = ?`,
      args: [refereeUserId]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO unlocked_themes (user_id, theme_name, unlock_source) VALUES (?, 'friend-card', 'referral')`,
      args: [refereeUserId]
    });
  }

  // 7. Increment referrer total_referrals_completed
  await client.execute({
    sql: `UPDATE user_profiles SET total_referrals_completed = total_referrals_completed + 1 WHERE user_id = ?`,
    args: [referrerUserId]
  });

  // 8. Log in referrals audit log
  const refId = 'ref_' + Math.random().toString(36).substring(2, 11);
  await client.execute({
    sql: `INSERT INTO referrals (id, referrer_user_id, referee_user_id, referral_code_used, xp_awarded_referrer, xp_awarded_referee, friend_theme_awarded_referrer, friend_theme_awarded_referee) VALUES (?, ?, ?, ?, 500, 500, ?, ?)`,
    args: [refId, referrerUserId, refereeUserId, cleanRef, referrerThemeAwarded, refereeThemeAwarded]
  });

  return {
    success: true,
    referrerUserId,
    refereeUserId,
    xpAwarded: 500,
    referrerThemeAwarded: Boolean(referrerThemeAwarded),
    refereeThemeAwarded: Boolean(refereeThemeAwarded)
  };
}



export async function saveUserFcmToken(userId: string, token: string): Promise<void> {
  if (isUsingLocalFallback) return; // Prevent saving in guest mode
  try {
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT INTO user_fcm_tokens (user_id, token, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP) 
            ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, updated_at = CURRENT_TIMESTAMP`,
      args: [userId, token]
    });
  } catch (err) {
    console.warn('[Turso DB] Failed to save FCM token:', err);
  }
}

export async function getUserFcmToken(userId: string): Promise<string | null> {
  if (isUsingLocalFallback) return null;
  try {
    const client = getTursoClient();
    const res = await client.execute({
      sql: `SELECT token FROM user_fcm_tokens WHERE user_id = ?`,
      args: [userId]
    });
    return res.rows.length > 0 ? String(res.rows[0].token) : null;
  } catch (err) {
    console.warn('[Turso DB] Failed to get FCM token:', err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// WATCH PARTY ROOM SERVER-SIDE TIMING & PERSISTENCE
// -----------------------------------------------------------------------------

export interface TursoWatchPartyRecord {
  party_id: string;
  host_uid: string;
  media_id: string;
  media_title: string;
  status: string;
  room_code?: string;
  started_at: number | null;
  is_playing: boolean;
  last_state_change_at: number | null;
  total_paused_duration: number;
  current_position: number;
  created_at?: string;
  updated_at?: string;
}

export async function syncTursoWatchPartyRoom(data: {
  partyId?: string;
  party_id?: string;
  hostUid?: string;
  hostUserId?: string;
  host_uid?: string;
  mediaId?: string;
  media_id?: string;
  mediaTitle?: string;
  media_title?: string;
  status?: string;
  roomCode?: string;
  room_code?: string;
  started_at?: number | null;
  startedAt?: number | null;
  is_playing?: boolean | number;
  isPlaying?: boolean | number;
  last_state_change_at?: number | null;
  lastStateChangeAt?: number | null;
  total_paused_duration?: number;
  totalPausedDuration?: number;
  current_position?: number;
  currentPosition?: number;
}): Promise<boolean> {
  return executeWithTursoFallback(async (client) => {
    try {
      const partyId = data.partyId || data.party_id || '';
      const hostUid = data.hostUid || data.hostUserId || data.host_uid || 'guest';
      const mediaId = data.mediaId || data.media_id || '';
      const mediaTitle = data.mediaTitle || data.media_title || 'Cinema Screening';
      const status = data.status || 'active';
      const roomCode = data.roomCode || data.room_code || null;
      const startedAt = (data.started_at !== undefined ? data.started_at : data.startedAt) ?? null;
      const rawPlaying = data.is_playing !== undefined ? data.is_playing : data.isPlaying;
      const isPlayingVal = rawPlaying ? 1 : 0;
      const lastStateChange = (data.last_state_change_at !== undefined ? data.last_state_change_at : data.lastStateChangeAt) ?? null;
      const totalPaused = (data.total_paused_duration !== undefined ? data.total_paused_duration : data.totalPausedDuration) ?? 0;
      const currentPos = (data.current_position !== undefined ? data.current_position : data.currentPosition) ?? 0;

      await client.execute({
        sql: `INSERT INTO watch_party_rooms (
                party_id, host_uid, media_id, media_title, status, room_code,
                started_at, is_playing, last_state_change_at, total_paused_duration, current_position, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(party_id) DO UPDATE SET
                status = COALESCE(excluded.status, watch_party_rooms.status),
                started_at = COALESCE(excluded.started_at, watch_party_rooms.started_at),
                is_playing = excluded.is_playing,
                last_state_change_at = COALESCE(excluded.last_state_change_at, watch_party_rooms.last_state_change_at),
                total_paused_duration = excluded.total_paused_duration,
                current_position = excluded.current_position,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          partyId,
          hostUid,
          mediaId,
          mediaTitle,
          status,
          roomCode,
          startedAt,
          isPlayingVal,
          lastStateChange,
          totalPaused,
          currentPos
        ]
      });
      return true;
    } catch (err) {
      console.warn('[Turso DB] Failed to sync watch party room:', err);
      return false;
    }
  });
}

export async function updateTursoWatchPartyPlayback(
  partyId: string,
  state: {
    started_at?: number | null;
    startedAt?: number | null;
    is_playing?: boolean | number;
    isPlaying?: boolean | number;
    last_state_change_at?: number | null;
    lastStateChangeAt?: number | null;
    total_paused_duration?: number;
    totalPausedDuration?: number;
    current_position?: number;
    currentPosition?: number;
  }
): Promise<boolean> {
  return executeWithTursoFallback(async (client) => {
    try {
      const rawPlaying = state.is_playing !== undefined ? state.is_playing : state.isPlaying;
      const isPlayingVal = rawPlaying ? 1 : 0;
      const startedAt = (state.started_at !== undefined ? state.started_at : state.startedAt) ?? null;
      const lastStateChange = (state.last_state_change_at !== undefined ? state.last_state_change_at : state.lastStateChangeAt) ?? null;
      const totalPaused = (state.total_paused_duration !== undefined ? state.total_paused_duration : state.totalPausedDuration) ?? 0;
      const currentPos = (state.current_position !== undefined ? state.current_position : state.currentPosition) ?? 0;

      await client.execute({
        sql: `UPDATE watch_party_rooms SET
                started_at = COALESCE(?, started_at),
                is_playing = ?,
                last_state_change_at = COALESCE(?, last_state_change_at),
                total_paused_duration = ?,
                current_position = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE party_id = ?`,
        args: [
          startedAt,
          isPlayingVal,
          lastStateChange,
          totalPaused,
          currentPos,
          partyId
        ]
      });
      return true;
    } catch (err) {
      console.warn('[Turso DB] Failed to update playback state:', err);
      return false;
    }
  });
}

export async function getTursoWatchPartyRoom(partyId: string): Promise<any | null> {
  return executeWithTursoFallback(async (client) => {
    try {
      const res = await client.execute({
        sql: `SELECT * FROM watch_party_rooms WHERE party_id = ?`,
        args: [partyId]
      });
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const isPlaying = Boolean(Number(row.is_playing) === 1);
      const currentPosition = Number(row.current_position || 0);
      const totalPausedDuration = Number(row.total_paused_duration || 0);
      const startedAt = row.started_at !== null && row.started_at !== undefined ? Number(row.started_at) : null;
      const lastStateChangeAt = row.last_state_change_at !== null && row.last_state_change_at !== undefined ? Number(row.last_state_change_at) : null;

      return {
        partyId: String(row.party_id),
        party_id: String(row.party_id),
        hostUid: String(row.host_uid),
        host_uid: String(row.host_uid),
        mediaId: String(row.media_id),
        media_id: String(row.media_id),
        mediaTitle: String(row.media_title),
        media_title: String(row.media_title),
        status: String(row.status || 'active'),
        roomCode: row.room_code ? String(row.room_code) : undefined,
        room_code: row.room_code ? String(row.room_code) : undefined,
        startedAt,
        started_at: startedAt,
        isPlaying,
        is_playing: isPlaying,
        lastStateChangeAt,
        last_state_change_at: lastStateChangeAt,
        totalPausedDuration,
        total_paused_duration: totalPausedDuration,
        currentPosition,
        current_position: currentPosition,
        createdAt: row.created_at ? String(row.created_at) : undefined,
        created_at: row.created_at ? String(row.created_at) : undefined,
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        updated_at: row.updated_at ? String(row.updated_at) : undefined
      };
    } catch (err) {
      console.warn('[Turso DB] Failed to get watch party room:', err);
      return null;
    }
  });
}

// -----------------------------------------------------------------------------
// ACHIEVEMENTS, PROGRESSION TIERS & WEEKLY CHALLENGES
// -----------------------------------------------------------------------------

export async function getTursoAchievements(userId: string): Promise<any[]> {
  return executeWithTursoFallback(async (client) => {
    try {
      const res = await client.execute({
        sql: `SELECT id, user_id, achievement_key, unlocked_at, tier FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC`,
        args: [userId]
      });
      return res.rows.map(r => ({
        id: String(r.id),
        userId: String(r.user_id),
        achievementKey: String(r.achievement_key),
        unlockedAt: String(r.unlocked_at),
        tier: Number(r.tier || 1)
      }));
    } catch (err) {
      console.warn('[Turso DB] Failed to fetch achievements for user:', userId, err);
      return [];
    }
  });
}

export async function unlockTursoAchievement(
  userId: string,
  achievementKey: string,
  tier: number = 1
): Promise<{ success: boolean; newlyUnlocked: boolean; achievement?: any }> {
  return executeWithTursoFallback(async (client) => {
    try {
      const id = `ach_${userId}_${achievementKey}`;
      const now = new Date().toISOString();
      
      // Concurrency-safe atomic upsert: inserts new achievement or preserves/upgrades tier on conflict
      const insertRes = await client.execute({
        sql: `INSERT INTO achievements (id, user_id, achievement_key, unlocked_at, tier)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(user_id, achievement_key) DO UPDATE SET tier = MAX(achievements.tier, excluded.tier)`,
        args: [id, userId, achievementKey, now, tier]
      });

      const wasNewlyInserted = (insertRes.rowsAffected ?? 0) > 0;

      // Fetch the canonical achievement row
      const selectRes = await client.execute({
        sql: `SELECT id, user_id, achievement_key, unlocked_at, tier FROM achievements WHERE user_id = ? AND achievement_key = ?`,
        args: [userId, achievementKey]
      });

      if (selectRes.rows.length > 0) {
        const row = selectRes.rows[0];
        return {
          success: true,
          newlyUnlocked: wasNewlyInserted,
          achievement: {
            id: String(row.id),
            userId: String(row.user_id),
            achievementKey: String(row.achievement_key),
            unlockedAt: String(row.unlocked_at),
            tier: Number(row.tier || 1)
          }
        };
      }

      return {
        success: true,
        newlyUnlocked: true,
        achievement: {
          id,
          userId,
          achievementKey,
          unlockedAt: now,
          tier
        }
      };
    } catch (err: any) {
      // Gracefully handle any collision or race condition without failing
      const errMsg = err?.message || '';
      if (errMsg.includes('UNIQUE constraint failed') || errMsg.includes('SQLITE_CONSTRAINT')) {
        try {
          const fallbackRes = await client.execute({
            sql: `SELECT id, user_id, achievement_key, unlocked_at, tier FROM achievements WHERE user_id = ? AND achievement_key = ?`,
            args: [userId, achievementKey]
          });
          if (fallbackRes.rows.length > 0) {
            const row = fallbackRes.rows[0];
            return {
              success: true,
              newlyUnlocked: false,
              achievement: {
                id: String(row.id),
                userId: String(row.user_id),
                achievementKey: String(row.achievement_key),
                unlockedAt: String(row.unlocked_at),
                tier: Number(row.tier || 1)
              }
            };
          }
        } catch {}
      }
      console.warn('[Turso DB] Failed to unlock achievement:', err);
      return { success: false, newlyUnlocked: false };
    }
  });
}

export async function getTursoTierProgress(userId: string): Promise<Record<string, { currentTier: number; progressValue: number }>> {
  return executeWithTursoFallback(async (client) => {
    try {
      const res = await client.execute({
        sql: `SELECT category, current_tier, progress_value FROM user_tier_progress WHERE user_id = ?`,
        args: [userId]
      });
      const result: Record<string, { currentTier: number; progressValue: number }> = {};
      for (const r of res.rows) {
        result[String(r.category)] = {
          currentTier: Number(r.current_tier || 1),
          progressValue: Number(r.progress_value || 0)
        };
      }
      return result;
    } catch (err) {
      console.warn('[Turso DB] Failed to get tier progress:', err);
      return {};
    }
  });
}

export async function syncTursoTierProgress(
  userId: string,
  category: string,
  currentTier: number,
  progressValue: number
): Promise<boolean> {
  return executeWithTursoFallback(async (client) => {
    try {
      await client.execute({
        sql: `INSERT INTO user_tier_progress (user_id, category, current_tier, progress_value, updated_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id, category) DO UPDATE SET
                current_tier = excluded.current_tier,
                progress_value = excluded.progress_value,
                updated_at = CURRENT_TIMESTAMP`,
        args: [userId, category, currentTier, progressValue]
      });
      return true;
    } catch (err) {
      console.warn('[Turso DB] Failed to sync tier progress:', err);
      return false;
    }
  });
}

export async function getTursoWeeklyChallenges(userId: string, isoWeek: string): Promise<any[]> {
  return executeWithTursoFallback(async (client) => {
    try {
      const res = await client.execute({
        sql: `SELECT id, user_id, iso_week, challenge_key, target, progress, completed, xp_reward, created_at, completed_at
              FROM weekly_challenges
              WHERE user_id = ? AND iso_week = ?
              ORDER BY created_at ASC`,
        args: [userId, isoWeek]
      });
      return res.rows.map(r => ({
        id: String(r.id),
        userId: String(r.user_id),
        isoWeek: String(r.iso_week),
        challengeKey: String(r.challenge_key),
        target: Number(r.target),
        progress: Number(r.progress || 0),
        completed: Boolean(Number(r.completed || 0) === 1),
        xpReward: Number(r.xp_reward),
        createdAt: r.created_at ? String(r.created_at) : undefined,
        completedAt: r.completed_at ? String(r.completed_at) : undefined
      }));
    } catch (err) {
      console.warn('[Turso DB] Failed to get weekly challenges:', err);
      return [];
    }
  });
}

export async function initTursoWeeklyChallenges(
  userId: string,
  isoWeek: string,
  challengeTemplates: Array<{ challengeKey: string; target: number; xpReward: number }>
): Promise<any[]> {
  return executeWithTursoFallback(async (client) => {
    try {
      // Check existing for this week
      const existing = await client.execute({
        sql: `SELECT id, user_id, iso_week, challenge_key, target, progress, completed, xp_reward, created_at, completed_at
              FROM weekly_challenges
              WHERE user_id = ? AND iso_week = ?`,
        args: [userId, isoWeek]
      });

      if (existing.rows.length > 0) {
        return existing.rows.map(r => ({
          id: String(r.id),
          userId: String(r.user_id),
          isoWeek: String(r.iso_week),
          challengeKey: String(r.challenge_key),
          target: Number(r.target),
          progress: Number(r.progress || 0),
          completed: Boolean(Number(r.completed || 0) === 1),
          xpReward: Number(r.xp_reward),
          createdAt: r.created_at ? String(r.created_at) : undefined,
          completedAt: r.completed_at ? String(r.completed_at) : undefined
        }));
      }

      // Insert deterministic challenges for user
      const inserted: any[] = [];
      for (const t of challengeTemplates) {
        const id = `wc_${userId}_${isoWeek}_${t.challengeKey}`;
        await client.execute({
          sql: `INSERT OR IGNORE INTO weekly_challenges (id, user_id, iso_week, challenge_key, target, progress, completed, xp_reward)
                VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
          args: [id, userId, isoWeek, t.challengeKey, t.target, t.xpReward]
        });
        inserted.push({
          id,
          userId,
          isoWeek,
          challengeKey: t.challengeKey,
          target: t.target,
          progress: 0,
          completed: false,
          xpReward: t.xpReward
        });
      }

      return inserted;
    } catch (err) {
      console.warn('[Turso DB] Failed to initialize weekly challenges:', err);
      return [];
    }
  });
}

export async function updateTursoWeeklyChallengeProgress(
  userId: string,
  isoWeek: string,
  challengeKey: string,
  progressDelta?: number,
  absoluteProgress?: number
): Promise<{ success: boolean; newlyCompleted: boolean; challenge?: any }> {
  return executeWithTursoFallback(async (client) => {
    try {
      const res = await client.execute({
        sql: `SELECT id, target, progress, completed, xp_reward FROM weekly_challenges WHERE user_id = ? AND iso_week = ? AND challenge_key = ?`,
        args: [userId, isoWeek, challengeKey]
      });

      if (res.rows.length === 0) {
        return { success: false, newlyCompleted: false };
      }

      const row = res.rows[0];
      const target = Number(row.target);
      const prevProgress = Number(row.progress || 0);
      const isAlreadyCompleted = Number(row.completed || 0) === 1;
      const xpReward = Number(row.xp_reward);

      let newProgress = prevProgress;
      if (typeof absoluteProgress === 'number') {
        newProgress = Math.max(prevProgress, absoluteProgress);
      } else if (typeof progressDelta === 'number') {
        newProgress = prevProgress + progressDelta;
      }

      const newlyCompleted = !isAlreadyCompleted && newProgress >= target;
      const completedFlag = isAlreadyCompleted || newlyCompleted ? 1 : 0;
      const completedAt = newlyCompleted ? new Date().toISOString() : null;

      if (completedAt) {
        await client.execute({
          sql: `UPDATE weekly_challenges SET progress = ?, completed = ?, completed_at = ? WHERE id = ?`,
          args: [newProgress, completedFlag, completedAt, String(row.id)]
        });
      } else {
        await client.execute({
          sql: `UPDATE weekly_challenges SET progress = ? WHERE id = ?`,
          args: [newProgress, String(row.id)]
        });
      }

      return {
        success: true,
        newlyCompleted,
        challenge: {
          id: String(row.id),
          userId,
          isoWeek,
          challengeKey,
          target,
          progress: newProgress,
          completed: Boolean(completedFlag === 1),
          xpReward,
          completedAt
        }
      };
    } catch (err) {
      console.warn('[Turso DB] Failed to update challenge progress:', err);
      return { success: false, newlyCompleted: false };
    }
  });
}

// -----------------------------------------------------------------------------
// LEADERBOARD CACHE SYSTEM (QUOTA-EFFICIENT PRECOMPUTED HALL OF FAME)
// -----------------------------------------------------------------------------

export interface RankLadderResult {
  rank_tier: string;
  rank_sub: number | null;
}

/**
 * Maps a user's level or XP to their cinema prestige title / rank:
 * - Levels 1-499: maps to canonical title (Movie Rookie, Casual Viewer, ..., Cinema Legend)
 * - Level 500+ (5M+ XP): maps to official rank system (Bronze I ... Legendary III, MASTER)
 */
export function getRankLadder(level: number, xp?: number): RankLadderResult {
  const currentXp = typeof xp === 'number' ? xp : level * 10000;
  if (currentXp >= 5000000 || level >= 500) {
    const rankInfo = calculateRankInfo(currentXp);
    return {
      rank_tier: rankInfo.label || rankInfo.tier || 'Bronze I',
      rank_sub: rankInfo.subRank
    };
  }
  const title = getLevelTitle(level);
  return {
    rank_tier: title,
    rank_sub: null
  };
}

/**
 * Synchronize real users from Firestore or external auth into Turso, strictly excluding guest or fake test accounts
 */
export async function syncExternalRealUsersToTurso(users: Array<{
  userId: string;
  username: string;
  avatarUrl?: string;
  xp?: number;
  level?: number;
  tier?: string;
  watchSeconds?: number;
  currentStreak?: number;
  streakPenalty?: number;
}>): Promise<number> {
  return executeWithTursoFallback(async (client) => {
    let synced = 0;
    for (const u of users) {
      const id = (u.userId || '').trim();
      const name = (u.username || '').trim();
      const lowerName = name.toLowerCase();

      // Filter out test, guest, or placeholder users
      if (
        !id ||
        id === 'guest' ||
        id.startsWith('test_') ||
        id.startsWith('FK-') ||
        id === 'admin-master' ||
        id === 'usr_testgmailcom' ||
        id === 'usr_gjonigamilcom' ||
        id === 'goldprince_studio' ||
        lowerName.includes('guest') ||
        lowerName.includes('test cinephile')
      ) {
        continue;
      }

      const finalXp = Number(u.xp || 0);
      const finalLevel = Number(u.level || 1);
      const finalWatchSec = Number(u.watchSeconds || 0);
      const finalStreak = Number(u.currentStreak || 0);
      const avatar = u.avatarUrl && u.avatarUrl.trim().length > 0
        ? u.avatarUrl
        : `https://api.dicebear.com/7.x/open-peeps/svg?seed=${id}`;

      await client.execute({
        sql: `INSERT INTO user_profiles (user_id, username, avatar, tier, total_watch_seconds, current_streak, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                avatar = excluded.avatar,
                tier = excluded.tier,
                total_watch_seconds = excluded.total_watch_seconds,
                current_streak = excluded.current_streak,
                updated_at = CURRENT_TIMESTAMP;`,
        args: [id, name, avatar, u.tier || 'BRONZE', finalWatchSec, finalStreak]
      });

      await client.execute({
        sql: `INSERT INTO user_xp (user_id, xp, level, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET
                xp = MAX(user_xp.xp, excluded.xp),
                level = MAX(user_xp.level, excluded.level),
                updated_at = CURRENT_TIMESTAMP;`,
        args: [id, finalXp, finalLevel]
      });

      synced++;
    }
    return synced;
  });
}

/**
 * Automatically audits and expires streaks for accounts that missed opening their account for 24h+ (>1 calendar day).
 * A streak is valid ONLY if the user was active today or yesterday.
 * If last_active_date is null or older than yesterday (diffDays > 1), streak is lost (resets to 0).
 */
export async function expireInactiveStreaks(clientInstance?: any) {
  const client = clientInstance || getTursoClient();
  const now = new Date();
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  try {
    const resProfiles = await client.execute({
      sql: `UPDATE user_profiles 
            SET current_streak = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE current_streak > 0 
              AND (last_active_date IS NULL OR last_active_date < ?);`,
      args: [yesterday]
    });

    const resUsers = await client.execute({
      sql: `UPDATE users 
            SET current_streak = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE current_streak > 0 
              AND (last_active_date IS NULL OR last_active_date < ?);`,
      args: [yesterday]
    });

    return {
      yesterday,
      profilesReset: resProfiles.rowsAffected || 0,
      usersReset: resUsers.rowsAffected || 0
    };
  } catch (err) {
    console.error('[Turso DB] Error expiring inactive streaks:', err);
    return { yesterday, profilesReset: 0, usersReset: 0 };
  }
}

/**
 * Daily Refresh Job:
 * 1. Automatically audit & expire inactive streaks (> 24h missed)
 * 2. Query existing cache to track previous ranks
 * 3. Calculate real Points for each user:
 *    - XP contribution: XP / 500
 *    - Watch-time contribution: 100 Points per 1 hour watched (watch_seconds / 3600 * 100)
 *    - Daily streak contribution: 50 Points per streak day (current_streak * 50)
 *    - Streak penalty: -500 if streak broken / lost
 * 4. Sort users strictly by Points DESC
 * 5. Persist rank movement (↑ X, ↓ X, —, NEW)
 */
export async function refreshLeaderboardCache(): Promise<{ count: number; computed_at: string }> {
  return executeWithTursoFallback(async (client) => {
    // 0. Automatically audit and expire any streak where user was inactive for 24h+ (> 1 day)
    await expireInactiveStreaks(client);

    // 1. Snapshot previous ranks for persistent movement calculation
    const prevRankMap = new Map<string, number>();
    try {
      const prevRes = await client.execute(`SELECT user_id, rank FROM leaderboard_cache;`);
      for (const r of prevRes.rows) {
        if (r.user_id) {
          prevRankMap.set(String(r.user_id), Number(r.rank));
        }
      }
    } catch (_err) {}

    // 2. Query real users with real watch-time and streak data
    const topUsersRes = await client.execute(`
      SELECT 
        p.user_id,
        COALESCE(p.username, 'Cinema Member') AS username,
        COALESCE(p.avatar, '') AS avatar_url,
        COALESCE(x.xp, 0) AS xp,
        COALESCE(x.level, 1) AS level,
        COALESCE(p.total_watch_seconds, 0) AS watch_seconds,
        COALESCE(p.current_streak, 0) AS current_streak,
        p.last_active_date,
        u.last_active_date AS user_last_active,
        COALESCE(a.ach_count, 0) AS unlocked_achievements_count,
        p.created_at
      FROM user_profiles p
      LEFT JOIN user_xp x ON p.user_id = x.user_id
      LEFT JOIN users u ON p.user_id = u.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS ach_count 
        FROM achievements 
        GROUP BY user_id
      ) a ON p.user_id = a.user_id
      WHERE p.user_id != 'guest'
        AND p.user_id NOT LIKE 'test_%'
        AND p.user_id NOT LIKE 'usr_test%'
        AND p.user_id != 'usr_gjonigamilcom'
        AND p.user_id != 'admin-master'
        AND p.user_id != 'goldprince_studio'
        AND p.user_id NOT LIKE 'FK-%'
        AND LOWER(p.username) NOT LIKE '%guest%'
        AND LOWER(p.username) NOT LIKE '%test cinephile%'
      LIMIT 100;
    `);

    const computedAt = new Date().toISOString();
    const today = computedAt.split('T')[0];

    // 3. Compute Points for each candidate
    const calculatedUsers = topUsersRes.rows.map((row) => {
      const xpNum = Number(row.xp || 0);
      const watchSec = Number(row.watch_seconds || 0);
      const achCount = Number(row.unlocked_achievements_count || 0);
      
      const lastActiveStr = (row.last_active_date || row.user_last_active) as string | null;
      let streakDays = 0;

      if (lastActiveStr) {
        const [y1, m1, d1] = lastActiveStr.split('-').map(Number);
        const [y2, m2, d2] = today.split('-').map(Number);
        if (!isNaN(y1) && !isNaN(m1) && !isNaN(d1)) {
          const utc1 = Date.UTC(y1, m1 - 1, d1);
          const utc2 = Date.UTC(y2, m2 - 1, d2);
          const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
          // If active today (0) or active yesterday (1, within 24h grace window)
          if (diffDays <= 1 && diffDays >= 0) {
            streakDays = Number(row.current_streak || 0);
          } else {
            streakDays = 0;
          }
        }
      } else {
        streakDays = 0;
      }
      
      const xpPoints = Math.round(xpNum / 500);
      const watchPoints = Math.round((watchSec / 3600) * 100);
      const streakPoints = streakDays * 50;
      const achievementPoints = achCount * 55;
      const streakPenalty = 0; // 500 deducted when streak broke

      // Rank Prestige Points (Level 500+ / 5,000,000+ XP)
      // 19 prestige rank tiers (Bronze I to MASTER). Each unlocked prestige rank step grants 100 points.
      const rankSteps = xpNum >= 5000000 ? Math.min(19, 1 + Math.floor((xpNum - 5000000) / 10000)) : 0;
      const rankPoints = rankSteps * 100;

      const totalPoints = Math.max(0, Math.round(xpPoints + watchPoints + streakPoints + achievementPoints + rankPoints - streakPenalty));
      const levelNum = calculateLevelFromXp(xpNum);
      const ladder = getRankLadder(levelNum, xpNum);
      const rawAvatar = String(row.avatar_url || '');
      const avatar = rawAvatar && rawAvatar.trim().length > 0
        ? rawAvatar
        : `https://api.dicebear.com/7.x/open-peeps/svg?seed=${row.user_id}`;

      return {
        user_id: String(row.user_id),
        username: String(row.username || 'Cinema Member'),
        avatar_url: avatar,
        level: levelNum,
        xp: xpNum,
        points: totalPoints,
        watch_seconds: watchSec,
        current_streak: streakDays,
        streak_penalty: streakPenalty,
        unlocked_achievements_count: achCount,
        rank_tier: ladder.rank_tier,
        rank_sub: ladder.rank_sub,
        created_at: String(row.created_at || '')
      };
    });

    // 4. Sort strictly by POINTS DESC, then XP DESC
    calculatedUsers.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return a.user_id.localeCompare(b.user_id);
    });

    // 5. Assign new ranks & calculate real movement
    const rankedRows = calculatedUsers.map((u, idx) => {
      const newRank = idx + 1;
      const prevRank = prevRankMap.has(u.user_id) ? prevRankMap.get(u.user_id)! : null;
      // rankDelta > 0 means moved UP (e.g. was 7, now 4 -> +3)
      const rankDelta = prevRank !== null ? (prevRank - newRank) : 0;

      return {
        rank: newRank,
        previous_rank: prevRank,
        rank_delta: rankDelta,
        ...u,
        computed_at: computedAt
      };
    });

    // 6. Bulk atomic replace in leaderboard_cache
    const statements: any[] = [
      { sql: `DELETE FROM leaderboard_cache;`, args: [] }
    ];

    for (const r of rankedRows) {
      statements.push({
        sql: `INSERT INTO leaderboard_cache (rank, previous_rank, rank_delta, user_id, username, avatar_url, level, xp, points, watch_seconds, current_streak, streak_penalty, rank_tier, rank_sub, computed_at, unlocked_achievements_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          r.rank,
          r.previous_rank,
          r.rank_delta,
          r.user_id,
          r.username,
          r.avatar_url,
          r.level,
          r.xp,
          r.points,
          r.watch_seconds,
          r.current_streak,
          r.streak_penalty,
          r.rank_tier,
          r.rank_sub,
          r.computed_at,
          r.unlocked_achievements_count
        ]
      });
    }

    if (statements.length > 0) {
      await client.batch(statements, 'write');
    }

    console.log(`[Leaderboard] Successfully refreshed point-based leaderboard cache with ${rankedRows.length} real users at ${computedAt}`);
    return { count: rankedRows.length, computed_at: computedAt };
  });
}

/**
 * Fetch Top 50 from cached leaderboard (points-ranked)
 */
export async function getCachedLeaderboard(limit = 50) {
  return executeWithTursoFallback(async (client) => {
    const countCheck = await client.execute(`SELECT COUNT(*) as cnt, MAX(computed_at) as latest_comp FROM leaderboard_cache;`);
    const count = Number(countCheck.rows[0]?.cnt || 0);
    let computedAt = countCheck.rows[0]?.latest_comp ? String(countCheck.rows[0].latest_comp) : '';

    if (count === 0) {
      const ref = await refreshLeaderboardCache();
      computedAt = ref.computed_at;
    }

    const res = await client.execute({
      sql: `SELECT rank, previous_rank, rank_delta, user_id, username, avatar_url, level, xp, points, watch_seconds, current_streak, streak_penalty, rank_tier, rank_sub, computed_at, unlocked_achievements_count
            FROM leaderboard_cache
            ORDER BY rank ASC
            LIMIT ?;`,
      args: [Math.min(limit, 50)]
    });

    if (res.rows.length > 0 && !computedAt) {
      computedAt = String(res.rows[0].computed_at);
    }

    return {
      leaderboard: res.rows.map(row => {
        const xpNum = Number(row.xp || 0);
        const watchSec = Number(row.watch_seconds || 0);
        const streak = Number(row.current_streak || 0);
        const penalty = Number(row.streak_penalty || 0);
        const achCount = Number(row.unlocked_achievements_count || 0);
        const rankSteps = xpNum >= 5000000 ? Math.min(19, 1 + Math.floor((xpNum - 5000000) / 10000)) : 0;
        const rankPoints = rankSteps * 100;
        const calcPoints = Number(row.points) || Math.max(0, Math.round(xpNum / 500 + (watchSec / 3600) * 100 + streak * 50 + achCount * 55 + rankPoints - penalty));

        return {
          rank: Number(row.rank),
          previous_rank: row.previous_rank !== null && row.previous_rank !== undefined ? Number(row.previous_rank) : null,
          rank_delta: Number(row.rank_delta || 0),
          user_id: String(row.user_id),
          username: String(row.username),
          avatar_url: String(row.avatar_url || ''),
          level: Number(row.level),
          xp: xpNum,
          points: calcPoints,
          watch_seconds: watchSec,
          current_streak: streak,
          streak_penalty: penalty,
          unlocked_achievements_count: achCount,
          rank_tier: String(row.rank_tier),
          rank_sub: row.rank_sub !== null && row.rank_sub !== undefined ? Number(row.rank_sub) : null
        };
      }),
      computed_at: computedAt || new Date().toISOString()
    };
  });
}

/**
 * Lightweight endpoint lookup for current user rank and points:
 */
export async function getUserLeaderboardRank(userId: string) {
  return executeWithTursoFallback(async (client) => {
    // 1. Single row lookup in leaderboard_cache
    const cacheRes = await client.execute({
      sql: `SELECT rank, previous_rank, rank_delta, user_id, username, avatar_url, level, xp, points, watch_seconds, current_streak, streak_penalty, rank_tier, rank_sub, computed_at, unlocked_achievements_count
            FROM leaderboard_cache
            WHERE user_id = ?
            LIMIT 1;`,
      args: [userId]
    });

    if (cacheRes.rows.length > 0) {
      const row = cacheRes.rows[0];
      const rank = Number(row.rank);
      const xpNum = Number(row.xp || 0);
      const watchSec = Number(row.watch_seconds || 0);
      const streak = Number(row.current_streak || 0);
      const penalty = Number(row.streak_penalty || 0);
      const achCount = Number(row.unlocked_achievements_count || 0);
      const rankSteps = xpNum >= 5000000 ? Math.min(19, 1 + Math.floor((xpNum - 5000000) / 10000)) : 0;
      const rankPoints = rankSteps * 100;
      const points = Number(row.points) || Math.max(0, Math.round(xpNum / 500 + (watchSec / 3600) * 100 + streak * 50 + achCount * 55 + rankPoints - penalty));

      return {
        rank,
        previous_rank: row.previous_rank !== null && row.previous_rank !== undefined ? Number(row.previous_rank) : null,
        rank_delta: Number(row.rank_delta || 0),
        user_id: String(row.user_id),
        username: String(row.username),
        avatar_url: String(row.avatar_url || ''),
        level: Number(row.level),
        xp: xpNum,
        points,
        watch_seconds: watchSec,
        current_streak: streak,
        streak_penalty: penalty,
        unlocked_achievements_count: achCount,
        rank_tier: String(row.rank_tier),
        rank_sub: row.rank_sub !== null && row.rank_sub !== undefined ? Number(row.rank_sub) : null,
        in_top_50: rank <= 50,
        in_top_100: true,
        computed_at: String(row.computed_at)
      };
    }

    // 2. If not in top 100 cache -> single row lookup in user_profiles & user_xp & achievements
    const userRes = await client.execute({
      sql: `SELECT p.user_id, p.username, p.avatar, COALESCE(x.xp, 0) as xp, COALESCE(x.level, 1) as level, COALESCE(p.total_watch_seconds, 0) as watch_seconds, COALESCE(p.current_streak, 0) as current_streak, p.last_active_date, u.last_active_date as user_last_active, COALESCE(a.ach_count, 0) as unlocked_achievements_count
            FROM user_profiles p
            LEFT JOIN user_xp x ON p.user_id = x.user_id
            LEFT JOIN users u ON p.user_id = u.user_id
            LEFT JOIN (
              SELECT user_id, COUNT(*) AS ach_count 
              FROM achievements 
              WHERE user_id = ?
            ) a ON p.user_id = a.user_id
            WHERE p.user_id = ?
            LIMIT 1;`,
      args: [userId, userId]
    });

    if (userRes.rows.length === 0) {
      return null;
    }

    const uRow = userRes.rows[0];
    const xp = Number(uRow.xp || 0);
    const watchSec = Number(uRow.watch_seconds || 0);
    const rawStreak = Number(uRow.current_streak || 0);
    const today = new Date().toISOString().split('T')[0];
    const lastActiveStr = (uRow.last_active_date || uRow.user_last_active) as string | null;
    let streak = 0;

    if (lastActiveStr) {
      const [y1, m1, d1] = lastActiveStr.split('-').map(Number);
      const [y2, m2, d2] = today.split('-').map(Number);
      if (!isNaN(y1) && !isNaN(m1) && !isNaN(d1)) {
        const utc1 = Date.UTC(y1, m1 - 1, d1);
        const utc2 = Date.UTC(y2, m2 - 1, d2);
        const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1 && diffDays >= 0) {
          streak = rawStreak;
        }
      }
    }

    const achCount = Number(uRow.unlocked_achievements_count || 0);
    const penalty = 0;
    const rankSteps = xp >= 5000000 ? Math.min(19, 1 + Math.floor((xp - 5000000) / 10000)) : 0;
    const rankPoints = rankSteps * 100;
    const points = Math.max(0, Math.round(xp / 500 + (watchSec / 3600) * 100 + streak * 50 + achCount * 55 + rankPoints - penalty));
    const level = calculateLevelFromXp(xp);
    const ladder = getRankLadder(level, xp);

    // Indexed count of users with higher points
    const countRes = await client.execute({
      sql: `SELECT COUNT(*) as higher_count 
            FROM leaderboard_cache
            WHERE points > ?;`,
      args: [points]
    });
    const rank = Number(countRes.rows[0]?.higher_count || 0) + 1;

    return {
      rank,
      previous_rank: null,
      rank_delta: 0,
      user_id: String(uRow.user_id),
      username: String(uRow.username || 'Cinema Member'),
      avatar_url: String(uRow.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${userId}`),
      level,
      xp,
      points,
      watch_seconds: watchSec,
      current_streak: streak,
      streak_penalty: penalty,
      unlocked_achievements_count: achCount,
      rank_tier: ladder.rank_tier,
      rank_sub: ladder.rank_sub,
      in_top_50: false,
      in_top_100: false,
      computed_at: new Date().toISOString()
    };
  });
}


