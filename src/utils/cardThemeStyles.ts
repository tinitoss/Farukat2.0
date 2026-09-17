import { CardTheme } from '../types';

export interface ThemeConfig {
  id: CardTheme;
  label: string;
  category: 'general' | 'show';
  requiredLevel?: number;
  achievementCondition?: string;
  desc: string;
  meaning: string;
  swatchGradient: string; // Tailwind gradient classes for swatch preview
  bgImage?: string;
  styles: {
    cardBg: string;
    border: string;
    textGold: string;
    subtext: string;
    chipColor: string;
    holoGlow: string;
  };
}

export interface CardThemeGroup {
  groupId: 'general' | 'show';
  groupTitle: string;
  groupSubtitle: string;
  themes: ThemeConfig[];
}

export const CARD_THEME_GROUPS: CardThemeGroup[] = [
  {
    groupId: 'general',
    groupTitle: 'General Finishes',
    groupSubtitle: 'Progression prestige card finishes unlocked by leveling up your membership',
    themes: [
      {
        id: 'ivory-gold',
        label: 'Classic Gold Foil',
        category: 'general',
        requiredLevel: 1,
        desc: 'Level 1 (Default)',
        meaning: 'Warm gold foil texture, starter premium look.',
        swatchGradient: 'from-[#fced9a] via-[#e2b14c] to-[#996b17]',
        styles: {
          cardBg: 'from-[#14120d] via-[#0d0b07] to-[#050402]',
          border: 'border-[#e2b14c]/40',
          textGold: 'text-[#e2b14c]',
          subtext: 'text-[#baa78d]',
          chipColor: 'from-[#fced9a] via-[#e2b14c] to-[#996b17]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'obsidian-gold',
        label: 'Dark Obsidian Finish',
        category: 'general',
        requiredLevel: 3,
        desc: 'Unlocks at Level 3',
        meaning: 'Deep matte black card with subtle glossy reflections, minimalist and sleek.',
        swatchGradient: 'from-[#2a2a2a] via-[#0a0a0a] to-[#1a1a1a]',
        styles: {
          cardBg: 'from-[#0a0a0a] via-[#121212] to-[#050505]',
          border: 'border-[var(--accent-gold)]/40',
          textGold: 'text-[var(--accent-gold)]',
          subtext: 'text-[#999]',
          chipColor: 'from-[var(--accent-gold)] via-[var(--accent-gold-dim)] to-black',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'cinephile-platinum',
        label: 'Cinephile Platinum',
        category: 'general',
        requiredLevel: 6,
        desc: 'Unlocks at Level 6',
        meaning: 'Cool silver/platinum tone with a brushed-metal finish, understated and classy.',
        swatchGradient: 'from-[#f8fafc] via-[#cbd5e1] to-[#64748b]',
        styles: {
          cardBg: 'from-[#0f172a] via-[#1e293b] to-[#0b0f19]',
          border: 'border-slate-400/40',
          textGold: 'text-slate-100',
          subtext: 'text-slate-400',
          chipColor: 'from-slate-100 via-slate-300 to-slate-500',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'crimson-ruby',
        label: 'Crimson Velvet Chrome',
        category: 'general',
        requiredLevel: 9,
        desc: 'Unlocks at Level 9',
        meaning: 'Rich red chrome finish with a soft velvet-like sheen, bold and glossy.',
        swatchGradient: 'from-[#ff4d6d] via-[#c9184a] to-[#590d22]',
        styles: {
          cardBg: 'from-[#200508] via-[#140204] to-[#080102]',
          border: 'border-rose-500/40',
          textGold: 'text-rose-300',
          subtext: 'text-rose-200/70',
          chipColor: 'from-rose-400 via-red-600 to-amber-500',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'cyber-hologram',
        label: 'Holographic Cyber Prism',
        category: 'general',
        requiredLevel: 13,
        desc: 'Unlocks at Level 13',
        meaning: 'Iridescent, color-shifting holographic surface, futuristic and eye-catching.',
        swatchGradient: 'from-cyan-400 via-fuchsia-500 to-emerald-400',
        styles: {
          cardBg: 'from-[#050e18] via-[#091726] to-[#02060c]',
          border: 'border-cyan-400/40',
          textGold: 'text-cyan-300',
          subtext: 'text-cyan-100/70',
          chipColor: 'from-cyan-300 via-teal-400 to-blue-600',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'time-lord-diamond',
        label: 'Time Lord Diamond',
        category: 'general',
        requiredLevel: 17,
        desc: 'Unlocks at Level 17',
        meaning: 'Icy blue-white diamond-cut faceted texture, premium and rare-feeling.',
        swatchGradient: 'from-[#e0f2fe] via-[#38bdf8] to-[#1e3a8a]',
        styles: {
          cardBg: 'from-[#04101e] via-[#0a2342] to-[#020912]',
          border: 'border-sky-300/40',
          textGold: 'text-sky-200',
          subtext: 'text-sky-300/70',
          chipColor: 'from-white via-sky-300 to-indigo-600',
          holoGlow: 'from-transparent to-transparent',
        },
      },
    ],
  },
  {
    groupId: 'show',
    groupTitle: 'Show-Inspired Editions',
    groupSubtitle: 'Exclusive themed finishes representing iconic universes and sagas',
    themes: [
      {
        id: 'bts-edition',
        label: 'Behind the Scenes Edition',
        category: 'show',
        requiredLevel: 5,
        desc: 'Unlocks at Level 5',
        meaning: 'Raw, unpolished production textures with clapperboard & viewfinder motifs.',
        swatchGradient: 'from-[var(--accent-gold)] via-[#3f3f46] to-[#18181b]',
        styles: {
          cardBg: 'from-[#18181b] via-[#27272a] to-[#09090b]',
          border: 'border-amber-400/40',
          textGold: 'text-amber-300',
          subtext: 'text-zinc-400',
          chipColor: 'from-amber-400 via-zinc-400 to-zinc-800',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'detektivi-edition',
        label: 'Detektivi Edition',
        category: 'show',
        requiredLevel: 8,
        desc: 'Unlocks at Level 8',
        meaning: 'Dark navy/sepia film-noir shadow tones with case-file styling.',
        swatchGradient: 'from-[#b45309] via-[#1e293b] to-[#020617]',
        styles: {
          cardBg: 'from-[#020617] via-[#0f172a] to-[#1e1b18]',
          border: 'border-[#d4a373]/40',
          textGold: 'text-[#d4a373]',
          subtext: 'text-[#a89f91]',
          chipColor: 'from-[#faedcd] via-[#d4a373] to-[#332211]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'toolate-edition',
        label: 'TooLate Edition',
        category: 'show',
        requiredLevel: 12,
        desc: 'Unlocks at Level 12',
        meaning: 'Muted olive and khaki military tones with worn metal textures.',
        swatchGradient: 'from-[#606c38] via-[#283618] to-[#1c2417]',
        styles: {
          cardBg: 'from-[#1a2318] via-[#283618] to-[#0f150e]',
          border: 'border-[#606c38]/40',
          textGold: 'text-[#dda15e]',
          subtext: 'text-[#b7b7a4]',
          chipColor: 'from-[#dda15e] via-[#606c38] to-[#283618]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'horror-24m-edition',
        label: '24M Edition',
        category: 'show',
        requiredLevel: 16,
        desc: 'Unlocks at Level 16',
        meaning: 'Unsettling horror tones, eerie dark fog, and deep crimson accents.',
        swatchGradient: 'from-[#52b788] via-[#9d0208] to-[#03071e]',
        styles: {
          cardBg: 'from-[#0d130e] via-[#1a0a0d] to-[#050806]',
          border: 'border-[#52b788]/40',
          textGold: 'text-[#74c69d]',
          subtext: 'text-[#d8f3dc]/70',
          chipColor: 'from-[#74c69d] via-[#9d0208] to-[#1b4332]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'scifi-universe-edition',
        label: 'Sci-Fi Universe Edition',
        category: 'show',
        requiredLevel: 20,
        desc: 'Unlocks at Level 20',
        meaning: 'Neon cyan/purple accents, holographic grid lines, and sleek metallic finish.',
        swatchGradient: 'from-[#00f5d4] via-[#9d4edd] to-[#3a0ca3]',
        styles: {
          cardBg: 'from-[#080214] via-[#10072b] to-[#03010a]',
          border: 'border-[#9d4edd]/40',
          textGold: 'text-[#00f5d4]',
          subtext: 'text-[#c77dff]',
          chipColor: 'from-[#00f5d4] via-[#9d4edd] to-[#3a0ca3]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'baba-ramiz-edition',
        label: 'Baba Ramiz Edition',
        category: 'show',
        requiredLevel: 25,
        desc: 'Unlocks at Level 25',
        meaning: 'Commanding crimson & carbon black palette with heavyweight prestige identity.',
        swatchGradient: 'from-[#ff1654] via-[#d00000] to-[#0a0002]',
        styles: {
          cardBg: 'from-[#1c0206] via-[#2f040d] to-[#0a0002]',
          border: 'border-[#ff1654]/40',
          textGold: 'text-[#ff4d6d]',
          subtext: 'text-[#ffb3c1]',
          chipColor: 'from-[#ff1654] via-[#d00000] to-[#250902]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'goldprince-era',
        label: 'The GoldPrince Era',
        category: 'show',
        requiredLevel: 40,
        desc: 'Unlocks at Level 40',
        meaning: 'Official GoldPrince Studio signature domain with golden ambient glow.',
        swatchGradient: 'from-[#fced9a] via-[#e2b14c] to-[#0a0a0a]',
        bgImage: 'https://imgh.in/host/2y0v50',
        styles: {
          cardBg: 'from-[#1a1408] via-[#0d0a04] to-[#000000]',
          border: 'border-[#e2b14c]/60',
          textGold: 'text-[#fced9a]',
          subtext: 'text-[#e2b14c]/90',
          chipColor: 'from-[#fced9a] via-[#e2b14c] to-[#3a2807]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'alttprince-era',
        label: 'AlttPrince Era',
        category: 'show',
        requiredLevel: 33,
        desc: 'Unlocks at Level 33',
        meaning: 'Official AlttPrince Studio domain featuring custom signature visual art.',
        swatchGradient: 'from-[#d8b4fe] via-[#a855f7] to-[#0f0a1c]',
        bgImage: 'https://imgh.in/host/u4clw9',
        styles: {
          cardBg: 'from-[#130b22] via-[#0b0614] to-[#000000]',
          border: 'border-[#c084fc]/60',
          textGold: 'text-[#e9d5ff]',
          subtext: 'text-[#c084fc]/90',
          chipColor: 'from-[#e9d5ff] via-[#a855f7] to-[#2e1065]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'farukat-era',
        label: 'FARUKAT Era',
        category: 'show',
        requiredLevel: 55,
        desc: 'Unlocks at Level 55',
        meaning: 'Official FARUKAT signature realm with custom background visual aesthetic.',
        swatchGradient: 'from-[#fca5a5] via-[#ef4444] to-[#180505]',
        bgImage: 'https://imgh.in/host/tv70kq',
        styles: {
          cardBg: 'from-[#1a0505] via-[#0d0202] to-[#000000]',
          border: 'border-[#f87171]/60',
          textGold: 'text-[#fecaca]',
          subtext: 'text-[#f87171]/90',
          chipColor: 'from-[#fecaca] via-[#ef4444] to-[#450a0a]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
      {
        id: 'dardi-ladi-edition',
        label: 'Dardi & Ladi Edition',
        category: 'show',
        achievementCondition: 'Complete all 22 movies in the Dardi & Ladi saga',
        desc: 'Complete all 22 Dardi & Ladi movies',
        meaning: 'Electric turquoise & midnight chrome franchise completion trophy.',
        swatchGradient: 'from-[#66fcf1] via-[#45a29e] to-[#0b0c10]',
        styles: {
          cardBg: 'from-[#0b0c10] via-[#121820] to-[#050608]',
          border: 'border-[#66fcf1]/40',
          textGold: 'text-[#66fcf1]',
          subtext: 'text-[#45a29e]',
          chipColor: 'from-[#66fcf1] via-[#45a29e] to-[#1f2833]',
          holoGlow: 'from-transparent to-transparent',
        },
      },
    ],
  },
];

const ALL_THEMES_MAP = new Map<CardTheme, ThemeConfig>();
for (const group of CARD_THEME_GROUPS) {
  for (const theme of group.themes) {
    ALL_THEMES_MAP.set(theme.id, theme);
  }
}

export function getThemeConfig(themeId?: CardTheme): ThemeConfig {
  if (themeId && ALL_THEMES_MAP.has(themeId)) {
    return ALL_THEMES_MAP.get(themeId)!;
  }
  return ALL_THEMES_MAP.get('ivory-gold')!;
}

export function getCardThemeStyles(themeId?: CardTheme) {
  return getThemeConfig(themeId).styles;
}

/**
 * Extracts the user's real unique identifying segment from any card number
 * by stripping existing theme or default prefixes.
 */
export function extractCardSegment(cardNumber: string): string {
  if (!cardNumber) return '';
  const clean = cardNumber.trim().toUpperCase();
  // Strip any theme prefix FK-(BTS|TL|DTK|BR|24M|SCI|GPA|APA|FA|DL)-
  const themeMatch = clean.match(/^FK-(?:BTS|TL|DTK|BR|24M|SCI|GPA|APA|FA|DL)-(.+)$/i);
  if (themeMatch && themeMatch[1]) {
    return themeMatch[1];
  }
  // Strip standard FK- prefix
  if (clean.startsWith('FK-')) {
    return clean.slice(3);
  }
  return clean;
}

/**
 * Returns the card number formatted with the theme's specific prefix,
 * preserving the user's real, actual account ID segment unchanged.
 */
export function formatThemeCardNumber(baseCardNumber: string, theme?: CardTheme): string {
  if (!baseCardNumber) return '';
  const segment = extractCardSegment(baseCardNumber);
  if (!segment) return baseCardNumber;

  switch (theme) {
    case 'bts-edition':
      return `FK-BTS-${segment}`;
    case 'toolate-edition':
      return `FK-TL-${segment}`;
    case 'detektivi-edition':
      return `FK-DTK-${segment}`;
    case 'baba-ramiz-edition':
      return `FK-BR-${segment}`;
    case 'horror-24m-edition':
      return `FK-24M-${segment}`;
    case 'scifi-universe-edition':
      return `FK-SCI-${segment}`;
    case 'goldprince-era':
      return `FK-GPA-${segment}`;
    case 'alttprince-era':
      return `FK-APA-${segment}`;
    case 'farukat-era':
      return `FK-FA-${segment}`;
    case 'dardi-ladi-edition':
      return `FK-DL-${segment}`;
    default:
      // General finishes (Gold Foil, Obsidian, Platinum, etc.) keep default format
      return `FK-${segment}`;
  }
}

export function isThemeUnlocked(
  theme: ThemeConfig,
  userLevel: number,
  isDardiLadiCompleted: boolean
): { unlocked: boolean; tag: string; desc: string } {
  if (theme.id === 'dardi-ladi-edition') {
    return {
      unlocked: isDardiLadiCompleted,
      tag: 'Achievement',
      desc: theme.desc,
    };
  }

  const reqLevel = theme.requiredLevel ?? 1;
  const unlocked = userLevel >= reqLevel;

  return {
    unlocked,
    tag: reqLevel === 1 ? 'Default' : `Level ${reqLevel}`,
    desc: reqLevel === 1 ? 'Unlocked by default' : `Unlocks at Level ${reqLevel}`,
  };
}

/**
 * Returns the human-readable display label for a card theme/edition
 * (e.g. "Behind the Scenes Edition", "TooLate Edition", "Classic Gold Foil").
 */
export function getCardThemeLabel(theme?: CardTheme | string): string {
  if (!theme) return 'Classic Gold Foil';
  for (const group of CARD_THEME_GROUPS) {
    const found = group.themes.find((t) => t.id === theme);
    if (found) return found.label;
  }
  // Fallbacks for known names
  if (theme === 'bts-edition') return 'Behind the Scenes Edition';
  if (theme === 'toolate-edition') return 'TooLate Edition';
  if (theme === 'detektivi-edition') return 'Detektivi Edition';
  if (theme === 'baba-ramiz-edition') return 'Baba Ramiz Edition';
  if (theme === 'horror-24m-edition') return '24M Horror Edition';
  if (theme === 'scifi-universe-edition') return 'Sci-Fi Universe Edition';
  if (theme === 'goldprince-era') return 'The GoldPrince Era';
  if (theme === 'alttprince-era') return 'AlttPrince Era';
  if (theme === 'farukat-era') return 'FARUKAT Era';
  if (theme === 'dardi-ladi-edition') return 'Dardi & Ladi Edition';
  return 'Classic Gold Foil';
}
