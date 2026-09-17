import React, { useState } from 'react';
import { Clapperboard, Play, Crown, Sparkles, Download, Lock, Star } from 'lucide-react';
import { MediaItem } from '../types';
import { MEDIA_CATALOG } from '../data/mediaData';
import { checkIsPro, getXpAccount } from '../utils/xpSystem';
import { getVerifiedDuration } from '../utils/durationStore';
import { useTranslation } from '../i18n/LanguageContext';

interface BehindTheScenesHubProps {
  onPlay: (item: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
}

export const BehindTheScenesHub: React.FC<BehindTheScenesHubProps> = ({
  onPlay,
  onSelectMedia,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'bts' | 'vlogs' | 'bloopers' | 'music' | 'pro_vault'>('all');
  const account = getXpAccount();
  const isPro = checkIsPro(account);

  const btsMain = MEDIA_CATALOG.filter((m) => m.originalSection === 'behind-scenes');
  const deletedAndVlogs = MEDIA_CATALOG.filter((m) => m.originalSection === 'deleted-scenes');
  const specialFeatures = MEDIA_CATALOG.filter((m) => m.originalSection === 'special-features');

  const allBtsItems = [...btsMain, ...deletedAndVlogs, ...specialFeatures];

  const filteredItems = allBtsItems.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'bts') return item.originalSection === 'behind-scenes' || item.title.toLowerCase().includes('behind') || item.title.toLowerCase().includes('prapaskenat');
    if (filter === 'vlogs') return item.title.toLowerCase().includes('vlog');
    if (filter === 'bloopers') return item.title.toLowerCase().includes('gabime') || item.title.toLowerCase().includes('gabimet');
    if (filter === 'music') return item.title.toLowerCase().includes('song') || item.title.toLowerCase().includes('muzik');
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 select-none animate-fadeIn">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0d0d0d] via-[#141414] to-[#0d0d0d] border border-[var(--border-subtle)] p-6 sm:p-8 mb-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#e50914]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 rounded-full bg-[#e50914]/20 border border-[#e50914]/40 text-[#fca5a5] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 mb-3">
            <Clapperboard className="w-3.5 h-3.5" />
            {t('bts.vaultTitle', undefined, 'Studio Production Vault')}
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight mb-2">
            {t('bts.title', undefined, 'Behind The Scenes & Making-Of')}
          </h1>
          <p className="text-xs sm:text-sm text-[#a3a3a3] leading-relaxed mb-4">
            {t('bts.subtitle', undefined, 'Exclusive backstage footage, stunt choreography, VFX breakdown reels, bloopers, director vlogs, and music recording studio sessions.')}
          </p>

          {/* Featured Making-Of Spotlight */}
          <div className="flex flex-wrap gap-2">
            {['VFX-BREAKDOWN', 'Prapaskenat Rrenci', 'SURVIVOR’S BATTLE', 'Shadow Behind the Scenes'].map((feat, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-lg bg-[var(--bg-card-elevated)] border border-[#262626] text-[#bbb] text-xs font-medium flex items-center gap-1">
                <Star className="w-3 h-3 text-[#e2b14c]" /> {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-6">
        {[
          { id: 'all', label: t('bts.allArchives', { count: allBtsItems.length }, `All Archives (${allBtsItems.length})`) },
          { id: 'bts', label: t('bts.btsStunts', undefined, 'Behind The Scenes & Stunts') },
          { id: 'vlogs', label: t('bts.productionVlogs', undefined, 'Production Vlogs') },
          { id: 'bloopers', label: t('bts.bloopers', undefined, 'Bloopers & Errors') },
          { id: 'music', label: t('bts.musicLab', undefined, 'Music Creation Lab') },
          { id: 'pro_vault', label: t('bts.proVault', undefined, 'PRO Uncut Director Vault') },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filter === tab.id
                ? tab.id === 'pro_vault'
                  ? 'bg-[var(--accent-gold)] text-black shadow-lg shadow-[var(--accent-gold)]/20 font-black'
                  : 'bg-[#e50914] text-[var(--text-primary)] shadow-md shadow-[#e50914]/30'
                : tab.id === 'pro_vault'
                ? 'bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] border border-[var(--accent-gold)]/40'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
            }`}
          >
            {tab.id === 'pro_vault' && <Crown className="w-3.5 h-3.5 fill-current" />}
            {tab.label}
          </button>
        ))}
      </div>

      {filter === 'pro_vault' && !isPro ? (
        <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--accent-gold)]/40 text-center space-y-4 max-w-lg mx-auto shadow-2xl">
          <Crown className="w-12 h-12 text-[var(--accent-gold)] mx-auto fill-current animate-pulse" />
          <h3 className="text-xl font-bold text-[var(--text-primary)]">{t('bts.proVaultRestricted', undefined, 'Uncut Director Vault Restricted')}</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {t('bts.proVaultDesc', undefined, 'PRO members gain access to raw uncompressed camera masters, multi-angle audio stems, deleted storyboards, and 4K concept art exports.')}
          </p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/30 text-[var(--accent-gold)] font-black text-xs uppercase tracking-wider">
            <Crown className="w-4 h-4" />
            {t('bts.proVipBadge', undefined, 'Exclusive PRO VIP Membership Feature')}
          </div>
        </div>
      ) : (
        /* Items Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectMedia(item)}
            className="group rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[#2a2a2a] hover:shadow-2xl transition cursor-pointer p-2.5 flex flex-col justify-between"
          >
            {/* Thumbnail Video Card */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface)] mb-2">
              <img
                src={item.thumbnail || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=75&w=600'}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[var(--bg-main)]/30 group-hover:bg-[var(--bg-main)]/50 transition flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(item);
                  }}
                  className="w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#f40612] text-[var(--text-primary)] flex items-center justify-center shadow-lg transition transform group-hover:scale-110 active:scale-95 cursor-pointer"
                  title={`Play ${item.title}`}
                >
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </button>
              </div>

              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-[var(--bg-main)]/80 text-[10px] text-[#bbb] font-mono">
                {getVerifiedDuration(item.id, item.duration || 'Feature')}
              </span>

              {item.title.toLowerCase().includes('vfx') && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-purple-950/90 border border-purple-500/50 text-purple-300 text-[9px] font-extrabold uppercase">
                  VFX Breakdown
                </span>
              )}
              {item.title.toLowerCase().includes('song') && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-[9px] font-extrabold uppercase">
                  Music Studio
                </span>
              )}
            </div>

            {/* Information */}
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors line-clamp-1">
                {item.title}
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-1 leading-normal font-normal">
                {item.description}
              </p>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <span>{item.year}</span>
                <span className="text-[#e50914] font-semibold">FPX Behind-Scenes</span>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};
