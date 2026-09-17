import React from 'react';
import { Crown, Shield, Award, Sparkles } from 'lucide-react';
import { RankTierName, getRankTheme } from '../utils/rankSystem';

interface RankBadgeProps {
  tier: RankTierName | string;
  subRank?: number | null;
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  tier,
  subRank,
  label,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const normalizedTier = (tier || 'Bronze') as RankTierName;
  const isMaster = normalizedTier.toUpperCase() === 'MASTER';
  const theme = getRankTheme(normalizedTier);

  const romanNumeral = subRank === 1 ? 'I' : subRank === 2 ? 'II' : subRank === 3 ? 'III' : '';
  const displayLabel = label || (isMaster ? 'MASTER' : `${normalizedTier} ${romanNumeral}`.trim());

  // Pick Lucide icon based on prestige level
  const renderIcon = () => {
    const iconSize = size === 'xs' ? 9 : size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
    switch (normalizedTier.toLowerCase()) {
      case 'bronze':
      case 'silver':
        return <Shield size={iconSize} className="shrink-0" style={{ color: theme.iconColor }} />;
      case 'gold':
        return <Award size={iconSize} className="shrink-0" style={{ color: theme.iconColor }} />;
      case 'platinum':
      case 'diamond':
        return <Sparkles size={iconSize} className="shrink-0" style={{ color: theme.iconColor }} />;
      case 'legendary':
      case 'master':
      default:
        return <Crown size={iconSize} className="shrink-0" style={{ color: theme.iconColor }} />;
    }
  };

  const sizeClasses = {
    xs: 'px-1 py-0.2 text-[8px] gap-0.5 font-mono tracking-wide',
    sm: 'px-1.5 py-0.5 text-[9px] gap-1 font-mono tracking-wider',
    md: 'px-2 py-0.5 text-[10px] gap-1.5 font-mono tracking-widest',
    lg: 'px-2.5 py-1 text-xs gap-2 font-mono tracking-widest',
  }[size];

  if (isMaster) {
    return (
      <span
        className={`inline-flex items-center rounded-md font-black uppercase transition-all duration-300 relative overflow-hidden border ${theme.badgeBorder} ${theme.badgeGlow} ${sizeClasses} ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(226, 177, 76, 0.22) 0%, rgba(168, 85, 247, 0.25) 50%, rgba(226, 177, 76, 0.22) 100%)',
        }}
      >
        {/* Subtle animated light shimmer across ceiling badge */}
        <span
          className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
          aria-hidden="true"
        />
        {showIcon && renderIcon()}
        <span className="font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffe082] via-white to-[#c084fc] drop-shadow-sm">
          {displayLabel}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md font-bold uppercase border transition-all duration-200 ${theme.badgeBg} ${theme.badgeBorder} ${theme.textColor} ${theme.badgeGlow} ${sizeClasses} ${className}`}
    >
      {showIcon && renderIcon()}
      <span className="font-mono font-black">
        {displayLabel}
      </span>
    </span>
  );
};
