import React from 'react';
import newLogoImg from '../assets/images/farukat_new_logo.png';
import headerLogoImg from '../assets/images/header_logo.png';
import { useTranslation } from '../i18n/LanguageContext';

export const FARUKAT_LOGO_URL = 'https://i.postimg.cc/kgY1tn7h/Picsart-26-09-09-16-12-49-057.png';
export const HEADER_LOGO_URL = 'https://i.postimg.cc/ryh8srvp/Picsart-26-09-09-16-12-37-236.png';

interface FarukatLogoProps {
  className?: string;
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  variant?: 'gold' | 'silver' | 'white' | 'ruby';
  useFullImage?: boolean;
  rotating?: boolean;
  isHeader?: boolean;
}

export const FarukatLogo: React.FC<FarukatLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  textColor = 'text-[var(--text-primary)]',
  variant = 'gold',
  useFullImage = true,
  rotating = false,
  isHeader = false,
}) => {
  const activeImg = isHeader ? (headerLogoImg || HEADER_LOGO_URL) : (newLogoImg || FARUKAT_LOGO_URL);

  const sizeDimensions = {
    xxs: { icon: 16, width: 'w-5 h-5', fullWidth: isHeader ? 'w-20 h-7' : 'w-16 h-7', text: 'text-[10px]', subText: 'text-[6px]' },
    xs: { icon: 20, width: 'w-6 h-6', fullWidth: isHeader ? 'w-24 h-8' : 'w-20 h-8', text: 'text-[11px] sm:text-xs', subText: 'text-[7px]' },
    sm: { icon: 28, width: 'w-8 h-8', fullWidth: isHeader ? 'w-32 h-9' : 'w-28 h-9', text: 'text-sm sm:text-base', subText: 'text-[8px]' },
    md: { icon: 40, width: 'w-10 h-10', fullWidth: isHeader ? 'w-40 h-12' : 'w-36 h-12', text: 'text-lg sm:text-xl', subText: 'text-[9px]' },
    lg: { icon: 64, width: 'w-16 h-16', fullWidth: isHeader ? 'w-52 h-16' : 'w-48 h-16', text: 'text-xl sm:text-2xl', subText: 'text-[10px]' },
    xl: { icon: 96, width: 'w-24 h-24', fullWidth: isHeader ? 'w-68 h-24' : 'w-64 h-24', text: 'text-3xl', subText: 'text-xs' },
  }[size] || { icon: 40, width: 'w-10 h-10', fullWidth: isHeader ? 'w-40 h-12' : 'w-36 h-12', text: 'text-lg sm:text-xl', subText: 'text-[9px]' };

  // If useFullImage and showText is requested, render the official logo image
  if (useFullImage && showText) {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <img
          src={activeImg}
          alt="FARUKAT"
          className={`${sizeDimensions.fullWidth} object-contain object-left filter drop-shadow-[0_2px_10px_rgba(226,177,76,0.35)] shrink-0 ${rotating ? 'animate-smooth-spin' : ''}`}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          style={{ willChange: rotating ? 'transform' : 'auto' }}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Official Emblem Icon */}
      <div className={`relative ${sizeDimensions.width} flex-shrink-0 group overflow-hidden rounded-full`}>
        <img
          src={activeImg}
          alt="Farukat Crest"
          className={`w-full h-full object-cover scale-[1.3] filter drop-shadow-[0_2px_8px_rgba(226,177,76,0.4)] ${rotating ? 'animate-smooth-spin' : ''}`}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          style={{ willChange: rotating ? 'transform' : 'auto' }}
        />
      </div>

      {/* App Wordmark Text when not using single composite image */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1">
            <span className={`font-black tracking-widest ${sizeDimensions.text} uppercase ${textColor} font-serif`}>
              FARUKAT
            </span>
          </div>
          <span className={`${sizeDimensions.subText} text-[#8e8e8e] tracking-[0.2em] uppercase font-bold mt-0.5`}>
            CINEMA & STREAMING
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Minimal, Smooth Pure-CSS Loading Screen (Apple / Premium Streaming Style)
 * Uses lightweight CSS transform rotation and subtle accent arc with no logo.
 */
export const FarukatRotatingLoader: React.FC<{
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}> = ({
  message,
  size = 'md',
  fullScreen = true,
}) => {
  const { t } = useTranslation();
  const displayMessage = message !== undefined ? message : t('common.loading', undefined, 'Loading...');
  const ringDimensions = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  }[size] || 'w-7 h-7';

  const strokeWidth = size === 'sm' ? 2 : 2.5;

  const content = (
    <div className="flex flex-col items-center justify-center gap-3.5 select-none p-4 text-center animate-fadeIn">
      {/* Centered Minimal Accent Ring Spinner */}
      <div className={`relative ${ringDimensions} flex items-center justify-center`}>
        <svg
          className="w-full h-full animate-subtle-spin"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Faint track ring */}
          <circle
            cx="16"
            cy="16"
            r="13"
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            className="opacity-[0.08]"
          />
          {/* Accent arc */}
          <circle
            cx="16"
            cy="16"
            r="13"
            stroke="#e2b14c"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="26 60"
          />
        </svg>
      </div>

      {/* Understated Sentence-Case Status Text */}
      {displayMessage && (
        <span className="text-xs text-neutral-400 font-normal tracking-normal select-none opacity-80">
          {displayMessage}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#070707] flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return content;
};

