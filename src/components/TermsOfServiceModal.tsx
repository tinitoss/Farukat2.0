import React from 'react';
import { ChevronLeft, FileText, Mail, MapPin } from 'lucide-react';
import { FARUKAT_TERMS_OF_SERVICE } from '../data/termsOfServiceData';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] flex flex-col animate-fadeIn">
      {/* Absolute Back Button Top Left */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] left-0 p-4 z-50">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 active:scale-95 transition"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+80px)] pb-6 w-full max-w-md mx-auto text-xs text-[var(--text-secondary)] leading-relaxed space-y-4 font-sans">
        {/* Header Metadata & Intro */}
        <div className="space-y-4 pb-4 border-b border-[var(--divider-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[var(--accent-gold)]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--text-primary)] font-sans tracking-tight leading-none">
                {FARUKAT_TERMS_OF_SERVICE.title}
              </h1>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
                <span>Updated: {FARUKAT_TERMS_OF_SERVICE.lastUpdated}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {FARUKAT_TERMS_OF_SERVICE.intro.map((p, idx) => (
              <p key={idx} className="text-xs text-[var(--text-secondary)] leading-normal">
                {p}
              </p>
            ))}
          </div>
        </div>

        {/* Terms Sections */}
        {FARUKAT_TERMS_OF_SERVICE.sections.map((section) => (
          <div key={section.id} className="pt-2 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              {section.title}
            </h3>

            {section.content?.map((text, i) => (
              <p key={i} className="text-xs text-[var(--text-secondary)] leading-normal">
                {text}
              </p>
            ))}

            {section.subsections?.map((sub, sIdx) => (
              <div key={sIdx} className="space-y-2 pl-3 border-l-2 border-[var(--accent-gold)]/20 py-1">
                {sub.subtitle && (
                  <h4 className="text-[11px] font-bold text-[var(--accent-gold)] uppercase tracking-wider font-mono">
                    {sub.subtitle}
                  </h4>
                )}
                {sub.items && (
                  <ul className="space-y-1.5">
                    {sub.items.map((item, itIdx) => (
                      <li key={itIdx} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="text-[var(--accent-gold)] select-none shrink-0">•</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {section.notes?.map((note, nIdx) => (
              <p key={nIdx} className="text-[11px] text-[var(--text-secondary)] leading-normal italic opacity-80 pt-1">
                {note}
              </p>
            ))}
          </div>
        ))}

        {/* Quick Contact Card at bottom */}
        <div className="pt-6">
          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-gold)] font-mono">
              Operator Contact
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-primary)] pt-1">
              <Mail className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
              <a
                href={`mailto:${FARUKAT_TERMS_OF_SERVICE.contact.email}`}
                className="hover:underline font-mono text-[12px] font-bold"
              >
                {FARUKAT_TERMS_OF_SERVICE.contact.email}
              </a>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <MapPin className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
              <span>{FARUKAT_TERMS_OF_SERVICE.contact.location}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
