import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { UniverseItem } from './UniversesSection';
import { useTranslation } from '../i18n/LanguageContext';

interface UniverseViewProps {
  universe: UniverseItem;
  onBack: () => void;
}

export const UniverseView: React.FC<UniverseViewProps> = ({ universe, onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-white pt-16 pb-24 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col animate-fadeIn">
      {/* Top Header / Back Button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-white/10 text-white font-bold text-xs transition cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 text-[#e2b14c]" />
          <span>{t('common.back', undefined, 'Back')}</span>
        </button>

        <span className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">
          {t('saga.title', undefined, 'Universe Channel')}
        </span>
      </div>

      {/* Universe Hero Branding */}
      <div className="flex flex-col items-center justify-center text-center my-auto py-12 space-y-6">
        {/* Large Emblem Tile */}
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-[24px] border-2 border-white/20 overflow-hidden shadow-2xl relative">
          <img
            src={universe.bgImage || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
            alt={universe.name}
            className="w-full h-full object-cover filter brightness-[0.7] contrast-125 saturate-50"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3">
            <span className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              {universe.name}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {universe.name} Universe
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm mx-auto font-mono">
            {universe.subtitle}
          </p>
        </div>

        {/* Placeholder Badge & Info */}
        <div className="p-4 rounded-2xl bg-[#121212] border border-white/10 max-w-sm w-full text-center space-y-2">
          <span className="inline-block px-2.5 py-1 rounded-full bg-[#e2b14c]/15 border border-[#e2b14c]/30 text-[#e2b14c] text-[10px] font-mono font-bold uppercase tracking-wider">
            Universe Channel Preview
          </span>
          <p className="text-xs text-[var(--text-secondary)]">
            Connected titles, episodes, and storylines for {universe.name} will appear here.
          </p>
        </div>
      </div>
    </div>
  );
};

