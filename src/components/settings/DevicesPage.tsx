import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, MonitorSmartphone, ShieldAlert, KeyRound } from 'lucide-react';
import { auth } from '../../firebase';
import { useTranslation } from '../../i18n/LanguageContext';

interface DevicesPageProps {
  onClose: () => void;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const email = auth.currentUser?.email;

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

      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-6 flex flex-col gap-6 w-full max-w-md mx-auto">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('devicesPage.title', undefined, 'Devices & Sessions')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('devicesPage.subtitle', undefined, 'Manage active sessions across your devices.')}</p>
        </div>

        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center border border-[var(--border-subtle)]">
            <MonitorSmartphone className="w-8 h-8 text-[var(--text-secondary)]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t('devicesPage.sessionManagement', undefined, 'Session Management')}</h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-[280px]">
              {t('devicesPage.unsupportedNotice', undefined, 'Active device tracking is not natively supported by the current authentication provider.')}
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
            <ShieldAlert className="w-5 h-5" />
            <h3>{t('devicesPage.secureAccount', undefined, 'Secure Your Account')}</h3>
          </div>
          <p className="text-xs text-amber-500/80 leading-relaxed">
            {t('devicesPage.secureAccountDesc', undefined, 'If you suspect unauthorized access or left your account logged in on a public device, changing your Google or provider password will invalidate all active sessions globally.')}
          </p>
          {email && (
            <p className="text-[11px] font-mono text-amber-500/60 break-all">
              {email}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
