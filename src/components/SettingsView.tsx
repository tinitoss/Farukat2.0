import React, { useState } from 'react';
import { 
  Shield, 
  Settings as SettingsIcon,
  ChevronRight,
  User,
  MonitorSmartphone,
  LifeBuoy
} from 'lucide-react';
import { XpAccount } from '../types';
import { DataAccountPage } from './settings/DataAccountPage';
import { DevicesPage } from './settings/DevicesPage';
import { HelpSupportPage } from './settings/HelpSupportPage';
import { AppPreferencesPage } from './AppPreferencesPage';
import { useTranslation } from '../i18n/LanguageContext';

interface SettingsViewProps {
  account: XpAccount;
  onUpdateAccount: (updated: XpAccount) => void;
  onSignOut: () => void;
  isGuest?: boolean;
}

const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  caption: string;
  onClick: () => void;
}> = ({ icon, title, caption, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
  >
    <div className="flex items-center gap-3 min-w-0 pr-2">
      <div className="shrink-0 text-neutral-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium tracking-tight text-[var(--text-primary)] truncate">
          {title}
        </p>
        <p className="text-xs text-[var(--text-secondary)] tracking-tight line-clamp-1 opacity-80 mt-0.5">
          {caption}
        </p>
      </div>
    </div>
    <div className="shrink-0 flex items-center">
      <ChevronRight className="w-5 h-5 text-neutral-500" />
    </div>
  </button>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  account,
  onUpdateAccount,
  onSignOut,
  isGuest,
}) => {
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState<'main' | 'data' | 'devices' | 'help' | 'preferences'>('main');

  return (
    <>
      {activePage === 'main' && (
        <div className="w-full max-w-lg mx-auto text-[var(--text-primary)] space-y-6 pb-8">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[var(--glass-light)] pb-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-[var(--glass-light)] flex items-center justify-center text-neutral-300 shrink-0">
              <SettingsIcon className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{t('settings.title')}</h1>
              <p className="text-xs text-[var(--text-secondary)]">{t('settings.subtitle')}</p>
            </div>
          </div>

          {/* Categories */}
          <section className="space-y-2">
            <div className="bg-[var(--glass-medium)] backdrop-blur-md border border-[var(--glass-light)] rounded-2xl divide-y divide-[var(--glass-light)] overflow-hidden shadow-sm">
              <SettingRow
                icon={<User className="w-4 h-4" />}
                title={t('settings.dataAndAccount')}
                caption={t('settings.dataAndAccountDesc')}
                onClick={() => setActivePage('data')}
              />
              <SettingRow
                icon={<MonitorSmartphone className="w-4 h-4" />}
                title={t('settings.devices')}
                caption={t('settings.devicesDesc')}
                onClick={() => setActivePage('devices')}
              />
              <SettingRow
                icon={<SettingsIcon className="w-4 h-4" />}
                title={t('settings.title')}
                caption={t('settings.preferencesDesc')}
                onClick={() => setActivePage('preferences')}
              />
              <SettingRow
                icon={<LifeBuoy className="w-4 h-4" />}
                title={t('settings.helpAndSupport')}
                caption={t('settings.helpAndSupportDesc')}
                onClick={() => setActivePage('help')}
              />
            </div>
          </section>
        </div>
      )}

      {activePage === 'data' && (
        <DataAccountPage 
          account={account}
          onClose={() => setActivePage('main')}
          onSignOut={onSignOut}
        />
      )}

      {activePage === 'devices' && (
        <DevicesPage 
          onClose={() => setActivePage('main')}
        />
      )}

      {activePage === 'preferences' && (
        <AppPreferencesPage 
          account={account}
          onUpdateAccount={onUpdateAccount}
          onSignOut={onSignOut}
          isGuest={isGuest}
          onClose={() => setActivePage('main')}
        />
      )}

      {activePage === 'help' && (
        <HelpSupportPage 
          onClose={() => setActivePage('main')}
        />
      )}
    </>
  );
};
