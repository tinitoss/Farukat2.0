import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { Download, X } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

export const PWAInstallButton: React.FC = () => {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-[12px] bg-[var(--accent-gold)] px-[var(--space-4)] py-[var(--space-3)] text-xs font-black text-black uppercase font-mono shadow-lg hover:brightness-110 active:scale-[0.98] transition w-full justify-center"
      >
        <Download className="w-4 h-4 stroke-[2.5]" />
        {t('pwa.installApp', undefined, 'Install App')}
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-[12px] border border-white/20 px-[var(--space-4)] py-[var(--space-3)] text-xs font-black text-white uppercase font-mono shadow-lg hover:bg-white/5 active:scale-[0.98] transition w-full justify-center"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          {t('pwa.installIos', undefined, 'Install on iOS')}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-[var(--space-4)]">
            <div className="w-full max-w-sm rounded-[24px] bg-[var(--bg-surface)] p-[var(--space-5)] border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-[var(--space-4)]">
                <h3 className="text-sm font-black text-white uppercase font-mono">{t('pwa.installIosTitle', undefined, 'Install on iOS')}</h3>
                <button onClick={() => setShowIOSGuide(false)} className="text-[#888888] hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-[#888888] leading-relaxed">
                {t('pwa.step1', undefined, '1. Tap the Share icon at the bottom of Safari.')}<br /><br />
                {t('pwa.step2', undefined, '2. Scroll down and tap Add to Home Screen.')}
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-[var(--space-5)] w-full rounded-[12px] bg-white/10 py-[var(--space-3)] text-xs font-black text-white hover:bg-white/20 uppercase font-mono transition"
              >
                {t('pwa.gotIt', undefined, 'Got it')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
