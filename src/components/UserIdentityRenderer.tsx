import React from 'react';
import { Crown } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

export const RenderUserIdentity: React.FC<{
  user: any;
  equippedCosmetics?: any;
  showAvatar?: boolean;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ user, equippedCosmetics, showAvatar = true, showName = true, size = 'md', className = '' }) => {
  const { t } = useTranslation();
  const avatarSize = size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-8 h-8' : 'w-11 h-11';
  const textSize = size === 'sm' ? 'text-[11px]' : size === 'md' ? 'text-xs' : 'text-sm';
  const crownSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';

  const rawAvatar = user?.avatarUrl || user?.profile?.avatarUrl || user?.authorAvatar;
  const avatarUrl = (typeof rawAvatar === 'string' && rawAvatar.trim()) ? rawAvatar.trim() : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
  const name = user?.name || user?.profile?.name || user?.username || user?.authorName || 'Unknown User';

  const isPro = Boolean(
    user?.isProMember === true ||
    user?.isPro === true ||
    user?.authorIsPro === true ||
    user?.profile?.isProMember === true ||
    user?.profile?.isPro === true ||
    user?.tier === 'DIAMOND' ||
    user?.profile?.tier === 'DIAMOND'
  );

  const titleColor = equippedCosmetics?.titleColor || 'text-[var(--text-primary)]';
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showAvatar && (
        <div className={`relative ${avatarSize}`}>
          <img
            src={avatarUrl}
            alt={name}
            className={`w-full h-full object-cover rounded-full ${
              isPro
                ? 'ring-1.5 ring-[var(--accent-gold)]'
                : equippedCosmetics?.frame || 'border border-white/10'
            }`}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {showName && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {equippedCosmetics?.crown && (
            <Crown className={crownSize} style={{ color: equippedCosmetics.crown, fill: equippedCosmetics.crown }} />
          )}
          <span className={`font-bold ${textSize} ${!titleColor.startsWith('#') && !titleColor.startsWith('linear-gradient') ? titleColor : ''}`}
            style={{
              color: titleColor.startsWith('#') ? titleColor : undefined,
              backgroundImage: titleColor.startsWith('linear') ? titleColor : undefined,
              WebkitBackgroundClip: titleColor.startsWith('linear') ? 'text' : undefined,
              WebkitTextFillColor: titleColor.startsWith('linear') ? 'transparent' : undefined,
            }}
          >
            {name}
          </span>

          {isPro && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider bg-[var(--accent-gold)] text-black uppercase border border-[var(--accent-gold)]/40 shrink-0 font-mono">
              <Crown className="w-2.5 h-2.5 fill-current" />
              <span>{t('profile.proBadge', undefined, 'PRO')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
