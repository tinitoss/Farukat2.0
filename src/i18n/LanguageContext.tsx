import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, TranslationParams, LanguageContextType } from './types';
import { en } from './locales/en';
import { sq } from './locales/sq';

const dictionaries: Record<Language, any> = { en, sq };

const STORAGE_KEY = 'farukat_language';

// Global memory reference for non-React contexts
let globalLanguage: Language = 'en';

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'sq') {
      globalLanguage = saved;
      return saved;
    }
    // Check browser language
    const navLang = navigator.language?.toLowerCase() || '';
    if (navLang.startsWith('sq')) {
      globalLanguage = 'sq';
      return 'sq';
    }
  } catch (e) {}
  globalLanguage = 'en';
  return 'en';
}

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) {
      curr = curr[p];
    } else {
      return undefined;
    }
  }
  return typeof curr === 'string' ? curr : undefined;
}

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  let result = text;
  Object.keys(params).forEach((key) => {
    const val = String(params[key] ?? '');
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val);
    result = result.replace(new RegExp(`{\\s*${key}\\s*}`, 'g'), val);
  });
  return result;
}

export function translateKey(
  lang: Language,
  key: string,
  params?: TranslationParams,
  defaultText?: string
): string {
  if (!key) return defaultText || '';

  let lookupKey = key;
  // Pluralization handling
  if (params && typeof params.count === 'number') {
    const count = params.count;
    const suffix = count === 1 ? '_one' : '_other';
    const pluralValue = getNestedValue(dictionaries[lang], key + suffix) || getNestedValue(dictionaries['en'], key + suffix);
    if (pluralValue) {
      return interpolate(pluralValue, params);
    }
  }

  // Primary lookup
  let rawValue = getNestedValue(dictionaries[lang], lookupKey);

  // Fallback lookup to English
  if (!rawValue && lang !== 'en') {
    rawValue = getNestedValue(dictionaries['en'], lookupKey);
  }

  // Fallback to defaultText or humanized key
  if (!rawValue) {
    if (defaultText) return interpolate(defaultText, params);
    // Humanize last part of key (e.g. "common.watchNow" -> "Watch Now")
    const lastPart = key.split('.').pop() || key;
    return interpolate(lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()), params);
  }

  return interpolate(rawValue, params);
}

// Standalone exported helper for non-React files
export function t(key: string, params?: TranslationParams, defaultText?: string): string {
  return translateKey(globalLanguage, key, params, defaultText);
}

export function getCurrentLanguage(): Language {
  return globalLanguage;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    globalLanguage = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('farukat_language_changed', { detail: lang }));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    globalLanguage = language;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const translate = useCallback(
    (key: string, params?: TranslationParams, defaultText?: string) => {
      return translateKey(language, key, params, defaultText);
    },
    [language]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return String(date);
        const locale = language === 'sq' ? 'sq-AL' : 'en-US';
        const defaultOptions: Intl.DateTimeFormatOptions = options || {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        };
        return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
      } catch (e) {
        return String(date);
      }
    },
    [language]
  );

  const formatTimeAgo = useCallback(
    (date: Date | string | number) => {
      try {
        const d = new Date(date).getTime();
        if (isNaN(d)) return String(date);
        const now = Date.now();
        const diffSeconds = Math.floor((now - d) / 1000);

        if (diffSeconds < 60) {
          return translate('common.justNow', undefined, 'Just now');
        }
        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) {
          return translate('common.minsAgo', { count: diffMinutes }, `${diffMinutes}m ago`);
        }
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
          return translate('common.hoursAgo', { count: diffHours }, `${diffHours}h ago`);
        }
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) {
          return translate('common.yesterday', undefined, 'Yesterday');
        }
        if (diffDays < 30) {
          return translate('common.daysAgo', { count: diffDays }, `${diffDays}d ago`);
        }
        return formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (e) {
        return String(date);
      }
    },
    [language, translate, formatDate]
  );

  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions) => {
      try {
        const locale = language === 'sq' ? 'sq-AL' : 'en-US';
        return new Intl.NumberFormat(locale, options).format(num);
      } catch (e) {
        return String(num);
      }
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translate,
        formatDate,
        formatTimeAgo,
        formatNumber,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside LanguageProvider
    return {
      language: globalLanguage,
      setLanguage: () => {},
      t: (key: string, params?: TranslationParams, defaultText?: string) => translateKey(globalLanguage, key, params, defaultText),
      formatDate: (d) => String(d),
      formatTimeAgo: (d) => String(d),
      formatNumber: (n) => String(n),
    };
  }
  return context;
}
