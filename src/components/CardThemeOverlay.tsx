import React from 'react';
import { CardTheme } from '../types';

interface CardThemeOverlayProps {
  theme: CardTheme;
}

/**
 * CardThemeOverlay renders specific graphic textures, film-strip motifs,
 * and holographic patterns matching each theme finish.
 */
export const CardThemeOverlay: React.FC<CardThemeOverlayProps> = ({ theme }) => {
  switch (theme) {
    case 'bts-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Viewfinder crosshairs and corner brackets */}
          <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-amber-400/60" />
          <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-amber-400/60" />
          <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-amber-400/60" />
          <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-amber-400/60" />

          {/* Center viewfinder crosshair guide */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-8 h-8 border border-amber-400/60 flex items-center justify-center">
              <div className="w-1.5 h-1.5 border-t border-l border-amber-400" />
            </div>
          </div>
        </div>
      );

    case 'detektivi-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Noir venetian blind shadows */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, #000 0px, #000 12px, transparent 12px, transparent 24px)',
            }}
          />
          {/* Magnifying glass crosshair lens motif */}
          <div className="absolute top-3.5 right-14 w-7 h-7 rounded-full border border-[#d4a373]/35 opacity-40 flex items-center justify-center">
            <div className="w-3.5 h-px bg-[#d4a373]/50" />
            <div className="h-3.5 w-px bg-[#d4a373]/50 absolute" />
            <div className="absolute -bottom-1 -right-1 w-2 h-0.5 rounded-sm bg-[#d4a373]/40 rotate-45" />
          </div>
        </div>
      );

    case 'toolate-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Military stencil crosshatch */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(#606c38 1px, transparent 1px)',
              backgroundSize: '10px 10px',
            }}
          />
          {/* Stenciled dog-tag border accents */}
          <div className="absolute top-3 right-14 w-10 h-px bg-[#dda15e]/30" />
          <div className="absolute bottom-3 left-14 w-10 h-px bg-[#dda15e]/30" />
        </div>
      );

    case 'horror-24m-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* CRT scanlines texture */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 2px, transparent 2px, transparent 4px)',
            }}
          />
          {/* Eerie green and red pulse streaks */}
          <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#52b788]/25 to-transparent" />
          <div className="absolute bottom-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9d0208]/30 to-transparent" />
        </div>
      );

    case 'scifi-universe-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Cybernetic circuit grid */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'linear-gradient(to right, #00f5d4 1px, transparent 1px), linear-gradient(to bottom, #9d4edd 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Glowing matrix tracer lines */}
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#00f5d4]/40 to-transparent" />
          <div className="absolute bottom-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9d4edd]/40 to-transparent" />
        </div>
      );

    case 'baba-ramiz-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Prestigious geometric chevron corner frame */}
          <div className="absolute top-2.5 left-2.5 w-7 h-7 border-t-2 border-l-2 border-[#ff1654]/70" />
          <div className="absolute bottom-2.5 right-2.5 w-7 h-7 border-b-2 border-r-2 border-[#ff1654]/70" />
        </div>
      );

    case 'goldprince-era':
      return (
        <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
          <img
            src="https://imgh.in/host/2y0v50"
            alt="The GoldPrince Era background"
            className="w-full h-full object-cover opacity-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60 pointer-events-none" />
        </div>
      );

    case 'alttprince-era':
      return (
        <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
          <img
            src="https://imgh.in/host/u4clw9"
            alt="AlttPrince Era background"
            className="w-full h-full object-cover opacity-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60 pointer-events-none" />
        </div>
      );

    case 'farukat-era':
      return (
        <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
          <img
            src="https://imgh.in/host/tv70kq"
            alt="FARUKAT Era background"
            className="w-full h-full object-cover opacity-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60 pointer-events-none" />
        </div>
      );

    case 'dardi-ladi-edition':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Electric turquoise dual-triangle crest */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 pointer-events-none select-none">
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,15 90,85 10,85" stroke="#66fcf1" strokeWidth="2" fill="none" />
              <polygon points="50,85 90,15 10,15" stroke="#45a29e" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>
      );

    case 'time-lord-diamond':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Diamond faceted polyhedral reflection overlay */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(60deg, transparent, transparent 20px, rgba(224,242,254,0.3) 20px, rgba(224,242,254,0.3) 21px), repeating-linear-gradient(-60deg, transparent, transparent 20px, rgba(56,189,248,0.2) 20px, rgba(56,189,248,0.2) 21px)',
            }}
          />
        </div>
      );

    case 'cyber-hologram':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Hexagonal holographic mesh */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.4) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />
        </div>
      );

    case 'cinephile-platinum':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Fine horizontal brushed platinum streaks */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 4px, rgba(255,255,255,0.15) 4px, rgba(255,255,255,0.15) 5px)',
            }}
          />
          {/* Film perforation rail on right margin */}
          <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-around py-3 opacity-30">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1.5 h-2.5 rounded-sm bg-slate-300" />
            ))}
          </div>
        </div>
      );

    case 'crimson-ruby':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Diagonal velvet sheen ribbons */}
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: 'linear-gradient(135deg, transparent 30%, rgba(255,77,109,0.25) 50%, transparent 70%)',
            }}
          />
        </div>
      );

    case 'obsidian-gold':
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Matte carbon weave */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(rgba(212,175,55,0.2) 1px, transparent 1px)',
              backgroundSize: '12px 12px',
            }}
          />
        </div>
      );

    case 'ivory-gold':
    default:
      return (
        <div className="absolute inset-0 pointer-events-none z-[12] overflow-hidden">
          {/* Classic guilloché concentric security curve */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(226,177,76,0.3) 0%, transparent 60%)',
            }}
          />
        </div>
      );
  }
};
