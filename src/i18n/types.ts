export type Language = 'en' | 'sq';

export interface TranslationParams {
  [key: string]: string | number | boolean | null | undefined;
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: TranslationParams, defaultText?: string) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTimeAgo: (date: Date | string | number) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
}
