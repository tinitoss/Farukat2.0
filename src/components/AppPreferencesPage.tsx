import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Settings as SettingsIcon, 
  Shield, 
  EyeOff, 
  User, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Smartphone, 
  Contrast, 
  Sun, 
  RefreshCw, 
  Sliders, 
  Volume2, 
  LayoutGrid, 
  History, 
  Sparkles, 
  Users, 
  Download,
  FileText,
  ChevronRight,
  Database,
  Bell,
  Award,
  MessageCircle,
  Flame,
  X,
  HardDrive,
  KeyRound,
  Lock,
  Globe
} from 'lucide-react';
import { XpAccount } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';
import { saveXpAccount, calculateLevelInfo } from '../utils/xpSystem';
import { syncCurrentUserToDirectory } from '../utils/memberSystem';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { StorageCacheModal } from './StorageCacheModal';
import { CloudSqlWatchPartyAuditView } from './CloudSqlWatchPartyAuditView';
import { PWAInstallButton } from './PWAInstallButton';
import { exportUserData, deleteUserAccount } from '../utils/privacyActions';
import { clearWatchHistory, getActiveUserId } from '../utils/mediaUtils';
import { auth } from '../firebase';
import {
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';

interface SettingsViewProps {
  account: XpAccount;
  onUpdateAccount: (updated: XpAccount) => void;
  onSignOut: () => void;
  isGuest?: boolean;
}

interface SettingRowProps {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  caption?: string;
  action: React.ReactNode;
  isDestructive?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = React.memo(({
  id,
  icon,
  title,
  caption,
  action,
  isDestructive,
}) => (
  <div
    id={id}
    className="px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 text-left transition-colors"
  >
    <div className="flex items-center gap-3 min-w-0 pr-2">
      {icon && (
        <div className={`shrink-0 ${isDestructive ? 'text-red-400' : 'text-neutral-400'}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium tracking-tight truncate ${isDestructive ? 'text-red-400 font-semibold' : 'text-[var(--text-primary)]'}`}>
          {title}
        </p>
        {caption && (
          <p className="text-xs text-[var(--text-secondary)] tracking-tight line-clamp-1 opacity-80 mt-0.5">
            {caption}
          </p>
        )}
      </div>
    </div>
    <div className="shrink-0 flex items-center">
      {action}
    </div>
  </div>
));

const SettingsGroup: React.FC<{
  label: string;
  children: React.ReactNode;
}> = React.memo(({ label, children }) => (
  <section className="space-y-2">
    <h2 className="text-[11px] font-mono font-semibold tracking-wider text-neutral-400 uppercase px-1 select-none">
      {label}
    </h2>
    <div className="bg-[var(--glass-medium)] backdrop-blur-md border border-[var(--glass-light)] rounded-2xl divide-y divide-[var(--glass-light)] overflow-hidden shadow-sm">
      {children}
    </div>
  </section>
));

const ToggleSwitch: React.FC<{
  id?: string;
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}> = React.memo(({ id, checked, onChange, ariaLabel }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onChange}
    className="relative inline-flex items-center justify-center p-2 cursor-pointer touch-manipulation focus:outline-none shrink-0"
  >
    <div
      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-150 ease-in-out ${
        checked ? 'bg-[#E2B14C]' : 'bg-white/15 dark:bg-white/15'
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-150 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </div>
  </button>
));

export const AppPreferencesPage: React.FC<SettingsViewProps & { onClose: () => void }> = ({
  account,
  onUpdateAccount,
  onSignOut,
  isGuest,
  onClose,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSelectLanguage = (lang: 'en' | 'sq') => {
    triggerHaptic(account, 'light');
    setLanguage(lang);
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, language: lang },
      }),
      t('settings.languageChanged', { lang: lang === 'sq' ? 'Shqip' : 'English' }, `Language set to ${lang === 'sq' ? 'Shqip' : 'English'}`)
    );
  };
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCloudSqlModal, setShowCloudSqlModal] = useState(false);
  const [showStorageCache, setShowStorageCache] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const currentUser = auth.currentUser;
  const isGoogleUser = currentUser?.providerData.some(p => p.providerId === 'google.com');

  const levelInfo = calculateLevelInfo(account.lifetimeXp || 0);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated email user found.');
      }
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      showToast('Password updated successfully.');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setPasswordError(err?.message || 'Failed to update password. Check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      const user = auth.currentUser;
      const email = user?.email || account.profile?.email;
      if (!email) {
        showToast('No email associated with this account.');
        return;
      }
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset email sent to ${email}.`);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to send password reset email.');
    }
  };

  const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleOptimisticUpdate = (updater: (prev: XpAccount) => XpAccount, successMsg?: string) => {
    triggerHaptic(account, 'light');
    const previousAccount = account;
    const updated = updater(account);

    // 1. Instant optimistic UI update
    onUpdateAccount(updated);
    if (successMsg) {
      showToast(successMsg);
    }

    // 2. Debounced background persistence
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveXpAccount(updated);
      } catch (err) {
        console.error('Failed to persist setting change:', err);
        // Rollback on failure
        onUpdateAccount(previousAccount);
        showToast('Failed to save setting. Reverted.');
      }
    }, 400);
  };

  const handleToggleSmartRecommendations = () => {
    const currentVal = !!account.stats.enableSmartRecommendations;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, enableSmartRecommendations: !currentVal },
      }),
      !currentVal ? '“Because You Watch” AI recommendations enabled.' : '“Because You Watch” AI recommendations disabled.'
    );
  };

  const handleToggleOptionalNotifications = () => {
    const currentVal = account.stats.optionalNotificationsEnabled !== false;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, optionalNotificationsEnabled: !currentVal },
      }),
      !currentVal ? 'Optional content notifications enabled.' : 'Optional notifications disabled.'
    );
  };

  const handleToggleNotificationsMaster = async () => {
    const currentVal = account.stats.notificationsEnabled !== false;
    const nextVal = !currentVal;
    
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, notificationsEnabled: nextVal },
      }),
      nextVal ? 'Master notifications enabled.' : 'Master notifications muted.'
    );

    if (nextVal) {
      // Request permission and subscribe
      import('react-onesignal').then(({ default: OneSignal }) => {
        OneSignal.Notifications.requestPermission().then((accepted) => {
          if (accepted) {
            console.log('Permission granted');
          } else {
            console.log('Permission denied');
          }
        });
      });
    }
  };

  const handleToggleAchievementsNotif = () => {
    const currentVal = account.stats.notifyAchievements !== false;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, notifyAchievements: !currentVal },
      }),
      !currentVal ? 'Achievement alerts enabled.' : 'Achievement alerts disabled.'
    );
  };

  const handleToggleWatchPartyNotif = () => {
    const currentVal = account.stats.notifyWatchParty !== false;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, notifyWatchParty: !currentVal },
      }),
      !currentVal ? 'Watch Party invite alerts enabled.' : 'Watch Party invite alerts disabled.'
    );
  };

  const handleToggleSocialNotif = () => {
    const currentVal = account.stats.notifySocial !== false;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, notifySocial: !currentVal },
      }),
      !currentVal ? 'Social comment & like alerts enabled.' : 'Social comment & like alerts disabled.'
    );
  };

  const handleToggleStreaksNotif = () => {
    const currentVal = account.stats.notifyStreaks !== false;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, notifyStreaks: !currentVal },
      }),
      !currentVal ? 'Daily streak & reminder alerts enabled.' : 'Daily streak & reminder alerts disabled.'
    );
  };

  const handleExportData = async () => {
    triggerHaptic(account, 'medium');
    try {
      const historyRaw = localStorage.getItem('farukat_watch_history_v1');
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      const favsRaw = localStorage.getItem('farukat_favorites_v1');
      const favorites = favsRaw ? JSON.parse(favsRaw) : [];
      const likesRaw = localStorage.getItem('farukat_likes_v1');
      const likes = likesRaw ? JSON.parse(likesRaw) : [];
      await exportUserData(account, history, favorites, likes);
      showToast('Account data export downloaded successfully as JSON.');
    } catch (err) {
      console.error(err);
      showToast('Failed to export data.');
    }
  };

  const handleDeleteAccount = async () => {
    triggerHaptic(account, 'heavy');
    try {
      await deleteUserAccount();
      onSignOut();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete account. Please sign in again and retry.');
    }
  };

  // Privacy toggles
  const handleToggleHideRatings = () => {
    const currentVal = !!account.stats.hideRatingsPublicly;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, hideRatingsPublicly: !currentVal },
      }),
      !currentVal ? 'Ratings & reviews are now hidden on your public profile.' : 'Ratings & reviews are now public.'
    );
  };

  const handleToggleHideCard = () => {
    const currentIsPublic = account.profile?.isPublicProfile !== false;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        profile: { ...prev.profile, isPublicProfile: !currentIsPublic },
      }),
      !currentIsPublic ? 'Membership card & profile are now public.' : 'Membership card & profile are now private.'
    );
    syncCurrentUserToDirectory();
  };

  // Accessibility & Display toggles
  const handleToggleHaptics = () => {
    const nextVal = !account.stats.enableHaptics;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, enableHaptics: nextVal },
      }),
      nextVal ? 'Haptic feedback enabled.' : 'Haptic feedback disabled.'
    );
    if (nextVal && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleToggleHighContrast = () => {
    const nextVal = !account.stats.enableHighContrast;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, enableHighContrast: nextVal },
      }),
      nextVal ? 'High Contrast mode enabled.' : 'High Contrast mode disabled.'
    );
  };

  const handleToggleLightMode = () => {
    const nextVal = !account.stats.enableLightMode;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, enableLightMode: nextVal },
      }),
      nextVal ? 'Light theme enabled.' : 'Dark theme enabled.'
    );
  };

  // Playback toggles
  const handleToggleHideContinueWatching = () => {
    const currentVal = !!account.stats.hideContinueWatching;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, hideContinueWatching: !currentVal },
      }),
      !currentVal ? 'Continue Watching row hidden.' : 'Continue Watching row visible.'
    );
  };

  const handleToggleCinematicAudio = () => {
    const currentVal = !!account.stats.enableCinematicAudio;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, enableCinematicAudio: !currentVal },
      }),
      !currentVal ? 'Cinematic background audio enabled.' : 'Cinematic background audio disabled.'
    );
  };

  const handleToggleCompactCatalog = () => {
    const currentVal = !!account.stats.compactCatalogView;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, compactCatalogView: !currentVal },
      }),
      !currentVal ? 'Compact catalog grid enabled.' : 'Standard catalog grid enabled.'
    );
  };

  const isHistoryHidden = Boolean(account.stats.hideHistory);
  const handleToggleHideHistory = () => {
    const nextHidden = !isHistoryHidden;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, hideHistory: nextHidden },
      }),
      nextHidden ? 'History tracking turned off.' : 'History tracking turned on.'
    );
  };

  const isWatchPartyHidden = Boolean(
    account.stats.hideWatchParty || account.stats.watchPartyEnabled === false
  );
  const handleToggleHideWatchParty = () => {
    const nextHidden = !isWatchPartyHidden;
    handleOptimisticUpdate(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, hideWatchParty: nextHidden, watchPartyEnabled: !nextHidden },
      }),
      nextHidden ? 'Watch Party features hidden.' : 'Watch Party features visible.'
    );
  };

  // Data & Sync actions
  const handleManualSync = async () => {
    showToast('Syncing local data with cloud...');
    await saveXpAccount(account);
    syncCurrentUserToDirectory();
    setTimeout(() => {
      showToast('Cloud sync complete');
    }, 1200);
  };



  const handleClearWatchHistory = async () => {
    const activeUid = getActiveUserId(account?.userId);
    await clearWatchHistory(activeUid);

    const updated: XpAccount = {
      ...account,
      stats: {
        ...account.stats,
        totalWatchSeconds: 0,
        totalWatchMinutes: 0,
        totalWatchHours: 0,
        titlesWatched: [],
        episodesCompleted: 0,
      },
    };
    onUpdateAccount(updated);
    await saveXpAccount(updated);
    setShowClearConfirm(false);
    showToast('Watch history and progress cleared.');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] flex flex-col animate-fadeIn">
      {/* Absolute Back Button Top Left */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] left-0 p-4 z-50">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 active:scale-95 transition"
          aria-label={t('common.back', undefined, 'Go back')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-8 w-full max-w-lg mx-auto text-[var(--text-primary)] space-y-6">
      {/* Header Title (Clean, no version badge) */}
      <div className="flex items-center gap-3 border-b border-[var(--glass-light)] pb-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-[var(--glass-light)] flex items-center justify-center text-neutral-300 shrink-0">
          <SettingsIcon className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {t('settings.title', undefined, 'Application Settings')}
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('settings.subtitle', undefined, 'Manage privacy, display, playback, and account data')}
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 1. ACCOUNT */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-mono font-semibold tracking-wider text-neutral-400 uppercase px-1 select-none">
          {t('settings.accountSection', undefined, 'ACCOUNT')}
        </h2>
        <div className="bg-[var(--glass-medium)] backdrop-blur-md border border-[var(--glass-light)] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={account.profile?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover border border-white/15 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {account.profile?.name || t('profile.user', undefined, 'Cinema Member')}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] font-mono truncate">
                  ID: {account.profile?.memberId || 'FK-8892'}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-neutral-300 text-[10px] font-mono font-semibold tracking-wide">
                    {t('achievements.level', { level: levelInfo.level }, `LVL ${levelInfo.level}`)} • {levelInfo.title}
                  </span>
                </div>
              </div>
            </div>

            {!isGuest && (
              <button
                id="settings-signout-btn"
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-400 text-xs font-semibold transition cursor-pointer active:scale-95 shrink-0 min-h-[40px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('settings.signOut', undefined, 'Sign Out')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 1.5. APPLICATION */}
      <SettingsGroup label={t('settings.appSection', undefined, 'APPLICATION')}>
        <div className="p-[var(--space-4)]">
          <PWAInstallButton />
        </div>
      </SettingsGroup>

      {/* LANGUAGE SELECTOR */}
      <SettingsGroup label={t('settings.language', undefined, 'LANGUAGE / GJUHË')}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-gold)]">
            <Globe className="w-4 h-4" />
            <span>{t('settings.languageSelect', undefined, 'Select App Language')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelectLanguage('en')}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                language === 'en'
                  ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold shadow-sm'
                  : 'bg-white/[0.03] border-white/10 text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10">Eng</span>
                <span>{t('settings.english', undefined, 'English')}</span>
              </div>
              {language === 'en' && <CheckCircle2 className="w-4 h-4 text-[var(--accent-gold)]" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectLanguage('sq')}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                language === 'sq'
                  ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold shadow-sm'
                  : 'bg-white/[0.03] border-white/10 text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10">Alb</span>
                <span>{t('settings.albanian', undefined, 'Shqip')}</span>
              </div>
              {language === 'sq' && <CheckCircle2 className="w-4 h-4 text-[var(--accent-gold)]" />}
            </button>
          </div>
        </div>
      </SettingsGroup>

      {/* 2. PRIVACY */}
      <SettingsGroup label={t('settings.privacySection', undefined, 'PRIVACY')}>
        <SettingRow
          id="setting-hide-ratings"
          icon={<Shield className="w-4 h-4" />}
          title={t('settings.hideRatings', undefined, 'Hide Ratings & Reviews')}
          caption={t('settings.hideRatingsDesc', undefined, 'Keep your ratings hidden on your public profile')}
          action={
            <ToggleSwitch
              id="toggle-hide-ratings"
              checked={!!account.stats.hideRatingsPublicly}
              onChange={handleToggleHideRatings}
              ariaLabel="Toggle hide ratings and reviews"
            />
          }
        />
        <SettingRow
          id="setting-hide-card"
          icon={<EyeOff className="w-4 h-4" />}
          title={t('settings.hideCard', undefined, 'Hide Membership Card & Profile')}
          caption={t('settings.hideCardDesc', undefined, 'Appear private in community directory and search')}
          action={
            <ToggleSwitch
              id="toggle-hide-card"
              checked={account.profile?.isPublicProfile === false}
              onChange={handleToggleHideCard}
              ariaLabel="Toggle hide membership card and profile"
            />
          }
        />
        <SettingRow
          id="setting-privacy-policy"
          icon={<Shield className="w-4 h-4" />}
          title={t('settings.privacyPolicy', undefined, 'Privacy Policy')}
          caption={t('settings.privacyPolicyDesc', undefined, "Read Farukat's official data privacy & protection policy")}
          action={
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--accent-gold)] text-xs font-semibold transition cursor-pointer min-h-[36px]"
            >
              <span>{t('common.play', undefined, 'View')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
        />
        <SettingRow
          id="setting-terms-of-service"
          icon={<FileText className="w-4 h-4" />}
          title={t('settings.termsOfService', undefined, 'Terms of Service')}
          caption={t('settings.termsOfServiceDesc', undefined, "Read Farukat's official terms of service")}
          action={
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--accent-gold)] text-xs font-semibold transition cursor-pointer min-h-[36px]"
            >
              <span>{t('common.play', undefined, 'View')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
        />
      </SettingsGroup>

      {/* ACCOUNT SECURITY & PASSWORD */}
      <SettingsGroup label={t('settings.securitySection', undefined, 'ACCOUNT SECURITY & PASSWORD')}>
        {isGoogleUser ? (
          <div className="p-4 space-y-2 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-gold)]">
              <Shield className="w-4 h-4" />
              <span>{t('settings.googleProtected', undefined, 'Google Sign-In Protected')}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('settings.googleProtectedDesc', undefined, 'Your account authentication and password security are managed directly by Google. To change your password or security settings, please visit your Google Account security center.')}
            </p>
            <div className="pt-1">
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium transition"
              >
                <span>{t('settings.manageGoogle', undefined, 'Manage Google Security')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <SettingRow
              id="setting-change-password"
              icon={<KeyRound className="w-4 h-4" />}
              title={t('settings.changePassword', undefined, 'Change Password')}
              caption={t('settings.changePasswordDesc', undefined, 'Update your account password with current credentials')}
              action={
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--accent-gold)] text-xs font-semibold transition cursor-pointer min-h-[36px]"
                >
                  <span>{t('common.edit', undefined, 'Update')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              }
            />
            <SettingRow
              id="setting-forgot-password"
              icon={<Lock className="w-4 h-4" />}
              title={t('settings.resetPasswordEmail', undefined, 'Reset Password via Email')}
              caption={t('settings.resetPasswordEmailDesc', undefined, 'Send a password reset link to your registered email')}
              action={
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-[var(--text-primary)] text-xs font-medium transition cursor-pointer min-h-[36px]"
                >
                  <span>{t('common.submit', undefined, 'Send Reset')}</span>
                </button>
              }
            />
          </>
        )}
      </SettingsGroup>

      {/* CLOUD SQL WATCH PARTY VAULT */}
      <SettingsGroup label={t('settings.cloudSqlSection', undefined, 'CLOUD SQL WATCH PARTY VAULT')}>
        <SettingRow
          id="setting-cloud-sql-audit"
          icon={<Database className="w-4 h-4" />}
          title={t('settings.cloudSqlAudit', undefined, 'Cloud SQL Audit & Chat Vault')}
          caption={t('settings.cloudSqlAuditDesc', undefined, 'Inspect live chat archives & event audit trails stored in PostgreSQL')}
          action={
            <button
              type="button"
              onClick={() => setShowCloudSqlModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--accent-gold)] text-xs font-semibold transition cursor-pointer min-h-[36px]"
            >
              <span>{t('player.watchTogether', undefined, 'Open Vault')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
        />
      </SettingsGroup>

      {/* 3. ACCESSIBILITY & DISPLAY */}
      <SettingsGroup label={t('settings.accessibilitySection', undefined, 'ACCESSIBILITY & DISPLAY')}>
        <SettingRow
          id="setting-haptics"
          icon={<Smartphone className="w-4 h-4" />}
          title={t('settings.haptics', undefined, 'Haptic Feedback')}
          caption={t('settings.hapticsDesc', undefined, 'Subtle vibration feedback on touch interactions')}
          action={
            <ToggleSwitch
              id="toggle-haptics"
              checked={!!account.stats.enableHaptics}
              onChange={handleToggleHaptics}
              ariaLabel="Toggle haptic feedback"
            />
          }
        />
        <SettingRow
          id="setting-high-contrast"
          icon={<Contrast className="w-4 h-4" />}
          title={t('settings.highContrast', undefined, 'High Contrast Mode')}
          caption={t('settings.highContrastDesc', undefined, 'Enhance text contrast and border definitions')}
          action={
            <ToggleSwitch
              id="toggle-high-contrast"
              checked={!!account.stats.enableHighContrast}
              onChange={handleToggleHighContrast}
              ariaLabel="Toggle high contrast mode"
            />
          }
        />
        <SettingRow
          id="setting-light-theme"
          icon={<Sun className="w-4 h-4" />}
          title={t('settings.lightMode', undefined, 'Light Theme')}
          caption={t('settings.lightThemeDesc', undefined, 'Switch between dark and light appearance')}
          action={
            <ToggleSwitch
              id="toggle-light-theme"
              checked={!!account.stats.enableLightMode}
              onChange={handleToggleLightMode}
              ariaLabel="Toggle light theme"
            />
          }
        />
      </SettingsGroup>

      {/* 4. PLAYBACK */}
      <SettingsGroup label={t('settings.playbackSection', undefined, 'PLAYBACK')}>
        <SettingRow
          id="setting-hide-continue-watching"
          icon={<Sliders className="w-4 h-4" />}
          title={t('settings.hideContinue', undefined, 'Hide Continue Watching Row')}
          caption={t('settings.hideContinueDesc', undefined, 'Hide the resume row from the home screen')}
          action={
            <ToggleSwitch
              id="toggle-hide-continue-watching"
              checked={!!account.stats.hideContinueWatching}
              onChange={handleToggleHideContinueWatching}
              ariaLabel="Toggle hide continue watching row"
            />
          }
        />
        <SettingRow
          id="setting-cinematic-audio"
          icon={<Volume2 className="w-4 h-4" />}
          title={t('settings.cinematicAudio', undefined, 'Cinematic Background Audio')}
          caption={t('settings.cinematicAudioDesc', undefined, 'Ambient soundscapes and audio effects during browsing')}
          action={
            <ToggleSwitch
              id="toggle-cinematic-audio"
              checked={!!account.stats.enableCinematicAudio}
              onChange={handleToggleCinematicAudio}
              ariaLabel="Toggle cinematic background audio"
            />
          }
        />
        <SettingRow
          id="setting-compact-catalog"
          icon={<LayoutGrid className="w-4 h-4" />}
          title={t('settings.compactView', undefined, 'Compact Catalog Grid View')}
          caption={t('settings.compactCatalogDesc', undefined, 'Display media in a denser grid for faster browsing')}
          action={
            <ToggleSwitch
              id="toggle-compact-catalog"
              checked={!!account.stats.compactCatalogView}
              onChange={handleToggleCompactCatalog}
              ariaLabel="Toggle compact catalog grid"
            />
          }
        />
        <SettingRow
          id="setting-watch-history"
          icon={<History className="w-4 h-4" />}
          title={t('settings.watchHistory', undefined, 'Watch & Activity History')}
          caption={t('settings.watchHistoryDesc', undefined, 'Record watched titles and progress in your profile')}
          action={
            <ToggleSwitch
              id="toggle-watch-history"
              checked={!isHistoryHidden}
              onChange={handleToggleHideHistory}
              ariaLabel="Toggle watch and activity history"
            />
          }
        />
        <SettingRow
          id="setting-smart-recommendations"
          icon={<Sparkles className="w-4 h-4" />}
          title={t('settings.smartRecommend', undefined, 'Smart Recommendations')}
          caption={t('settings.smartRecommendDesc', undefined, 'Personalized suggestions based on watch history')}
          action={
            <ToggleSwitch
              id="toggle-smart-recommendations"
              checked={!!account.stats.enableSmartRecommendations}
              onChange={handleToggleSmartRecommendations}
              ariaLabel="Toggle smart recommendations"
            />
          }
        />
        <SettingRow
          id="setting-hide-watch-party"
          icon={<Users className="w-4 h-4" />}
          title={t('settings.hideWatchParty', undefined, 'Hide Watch Party')}
          caption={t('settings.hideWatchPartyDesc', undefined, 'Hide public watch parties, rooms, and controls')}
          action={
            <ToggleSwitch
              id="toggle-hide-watch-party"
              checked={isWatchPartyHidden}
              onChange={handleToggleHideWatchParty}
              ariaLabel="Toggle hide watch party"
            />
          }
        />
      </SettingsGroup>

      {/* 5. NOTIFICATIONS & ALERTS */}
      <SettingsGroup label={t('settings.alertsSection', undefined, 'NOTIFICATIONS & ALERTS')}>
        <SettingRow
          id="setting-notifications-master"
          icon={<Bell className="w-4 h-4" />}
          title={t('settings.alertsMaster', undefined, 'Enable Push & In-App Alerts')}
          caption={t('settings.alertsMasterDesc', undefined, 'Master switch for all platform notifications')}
          action={
            <ToggleSwitch
              id="toggle-notifications-master"
              checked={account.stats.notificationsEnabled !== false}
              onChange={handleToggleNotificationsMaster}
              ariaLabel="Toggle master notifications"
            />
          }
        />
        <SettingRow
          id="setting-notify-achievements"
          icon={<Award className="w-4 h-4" />}
          title={t('settings.alertsAchievements', undefined, 'Achievement & XP Milestone Alerts')}
          caption={t('settings.alertsAchievementsDesc', undefined, 'Notify when unlocking achievements, rank-ups & 250+ XP rewards')}
          action={
            <ToggleSwitch
              id="toggle-notify-achievements"
              checked={account.stats.notifyAchievements !== false}
              onChange={handleToggleAchievementsNotif}
              ariaLabel="Toggle achievement alerts"
            />
          }
        />
        <SettingRow
          id="setting-notify-watch-party"
          icon={<Users className="w-4 h-4" />}
          title={t('settings.alertsWatchParty', undefined, 'Watch Party & Room Invites')}
          caption={t('settings.alertsWatchPartyDesc', undefined, 'Alerts when friends invite you to join a Watch Party')}
          action={
            <ToggleSwitch
              id="toggle-notify-watch-party"
              checked={account.stats.notifyWatchParty !== false}
              onChange={handleToggleWatchPartyNotif}
              ariaLabel="Toggle watch party alerts"
            />
          }
        />
        <SettingRow
          id="setting-notify-social"
          icon={<MessageCircle className="w-4 h-4" />}
          title={t('settings.alertsSocial', undefined, 'Social Comments, Replies & Likes')}
          caption={t('settings.alertsSocialDesc', undefined, 'Alerts when cinephiles comment, reply or react to your reviews')}
          action={
            <ToggleSwitch
              id="toggle-notify-social"
              checked={account.stats.notifySocial !== false}
              onChange={handleToggleSocialNotif}
              ariaLabel="Toggle social notification alerts"
            />
          }
        />
        <SettingRow
          id="setting-notify-streaks"
          icon={<Flame className="w-4 h-4" />}
          title={t('settings.alertsStreaks', undefined, 'Daily Streaks & Reminders')}
          caption={t('settings.alertsStreaksDesc', undefined, 'Daily activity prompts to maintain your movie streaming streak')}
          action={
            <ToggleSwitch
              id="toggle-notify-streaks"
              checked={account.stats.notifyStreaks !== false}
              onChange={handleToggleStreaksNotif}
              ariaLabel="Toggle streak alerts"
            />
          }
        />
      </SettingsGroup>

      {/* 6. DATA & SYNC */}
      <SettingsGroup label={t('settings.dataSyncSection', undefined, 'DATA & SYNC')}>
        <SettingRow
          id="setting-manual-sync"
          icon={<RefreshCw className="w-4 h-4" />}
          title={t('settings.manualSync', undefined, 'Manual Cloud Sync')}
          caption={t('settings.manualSyncDesc', undefined, 'Push local state to cloud storage immediately')}
          action={
            <button
              id="settings-sync-btn"
              onClick={handleManualSync}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-[var(--text-primary)] text-xs font-medium transition cursor-pointer active:scale-95 min-h-[36px]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t('common.retry', undefined, 'Sync Now')}</span>
            </button>
          }
        />
        <SettingRow
          id="setting-export-data"
          icon={<Download className="w-4 h-4" />}
          title={t('settings.exportData', undefined, 'Request My Data (JSON Export)')}
          caption={t('settings.exportDataDesc', undefined, 'Download a complete copy of your account data, history & favorites')}
          action={
            <button
              id="settings-export-btn"
              onClick={handleExportData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--accent-gold)] text-xs font-semibold transition cursor-pointer active:scale-95 min-h-[36px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('common.submit', undefined, 'Request')}</span>
            </button>
          }
        />
        <SettingRow
          id="setting-storage-cache"
          icon={<HardDrive className="w-4 h-4" />}
          title={t('settings.storageCache', undefined, 'Storage & Cache')}
          caption={t('settings.storageCacheDesc', undefined, 'Manage local app data and cached images')}
          action={
            <button
              onClick={() => setShowStorageCache(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-subtle)] text-[var(--accent-gold)] text-xs font-semibold transition cursor-pointer active:scale-95 min-h-[36px]"
            >
              <span>{t('common.seeAll', undefined, 'Manage')}</span>
            </button>
          }
        />
        
        <SettingRow
          id="setting-clear-history"
          icon={<RotateCcw className="w-4 h-4" />}
          title={t('settings.clearHistoryTitle', undefined, 'Clear Watch History & Continue Watching')}
          caption={t('settings.clearHistoryTitleDesc', undefined, 'Reset all watch progress and titles history')}
          isDestructive={true}
          action={
            <button
              id="settings-clear-history-btn"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-400 text-xs font-semibold transition cursor-pointer active:scale-95 min-h-[36px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('common.clear', undefined, 'Clear')}</span>
            </button>
          }
        />

        {/* Confirmation prompt for clearing history */}
        {showClearConfirm && (
          <div className="p-4 bg-red-950/20 border-t border-red-500/30 space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t('settings.clearHistoryWarning', undefined, 'Are you sure? This will reset all watch progress and continue watching records.')}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-neutral-300 text-xs font-medium hover:bg-white/15 transition cursor-pointer min-h-[36px]"
              >
                {t('common.cancel', undefined, 'Cancel')}
              </button>
              <button
                onClick={handleClearWatchHistory}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer min-h-[36px]"
              >
                {t('common.yes', undefined, 'Yes')}, {t('common.clear', undefined, 'Clear')}
              </button>
            </div>
          </div>
        )}

        <SettingRow
          id="setting-delete-account"
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          title={t('settings.deleteAccount', undefined, 'Delete My Account')}
          caption={t('settings.deleteAccountDesc', undefined, 'Permanently delete your account, profile, and server data')}
          isDestructive={true}
          action={
            <button
              id="settings-delete-account-btn"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-400 text-xs font-semibold transition cursor-pointer active:scale-95 min-h-[36px]"
            >
              <span>{t('common.delete', undefined, 'Delete Account')}</span>
            </button>
          }
        />

        {/* Confirmation prompt for account deletion */}
        {showDeleteConfirm && (
          <div className="p-4 bg-red-950/20 border-t border-red-500/30 space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t('settings.deleteAccountWarning', undefined, 'Warning: Permanent account deletion cannot be undone. All your profile data, achievements, and stats will be removed.')}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-neutral-300 text-xs font-medium hover:bg-white/15 transition cursor-pointer min-h-[36px]"
              >
                {t('common.cancel', undefined, 'Cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer min-h-[36px]"
              >
                {t('common.delete', undefined, 'Permanently Delete')}
              </button>
            </div>
          </div>
        )}
      </SettingsGroup>

      {/* Privacy Policy & Terms Modals */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
      <TermsOfServiceModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {t('settings.changePassword', undefined, 'Change Password')}
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  {passwordError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {t('settings.currentPassword', undefined, 'Current Password')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold)]"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {t('settings.newPasswordLabel', undefined, 'New Password (min 6 chars)')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold)]"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {t('settings.confirmNewPasswordLabel', undefined, 'Confirm New Password')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold)]"
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-neutral-300 text-xs font-semibold hover:bg-white/15 transition cursor-pointer min-h-[40px]"
                >
                  {t('common.cancel', undefined, 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 rounded-xl bg-[var(--accent-gold)] text-black text-xs font-bold hover:brightness-110 transition cursor-pointer min-h-[40px] disabled:opacity-50"
                >
                  {passwordLoading ? t('common.loading', undefined, 'Updating...') : t('settings.updatePasswordBtn', undefined, 'Update Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cloud SQL Watch Party Audit & Chat Vault Modal */}
      {showCloudSqlModal && (
        <CloudSqlWatchPartyAuditView onClose={() => setShowCloudSqlModal(false)} />
      )}
      {/* Storage & Cache Modal */}
      {showStorageCache && (
        <StorageCacheModal onClose={() => setShowStorageCache(false)} />
      )}
    </div>
    </div>,
    document.body
  );
};
