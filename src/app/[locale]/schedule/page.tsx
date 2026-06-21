import { getTranslations, setRequestLocale, getLocale } from 'next-intl/server';
import { getMatches } from '@/lib/data/catalog';
import { MatchCard } from '@/components/MatchCard';
import { dateKey, formatDateHeading } from '@/lib/time';
import type { AppMatch } from '@/lib/data/provider';

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Schedule');
  const activeLocale = await getLocale();

  const matches = await getMatches();

  // Group by UTC calendar day (deterministic, hydration-safe).
  const byDay = new Map<string, AppMatch[]>();
  for (const m of matches) {
    const key = dateKey(m.kickoffUtc);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {days.length === 0 && <p className="text-sm opacity-60">{t('noMatches')}</p>}

      {days.map((day) => (
        <section key={day} className="space-y-2">
          <h2 className="sticky top-14 z-10 bg-surface-muted/90 py-1 text-sm font-semibold capitalize backdrop-blur dark:bg-[#0b1220]/90">
            {formatDateHeading(`${day}T12:00:00Z`, 'UTC', activeLocale)}
          </h2>
          {byDay.get(day)!.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </section>
      ))}
    </div>
  );
}
