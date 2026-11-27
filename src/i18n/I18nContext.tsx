import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppLocale } from '@/types/share';
import {
  formatLocaleDateTime,
  formatLocaleTime,
  getActiveLocale,
  getLocalePreferenceSource,
  normalizeLocale,
  setActiveLocaleState,
  tx,
} from '@/i18n/localeState';
import { translateKey, TranslationKey } from '@/i18n/translations';

interface I18nContextValue {
  locale: AppLocale;
  osLocale: string;
  setLocale: (next: AppLocale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  tx: (koText: string, enText: string) => string;
  formatTime: (dateInput?: Date | number | string) => string;
  formatDateTime: (dateInput?: Date | number | string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<AppLocale>(() => getActiveLocale());
  const [osLocale, setOsLocale] = useState<string>(() =>
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'ko-KR'
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.title = translateKey(locale, 'app.docTitle');
    }
  }, [locale]);

  useEffect(() => {
    let active = true;
    const bridge = typeof window !== 'undefined' ? window.ahbiShareElectron : undefined;
    if (!bridge) return;

    const preferenceSource = getLocalePreferenceSource();
    if (preferenceSource === 'user') {
      if (bridge.setAppLocale) {
        void bridge.setAppLocale(locale).catch(() => {});
      }
      if (bridge.getAppLocaleInfo) {
        void bridge
          .getAppLocaleInfo()
          .then((info) => {
            if (active && info?.osLocale) setOsLocale(info.osLocale);
          })
          .catch(() => {});
      }
    } else if (bridge.getAppLocaleInfo) {
      void bridge
        .getAppLocaleInfo()
        .then((info) => {
          if (!active || !info) return;
          if (info.osLocale) setOsLocale(info.osLocale);
          const detected = normalizeLocale(info.detectedLocale || info.currentLocale);
          setActiveLocaleState(detected, 'auto');
          setLocaleState(detected);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, []); // run once on mount; manual toggles call setAppLocale directly

  const setLocale = useCallback((next: AppLocale) => {
    const normalized = setActiveLocaleState(next, 'user');
    setLocaleState(normalized);
    if (typeof window !== 'undefined' && window.ahbiShareElectron?.setAppLocale) {
      void window.ahbiShareElectron.setAppLocale(normalized).catch(() => {});
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translateKey(locale, key, vars),
    [locale]
  );

  const txScoped = useCallback(
    (koText: string, enText: string) => tx(koText, enText, locale),
    [locale]
  );

  const formatTime = useCallback(
    (dateInput?: Date | number | string) => formatLocaleTime(dateInput, locale),
    [locale]
  );

  const formatDateTime = useCallback(
    (dateInput?: Date | number | string) => formatLocaleDateTime(dateInput, locale),
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      osLocale,
      setLocale,
      t,
      tx: txScoped,
      formatTime,
      formatDateTime,
    }),
    [locale, osLocale, setLocale, t, txScoped, formatTime, formatDateTime]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    const fallbackLocale = getActiveLocale();
    return {
      locale: fallbackLocale,
      osLocale: 'ko-KR',
      setLocale: (next) => setActiveLocaleState(next, 'user'),
      t: (key, vars) => translateKey(fallbackLocale, key, vars),
      tx: (koText, enText) => tx(koText, enText, fallbackLocale),
      formatTime: (d) => formatLocaleTime(d, fallbackLocale),
      formatDateTime: (d) => formatLocaleDateTime(d, fallbackLocale),
    };
  }
  return ctx;
}
