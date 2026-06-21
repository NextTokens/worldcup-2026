'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/routing';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={(e) => {
        const next = e.target.value as Locale;
        // Keep the current path, switch locale (next-intl handles the prefix).
        router.replace(pathname, { locale: next });
      }}
      className="shrink-0 rounded bg-white/15 px-2 py-1 text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-600"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="text-black">
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}
