function normalizeAppLocale(raw) {
  const val = String(raw || '').trim().toLowerCase();
  if (!val) return 'en';
  if (val === 'ko' || val.startsWith('ko-') || val.startsWith('ko_')) {
    return 'ko';
  }
  return 'en';
}

function detectSystemOsLocale(app) {
  const candidates = [];
  try {
    if (app && typeof app.getPreferredSystemLanguages === 'function') {
      const langs = app.getPreferredSystemLanguages();
      if (Array.isArray(langs) && langs.length > 0 && langs[0]) {
        candidates.push(String(langs[0]));
      }
    }
  } catch {}
  try {
    if (app && typeof app.getLocale === 'function') {
      const loc = app.getLocale();
      if (loc) candidates.push(String(loc));
    }
  } catch {}
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) candidates.push(String(intlLocale));
  } catch {}
  if (process.env.LC_ALL) candidates.push(String(process.env.LC_ALL));
  if (process.env.LC_MESSAGES) candidates.push(String(process.env.LC_MESSAGES));
  if (process.env.LANG) candidates.push(String(process.env.LANG));

  const rawLocale = candidates.find((c) => Boolean(c && c.trim())) || 'en-US';
  return {
    osLocale: rawLocale,
    detectedLocale: normalizeAppLocale(rawLocale),
  };
}

function pickLocaleText(locale, koText, enText) {
  return normalizeAppLocale(locale) === 'en' ? enText : koText;
}

function formatLocaleTime(locale, dateInput = new Date()) {
  const loc = normalizeAppLocale(locale) === 'en' ? 'en-US' : 'ko-KR';
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return d.toLocaleTimeString(loc, { hour12: false });
  } catch {
    return new Date().toLocaleTimeString(loc, { hour12: false });
  }
}

module.exports = {
  normalizeAppLocale,
  detectSystemOsLocale,
  pickLocaleText,
  formatLocaleTime,
};
