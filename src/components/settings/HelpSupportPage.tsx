import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, LifeBuoy, Mail, ExternalLink, HelpCircle, Bug, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

interface HelpSupportPageProps {
  onClose: () => void;
}

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqItems = [
    {
      q: t('help.faq1Q', undefined, 'How does the XP system work?'),
      a: t('help.faq1A', undefined, 'You earn XP by watching media (1 XP per minute) and earning achievements. Leveling up grants higher ranks and unlocks exclusive aesthetic titles.')
    },
    {
      q: t('help.faq2Q', undefined, 'What is Cloud SQL Watch Party Vault?'),
      a: t('help.faq2A', undefined, 'It is an enterprise-grade sync engine ensuring sub-second playback synchronization for watch parties using Google Cloud SQL.')
    },
    {
      q: t('help.faq3Q', undefined, 'How do I save data on mobile?'),
      a: t('help.faq3A', undefined, 'You can enable Data Saver Mode in Playback settings. This forces standard definition streams to reduce bandwidth.')
    },
    {
      q: t('help.faq4Q', undefined, 'Why isn\'t my progress saving?'),
      a: t('help.faq4A', undefined, 'Ensure you are not watching in Incognito mode or blocking local storage. Your progress syncs to Firestore when logged in.')
    }
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(prev => prev === index ? null : index);
  };

  const handleContactSupport = () => {
    window.location.href = "mailto:babajem16@gmail.com?subject=Farukat%20Support%20Request";
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

      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-6 flex flex-col gap-6 w-full max-w-md mx-auto">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('help.title', undefined, 'Help & Support')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('help.subtitle', undefined, 'Get help, troubleshoot issues, or contact us.')}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[var(--accent-gold)] uppercase tracking-wider">{t('help.contactUs', undefined, 'Contact Us')}</h2>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden divide-y divide-[var(--divider-hairline)]">
            <button 
              onClick={handleContactSupport}
              className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-surface)] transition text-left"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-[var(--text-secondary)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{t('help.emailSupport', undefined, 'Email Support')}</p>
                  <p className="text-xs text-[var(--text-secondary)]">babajem16@gmail.com</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
            <button 
              onClick={handleContactSupport}
              className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-surface)] transition text-left"
            >
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-[var(--text-secondary)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{t('help.reportProblem', undefined, 'Report a Problem')}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{t('help.bugReportSub', undefined, 'Found a bug? Let us know.')}</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-[var(--text-muted)] rotate-180" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[var(--accent-gold)] uppercase tracking-wider">{t('help.faq', undefined, 'Frequently Asked Questions')}</h2>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden divide-y divide-[var(--divider-hairline)]">
            {faqItems.map((item, index) => (
              <div key={index} className="flex flex-col">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface)] transition"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <HelpCircle className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.q}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform ${expandedFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {expandedFaq === index && (
                  <div className="px-4 pb-4 pt-1 pl-12 text-xs text-[var(--text-secondary)] leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('help.appDiagnostics', undefined, 'App Diagnostics')}</h2>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-y-3">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-1">{t('help.version', undefined, 'Version')}</p>
                <p className="text-xs text-[var(--text-primary)] font-mono">2.4.2 (Web)</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-1">{t('help.platform', undefined, 'Platform')}</p>
                <p className="text-xs text-[var(--text-primary)]">{navigator.platform || 'Web'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-1">{t('help.environment', undefined, 'Environment')}</p>
                <p className="text-xs text-[var(--text-primary)] font-mono">Production</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
