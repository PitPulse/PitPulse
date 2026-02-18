import en, { type TranslationKey } from "./en";
import es from "./es";
import fr from "./fr";

export type Locale = "en" | "es" | "fr";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Espa\u00f1ol",
  fr: "Fran\u00e7ais",
};

export const LOCALES = Object.keys(LOCALE_LABELS) as Locale[];

const translations: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  es,
  fr,
};

/**
 * Resolve a translation key. Interpolate `{var}` tokens.
 * Falls back to English if key is missing in the target locale.
 */
export function translate(
  locale: Locale,
  key: TranslationKey | string,
  vars?: Record<string, string | number>
): string {
  const table = translations[locale] ?? translations.en;
  let value = table[key] ?? translations.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return value;
}

export type { TranslationKey };

const STORAGE_KEY = "pitpilot_locale";

export function getSavedLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LOCALES.includes(saved as Locale)) return saved as Locale;
  // Try browser language
  const browserLang = navigator.language.slice(0, 2);
  if (LOCALES.includes(browserLang as Locale)) return browserLang as Locale;
  return "en";
}

export function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}
