'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatTime, viewerTimeZone } from '@/lib/time';

/**
 * Renders venue-local time on the server (deterministic, hydration-safe) and
 * adds the viewer's local time only after mount (client-only — the server can't
 * know the browser's timezone). Avoids the classic SSR tz hydration mismatch.
 */
export function KickoffTime({ iso, venueTz }: { iso: string; venueTz: string }) {
  const locale = useLocale();
  const t = useTranslations('Match');
  const [viewerTz, setViewerTz] = useState<string | null>(null);

  useEffect(() => setViewerTz(viewerTimeZone()), []);

  const venue = formatTime(iso, venueTz, locale);
  const viewer = viewerTz ? formatTime(iso, viewerTz, locale) : null;

  return (
    <span className="inline-flex flex-col text-xs leading-tight">
      <span>
        {venue} <span className="opacity-60">· {t('venueTime')}</span>
      </span>
      {viewer && viewer !== venue && (
        <span suppressHydrationWarning className="opacity-70">
          {viewer} · {t('yourTime')}
        </span>
      )}
    </span>
  );
}
