import zh from '../content/i18n/zh.json';
import en from '../content/i18n/en.json';

export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Traditional Chinese leads, per the style guide. */
export const DEFAULT_LOCALE: Locale = 'zh';

export type Dictionary = typeof zh;

/*
 * Typing this as Record<Locale, Dictionary> means a key present in zh.json but
 * missing from en.json fails `astro check` and the build, rather than rendering
 * `undefined` to a reader.
 */
const dictionaries: Record<Locale, Dictionary> = { zh, en };

export function isLocale(value: string | undefined): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function useTranslations(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}

/**
 * Builds a path for a locale. `page` is the route below the language segment,
 * e.g. '' for the landing page or '/about'.
 */
export function localeHref(locale: Locale, page = ''): string {
  return `/${locale}${page}`;
}

/**
 * Fills {placeholders} in a translation string.
 * Used for the screen-reader labels on download controls.
 */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Drops the `**` emphasis markers from a copy string.
 *
 * Anywhere copy is used as plain text rather than rendered through
 * <Emphasis> — a meta description, an alt attribute, a page title — the
 * markers have to come off, or they ship to search results verbatim.
 */
export function plain(text: string): string {
  return text.replaceAll('**', '');
}
