import React, { useState, useMemo } from 'react';
import { Search, Bell, User } from 'lucide-react';
import { MediaCategory, XpAccount } from '../types';
import { getOptimizedAvatarUrl } from '../utils/imageOptimizer';
import { useTranslation } from '../i18n/LanguageContext';

interface NavbarProps {
  activeCategory?: MediaCategory;
  onSelectCategory: (category: MediaCategory) => void;
  onOpenSearch: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenMembership: () => void;
  onOpenJoinWatchParty?: () => void;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  watchlistCount?: number;
  account?: XpAccount;
  currentUser?: any;
  isGuest?: boolean;
  onSignIn?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSelectCategory,
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenMembership,
  account,
  currentUser,
  isGuest,
  onSignIn,
}) => {
  const { t, language } = useTranslation();
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = account?.profile?.avatarUrl;
  const isGuestUser = isGuest || !currentUser || !!currentUser?.isGuest || currentUser?.uid === 'guest' || !!currentUser?.isAnonymous;

  const displayUsername = useMemo(() => {
    if (isGuestUser) {
      return t('common.guest', undefined, language === 'sq' ? 'Vizitor' : 'Guest');
    }
    const profileName = account?.profile?.name?.trim();
    if (profileName && profileName !== 'Cinema Member' && profileName !== 'Guest Cinephile') {
      return profileName;
    }
    if (currentUser?.displayName && currentUser.displayName.trim()) {
      return currentUser.displayName.trim();
    }
    if (currentUser?.username && currentUser.username.trim()) {
      return currentUser.username.trim();
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    if (profileName) {
      return profileName;
    }
    return language === 'sq' ? 'Anëtar' : 'Member';
  }, [isGuestUser, language, account?.profile?.name, currentUser, t]);

  const handleProfileClick = () => {
    if (isGuestUser && onSignIn) {
      onSignIn();
    } else {
      onOpenMembership();
    }
  };

  const welcomeWord = t('common.welcome', undefined, 'Welcome');
  const fullGreeting = `${welcomeWord} ${displayUsername}`;

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--bg-main)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] transition-all">
      <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
        
        {/* Header Welcome Username */}
        <div
          id="btn-header-welcome"
          className="flex items-center min-w-0 max-w-[calc(100%-144px)] cursor-pointer select-none -ml-0.5 sm:ml-0 group py-1"
          onClick={() => onSelectCategory('all')}
          title={fullGreeting}
        >
          <span className="text-sm sm:text-base font-medium text-[var(--text-secondary)] shrink-0 mr-1.5">
            {welcomeWord}
          </span>
          <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[#e2b14c] transition-colors truncate">
            {displayUsername}
          </span>
        </div>

        {/* Right-Side Action Cluster: Search -> Notification Bell -> Profile */}
        <div className="flex items-center gap-2">
          
          {/* 1. Search Icon */}
          <button
            id="btn-header-search"
            onClick={onOpenSearch}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer"
            title={t('common.search')}
            aria-label={t('common.search')}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 2. Notification Bell Icon */}
          {onOpenNotifications && (
            <button
              id="btn-header-notifications"
              onClick={onOpenNotifications}
              className="relative w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer"
              title={t('notifications.title')}
              aria-label={t('notifications.title')}
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e2b14c] text-black text-[9px] font-black flex items-center justify-center shadow-md">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* 3. Profile Icon */}
          <button
            id="btn-header-profile"
            onClick={handleProfileClick}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] hover:border-[#e2b14c]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer overflow-hidden p-0.5"
            title={isGuestUser ? t('auth.signIn') : t('profile.title')}
            aria-label={t('profile.title')}
          >
            {avatarUrl && !avatarError && !isGuestUser ? (
              <img
                src={getOptimizedAvatarUrl(avatarUrl, 80)}
                alt={account?.profile?.name || t('profile.title')}
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
                loading="eager"
                decoding="async"
              />
            ) : (
              <User className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
