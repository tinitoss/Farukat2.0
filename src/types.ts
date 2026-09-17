export type MediaCategory =
  | 'all'
  | 'series'
  | 'movie'
  | 'horror'
  | 'scifi'
  | 'behind'
  | 'deleted'
  | 'skits'
  | 'specials'
  | 'music';

export interface Episode {
  id: string;
  episodeNumber: number;
  seasonNumber?: number;
  title: string;
  title_sq?: string;
  thumbnail: string;
  videoUrl: string;
  rating: string;
  duration: string;
  description: string;
  description_sq?: string;
  channel?: string;
  views?: string;
  timeAgo?: string;
  isNew?: boolean;
}

export interface MediaItem {
  id: string;
  title: string;
  title_sq?: string;
  originalSection: string;
  category: MediaCategory;
  rating: string;
  year: string;
  duration: string;
  description: string;
  description_sq?: string;
  tags: string[];
  isSeries: boolean;
  thumbnail: string;
  poster: string;
  backdrop: string;
  backdropImageUrl?: string; // 16:9 Wide Backdrop image for Hero Banner
  posterImageUrl?: string;   // 9:16 Portrait Poster image for thumbnail card
  videoUrl: string;
  episodes?: Episode[];
  cast?: string[];
  director?: string;
  quality?: string;
  ageRating?: string;
  audioLanguage?: string;
  featured?: boolean;
  trendingRank?: number;
  matchScore?: number;
  isNew?: boolean;
  isHidden?: boolean;
  sagaId?: string;
}

export interface SoundtrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  audioUrl?: string;
  videoUrl?: string;
  cover: string;
  year: string;
  genre: string;
  associatedMovie: string;
  description: string;
  synthPreset?: string;
}

export interface WatchProgress {
  mediaId: string;
  episodeId?: string;
  currentTime: number;
  duration: number;
  lastWatchedAt: number;
  completed: boolean;
  mediaTitle: string;
  mediaThumbnail: string;
  episodeTitle?: string;
}

export interface UserReview {
  id: string;
  mediaId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type ActiveTab = 'home' | 'series' | 'movies' | 'behind-scenes' | 'my-list' | 'membership' | 'achievements' | 'leaderboard' | 'history' | 'settings' | 'admin';

export type MembershipTier =
  | 'STANDARD'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | 'OBSIDIAN'
  | 'GRANDMASTER'
  | 'PRO_VIP';

export type CardTheme =
  // General Finishes
  | 'ivory-gold' // Classic Gold Foil (Level 1)
  | 'obsidian-gold' // Dark Obsidian Finish (Level 3)
  | 'cinephile-platinum' // Cinephile Platinum (Level 6)
  | 'crimson-ruby' // Crimson Velvet Chrome (Level 9)
  | 'cyber-hologram' // Holographic Cyber Prism (Level 13)
  | 'time-lord-diamond' // Time Lord Diamond (Level 17)
  // Show-Inspired Editions
  | 'bts-edition' // Behind the Scenes Edition (Level 5)
  | 'detektivi-edition' // Detektivi Edition (Level 8)
  | 'toolate-edition' // TooLate Edition (Level 12)
  | 'horror-24m-edition' // 24M Edition (Level 16)
  | 'scifi-universe-edition' // Sci-Fi Universe Edition (Level 20)
  | 'baba-ramiz-edition' // Baba Ramiz Edition (Level 25)
  | 'goldprince-era' // The GoldPrince Era (Level 40)
  | 'alttprince-era' // AlttPrince Era (Level 33)
  | 'farukat-era' // FARUKAT Era (Level 55)
  | 'dardi-ladi-edition'; // Dardi & Ladi Edition (Achievement)

export type CardStatus = 'Active' | 'Suspended' | 'Expired' | 'Deactivated';

export interface CardHistoryItem {
  id: string;
  date: string;
  event: string;
  status: CardStatus;
}



export interface UserProfile {
  name: string;
  avatarUrl: string;
  memberId: string;
  cardNumber: string; // Permanent unique card number like BORA-8F42-19C7 or FK-9482-7319
  memberSince: string;
  tier: MembershipTier;
  cardTheme: CardTheme;
  status: CardStatus;
  discoverableByCardNumber: boolean;
  isPublicProfile: boolean;
  isProMember?: boolean;
  isPro?: boolean;
  bio?: string;
  email?: string;
  role?: string;
  signatureUrl?: string;
  cardHistory?: CardHistoryItem[];
}

export interface EquippedCosmetics {
  titleColor?: string;
  crown?: string;
  frame?: string;
  theme?: string;
  [key: string]: string | undefined;
}

export interface PublicMemberProfile {
  cardNumber: string;
  name: string;
  avatarUrl: string;
  tier: MembershipTier;
  level: number;
  lifetimeXp: number;
  memberSince: string;
  status: CardStatus;
  isOfficial?: boolean;
  isProMember?: boolean;
  isPro?: boolean;
  badge?: string;
  bio?: string;
  equippedCosmetics?: EquippedCosmetics;
  followersCount: number;
  followingCount: number;
  emailMasked?: string;
  isPublicProfile?: boolean;
  cardTheme?: CardTheme;
  totalWatchSeconds?: number;
  ratingsGiven?: number;
  signatureUrl?: string;
  userId?: string;
  ownedCards?: string[];
  ownedCosmetics?: string[];
}

export interface CommentItem {
  id: string;
  mediaId: string;
  episodeId?: string;
  authorName: string;
  authorCardNumber: string;
  authorAvatar: string;
  authorTier: MembershipTier;
  authorLevel: number;
  authorIsPro?: boolean;
  userId?: string;
  text: string;
  createdAt: number;
  likesCount: number;
  userLiked?: boolean;
  replies?: CommentItem[];
}

export interface UserPlaylist {
  id: string;
  title: string;
  description?: string;
  mediaIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MarketAsset {
  ticker: string;
  currentPrice: number;
  [key: string]: any;
}

export type XpCategory =
  | 'watch_time'
  | 'completion'
  | 'daily_login'
  | 'watchlist'
  | 'rating'
  | 'profile'
  | 'share'
  | 'download'
  | 'engagement'
  | 'community'
  | 'perk_redemption'
  | 'bonus';

export interface XpTransaction {
  id: string;
  amount: number;
  type: 'earned' | 'spent';
  reason: string;
  category: XpCategory;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface UserStats {
  totalWatchSeconds: number;
  totalWatchMinutes?: number;
  totalWatchHours?: number;
  titlesWatched: string[];
  episodesCompleted: number;
  ratingsGiven: number;
  watchlistCount: number;
  downloadsCount: number;
  dailyLoginDates: string[];
  currentStreak: number;
  lastLoginDate: string;
  lastActiveDate?: string;
  longestStreak?: number;
  streakMilestonesClaimed?: number[];
  profileCompleted: boolean;
  sharesCount: number;
  ratedMediaIds?: string[];
  watchlistMediaIds?: string[];
  dailyWatchXpDate?: string;
  dailyWatchXpEarned?: number;
  reviewsCount?: number;
  publishedMediaIds?: string[];
  followedUserIds?: string[];
  followersUserIds?: string[];
  createdPlaylistIds?: string[];
  totalLikesReceived?: number;
  hideRatingsPublicly?: boolean;
  hideContinueWatching?: boolean;
  enableXpPopups?: boolean;
  enableStreakReminders?: boolean;
  enableHaptics?: boolean;
  enableHighContrast?: boolean;
  enableLightMode?: boolean;
  enableCinematicAudio?: boolean;
  compactCatalogView?: boolean;
  enableSmartRecommendations?: boolean;
  hideWatchParty?: boolean;
  watchPartyEnabled?: boolean;
  autoSaveWatchPartyReplays?: boolean;
  hideHistory?: boolean;
  // Notifications
  enablePushNotifications?: boolean;
  notificationsEnabled?: boolean;
  notifyWatchParty?: boolean;
  notifySocial?: boolean;
  notifyStreaks?: boolean;
  watchPartiesCount?: number;
  notifyNewReleases?: boolean;
  notifyAchievements?: boolean;
  notifyMarketAlerts?: boolean;
  optionalNotificationsEnabled?: boolean;
  essentialNotificationsEnabled?: boolean;
}

export type RankTierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Legendary' | 'MASTER';

export interface LevelInfo {
  level: number;
  title: string;
  tier: MembershipTier;
  minXp: number;
  nextLevelXp: number;
  currentLevelBaseXp: number;
  xpNeededForNext: number;
  xpEarnedInCurrentLevel: number;
  progressPercent: number;
  perkUnlocked: string;
  // Rank system (active after reaching Level 500 hard cap)
  isRanked?: boolean;
  rankTier?: RankTierName | null;
  rankSub?: number | null;
  rankLabel?: string | null;
  nextRankLabel?: string | null;
  isMaster?: boolean;
}

export interface WeeklyXpRecord {
  weekId: string;
  xpEarned: number;
  lastCalculatedAt: number;
}

export interface XpAccount {
  userId?: string;
  currentXp: number;
  lifetimeXp: number;
  currentLevel: number;
  xpSpentTotal: number;
  ownedCosmetics?: string[];
  ownedCards?: string[];
  equippedCosmetics?: EquippedCosmetics;
  profile: UserProfile;
  stats: UserStats;
  transactions: XpTransaction[];
  unlockedAchievements?: string[];
  hasJoinedWatchParty?: boolean;
  weeklyQuestsWeekId?: string;
  weeklyXp?: WeeklyXpRecord;
}



export interface PerkItem {
  id: string;
  name: string;
  description: string;
  costXp: number;
  icon: string;
  type: 'card_theme' | 'theater_perk' | 'vip_badge' | 'early_access';
  themeId?: CardTheme;
  unlocked: boolean;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementKey: string;
  unlockedAt: string;
  tier: number;
}

export interface UserTierProgress {
  userId: string;
  category: 'watch_time' | 'genre_exploration' | 'social_likes' | 'day_streak';
  currentTier: number;
  progressValue: number;
  updatedAt?: string;
}

export interface WeeklyChallengeItem {
  id: string;
  userId: string;
  isoWeek: string;
  challengeKey: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  xpReward: number;
  iconName: string;
  createdAt?: string;
  completedAt?: string;
}

export type NotificationCategory = 'social' | 'achievements' | 'watching' | 'progression' | 'system';
export type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';
export type NotificationTargetType = 'video_player' | 'media_detail' | 'achievements' | 'leaderboard' | 'membership' | 'none';

export interface InAppNotificationActionPayload {
  contentId?: string;
  commentId?: string;
  parentCommentId?: string;
  episodeId?: string;
  partyId?: string;
  actorUserId?: string;
  actorUsername?: string;
  actorAvatar?: string;
  parentCommentSnippet?: string;
  mediaTitle?: string;
  mediaPoster?: string;
  achievementKey?: string;
  xpReward?: number;
  newLevel?: number;
  newTier?: string;
  currentStreak?: number;
}

export interface InAppNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetId: string;
  actionPayload?: InAppNotificationActionPayload;
  groupKey?: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

