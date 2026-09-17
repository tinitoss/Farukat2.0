export interface LevelTitleTier {
  minLevel: number;
  maxLevel: number;
  title: string;
}

export const LEVEL_TITLE_TIERS: LevelTitleTier[] = [
  { minLevel: 1, maxLevel: 10, title: 'Movie Rookie' },
  { minLevel: 11, maxLevel: 20, title: 'Casual Viewer' },
  { minLevel: 21, maxLevel: 30, title: 'Movie Fan' },
  { minLevel: 31, maxLevel: 40, title: 'Film Fan' },
  { minLevel: 41, maxLevel: 50, title: 'Movie Lover' },
  { minLevel: 51, maxLevel: 60, title: 'Film Explorer' },
  { minLevel: 61, maxLevel: 70, title: 'Cinema Explorer' },
  { minLevel: 71, maxLevel: 80, title: 'Movie Enthusiast' },
  { minLevel: 81, maxLevel: 90, title: 'Film Enthusiast' },
  { minLevel: 91, maxLevel: 100, title: 'Cinema Fanatic' },
  { minLevel: 101, maxLevel: 110, title: 'Movie Buff' },
  { minLevel: 111, maxLevel: 120, title: 'Film Buff' },
  { minLevel: 121, maxLevel: 130, title: 'Cinema Buff' },
  { minLevel: 131, maxLevel: 140, title: 'Movie Expert' },
  { minLevel: 141, maxLevel: 150, title: 'Film Expert' },
  { minLevel: 151, maxLevel: 160, title: 'Cinema Expert' },
  { minLevel: 161, maxLevel: 170, title: 'Movie Scholar' },
  { minLevel: 171, maxLevel: 180, title: 'Film Scholar' },
  { minLevel: 181, maxLevel: 190, title: 'Cinema Scholar' },
  { minLevel: 191, maxLevel: 200, title: 'Movie Master' },
  { minLevel: 201, maxLevel: 210, title: 'Film Master' },
  { minLevel: 211, maxLevel: 220, title: 'Cinema Master' },
  { minLevel: 221, maxLevel: 230, title: 'Movie Connoisseur' },
  { minLevel: 231, maxLevel: 240, title: 'Film Connoisseur' },
  { minLevel: 241, maxLevel: 250, title: 'Cinema Connoisseur' },
  { minLevel: 251, maxLevel: 260, title: 'Movie Critic' },
  { minLevel: 261, maxLevel: 270, title: 'Film Critic' },
  { minLevel: 271, maxLevel: 280, title: 'Cinema Critic' },
  { minLevel: 281, maxLevel: 290, title: 'Movie Aficionado' },
  { minLevel: 291, maxLevel: 300, title: 'Film Aficionado' },
  { minLevel: 301, maxLevel: 310, title: 'Cinema Aficionado' },
  { minLevel: 311, maxLevel: 320, title: 'Movie Authority' },
  { minLevel: 321, maxLevel: 330, title: 'Film Authority' },
  { minLevel: 331, maxLevel: 340, title: 'Cinema Authority' },
  { minLevel: 341, maxLevel: 350, title: 'Movie Veteran' },
  { minLevel: 351, maxLevel: 360, title: 'Film Veteran' },
  { minLevel: 361, maxLevel: 370, title: 'Cinema Veteran' },
  { minLevel: 371, maxLevel: 380, title: 'Movie Historian' },
  { minLevel: 381, maxLevel: 390, title: 'Film Historian' },
  { minLevel: 391, maxLevel: 400, title: 'Cinema Historian' },
  { minLevel: 401, maxLevel: 410, title: 'Movie Legend' },
  { minLevel: 411, maxLevel: 420, title: 'Film Legend' },
  { minLevel: 421, maxLevel: 430, title: 'Cinema Legend' },
  { minLevel: 431, maxLevel: 440, title: 'Movie Icon' },
  { minLevel: 441, maxLevel: 450, title: 'Film Icon' },
  { minLevel: 451, maxLevel: 460, title: 'Cinema Icon' },
  { minLevel: 461, maxLevel: 470, title: 'Movie Immortal' },
  { minLevel: 471, maxLevel: 480, title: 'Film Immortal' },
  { minLevel: 481, maxLevel: 490, title: 'Cinema Immortal' },
  { minLevel: 491, maxLevel: 499, title: 'Master of Cinema' },
  { minLevel: 500, maxLevel: 500, title: 'Cinema Legend' },
];

/**
 * Maps a numeric level (1 to 500+) to its canonical cinema prestige title.
 */
export function getLevelTitle(level: number): string {
  if (level <= 10) return 'Movie Rookie';
  if (level <= 20) return 'Casual Viewer';
  if (level <= 30) return 'Movie Fan';
  if (level <= 40) return 'Film Fan';
  if (level <= 50) return 'Movie Lover';
  if (level <= 60) return 'Film Explorer';
  if (level <= 70) return 'Cinema Explorer';
  if (level <= 80) return 'Movie Enthusiast';
  if (level <= 90) return 'Film Enthusiast';
  if (level <= 100) return 'Cinema Fanatic';
  if (level <= 110) return 'Movie Buff';
  if (level <= 120) return 'Film Buff';
  if (level <= 130) return 'Cinema Buff';
  if (level <= 140) return 'Movie Expert';
  if (level <= 150) return 'Film Expert';
  if (level <= 160) return 'Cinema Expert';
  if (level <= 170) return 'Movie Scholar';
  if (level <= 180) return 'Film Scholar';
  if (level <= 190) return 'Cinema Scholar';
  if (level <= 200) return 'Movie Master';
  if (level <= 210) return 'Film Master';
  if (level <= 220) return 'Cinema Master';
  if (level <= 230) return 'Movie Connoisseur';
  if (level <= 240) return 'Film Connoisseur';
  if (level <= 250) return 'Cinema Connoisseur';
  if (level <= 260) return 'Movie Critic';
  if (level <= 270) return 'Film Critic';
  if (level <= 280) return 'Cinema Critic';
  if (level <= 290) return 'Movie Aficionado';
  if (level <= 300) return 'Film Aficionado';
  if (level <= 310) return 'Cinema Aficionado';
  if (level <= 320) return 'Movie Authority';
  if (level <= 330) return 'Film Authority';
  if (level <= 340) return 'Cinema Authority';
  if (level <= 350) return 'Movie Veteran';
  if (level <= 360) return 'Film Veteran';
  if (level <= 370) return 'Cinema Veteran';
  if (level <= 380) return 'Movie Historian';
  if (level <= 390) return 'Film Historian';
  if (level <= 400) return 'Cinema Historian';
  if (level <= 410) return 'Movie Legend';
  if (level <= 420) return 'Film Legend';
  if (level <= 430) return 'Cinema Legend';
  if (level <= 440) return 'Movie Icon';
  if (level <= 450) return 'Film Icon';
  if (level <= 460) return 'Cinema Icon';
  if (level <= 470) return 'Movie Immortal';
  if (level <= 480) return 'Film Immortal';
  if (level <= 490) return 'Cinema Immortal';
  if (level <= 499) return 'Master of Cinema';
  return 'Cinema Legend';
}
