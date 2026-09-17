import React from 'react';
import { Home, Tv, Film, Bookmark, Trophy } from 'lucide-react';
import { ActiveTab, XpAccount } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  watchlistCount: number;
  account?: XpAccount;
  onOpenMembership?: () => void;
  onSignIn?: () => void;
  isGuest?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  watchlistCount,
  isGuest,
}) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'home' as ActiveTab, label: t('nav.home', undefined, 'Home'), icon: Home },
    { id: 'series' as ActiveTab, label: t('nav.series', undefined, 'Series'), icon: Tv },
    { id: 'movies' as ActiveTab, label: t('nav.movies', undefined, 'Movies'), icon: Film },
    { id: 'my-list' as ActiveTab, label: t('nav.myList', undefined, 'My List'), icon: Bookmark, badge: watchlistCount > 0 && !isGuest ? watchlistCount : 0 },
    ...(!isGuest ? [{ id: 'achievements' as ActiveTab, label: t('nav.achievements', undefined, 'Achievements'), icon: Trophy }] : [])
  ];

  return (
    <nav className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-md bg-[#090909]/95 backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all pointer-events-auto">
      <div className="grid grid-flow-col auto-cols-fr items-center justify-items-center w-full">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'achievements' && activeTab === 'leaderboard');

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center h-12 w-full rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
                isActive ? 'text-[#e2b14c]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="relative flex items-center justify-center w-6 h-6">
                <IconComponent className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.8]'}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-2.5 bg-[#e2b14c] text-black text-[9px] font-black px-1 rounded-full min-w-[14px] text-center leading-none shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight leading-none ${isActive ? 'font-bold text-[#e2b14c]' : 'font-medium text-[var(--text-muted)]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

