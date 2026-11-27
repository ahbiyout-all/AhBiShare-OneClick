import { AppLocale } from '@/types/share';

export const APP_LOCALE_STORAGE_KEY = 'ahbishare_ui_locale';

export type LocalePreferenceSource = 'auto' | 'user';

export function normalizeLocale(raw: unknown): AppLocale {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'en' || s.startsWith('en-') || s.startsWith('en_')) {
    return 'en';
  }
  if (s === 'ko' || s.startsWith('ko-') || s.startsWith('ko_')) {
    return 'ko';
  }
  return 'en';
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'ko';
  const candidates: string[] = [];
  if (Array.isArray(navigator.languages)) {
    for (const item of navigator.languages) {
      if (item) candidates.push(item);
    }
  }
  if (navigator.language) candidates.push(navigator.language);
  const first = candidates.find((c) => String(c || '').trim().length > 0);
  if (!first) return 'ko';
  return String(first).trim().toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function getSavedUserLocale(): AppLocale | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'ko' || trimmed === 'en') {
      return trimmed;
    }
  } catch {}
  return null;
}

export function getLocalePreferenceSource(): LocalePreferenceSource {
  return getSavedUserLocale() ? 'user' : 'auto';
}

function resolveInitialLocale(): AppLocale {
  const saved = getSavedUserLocale();
  if (saved) return saved;
  return detectBrowserLocale();
}

let activeLocale: AppLocale = resolveInitialLocale();

export function getActiveLocale(): AppLocale {
  return activeLocale;
}

export function setActiveLocaleState(nextLocale: AppLocale, source: LocalePreferenceSource = 'user'): AppLocale {
  const normalized: AppLocale = nextLocale === 'en' ? 'en' : 'ko';
  activeLocale = normalized;
  if (source === 'user') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, normalized);
      }
    } catch {}
  }
  return normalized;
}

export function tx(koText: string, enText: string, localeOverride?: AppLocale): string {
  const loc = localeOverride || activeLocale;
  return loc === 'en' ? enText : koText;
}

export function getIntlLocaleTag(localeOverride?: AppLocale): string {
  const loc = localeOverride || activeLocale;
  return loc === 'en' ? 'en-US' : 'ko-KR';
}

export function formatLocaleTime(dateInput: Date | number | string = new Date(), localeOverride?: AppLocale): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(getIntlLocaleTag(localeOverride), { hour12: false });
  } catch {
    return d.toTimeString().slice(0, 8);
  }
}

export function formatLocaleDateTime(dateInput: Date | number | string = new Date(), localeOverride?: AppLocale): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(getIntlLocaleTag(localeOverride));
  } catch {
    return d.toISOString();
  }
}
