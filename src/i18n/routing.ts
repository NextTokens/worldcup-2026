import { defineRouting } from 'next-intl/routing';

/**
 * Initial 6 locales (ARCHITECTURE.md §5): host-nation languages + the largest
 * global football audiences, and validates RTL (Arabic) + CJK (Chinese) early.
 */
export const locales = ['en', 'es', 'fr', 'pt', 'ar', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Right-to-left locales — drives the <html dir> attribute and bracket mirroring. */
export const rtlLocales: readonly Locale[] = ['ar'];

export function isRtl(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale);
}

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  ar: 'العربية',
  zh: '中文',
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Default locale served at "/", others prefixed ("/es", "/ar"). SEO-friendly.
  localePrefix: 'as-needed',
});
