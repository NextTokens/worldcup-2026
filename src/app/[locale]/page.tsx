import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getMatches } from '@/lib/data/catalog';
import { catalogSourceName } from '@/lib/data/registry';
import { MatchCard } from '@/components/MatchCard';
import { dateKey } from '@/lib/time';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  const matches = await getMatches();
  const now = new Date();
  const todayKey = dateKey(now);

  const live = matches.filter((m) => m.status === 'live' || m.status === 'paused');
  const today = matches.filter((m) => dateKey(m.kickoffUtc) === todayKey);
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' && new Date(m.kickoffUtc) > now)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm opacity-70">{t('subtitle')}</p>
      </section>

      {live.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-red-600">{t('live')}</h2>
          {live.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold opacity-80">{t('todaysMatches')}</h2>
        {today.length > 0 ? (
          today.map((m) => <MatchCard key={m.id} match={m} />)
        ) : (
          <p className="rounded-lg bg-surface px-3 py-6 text-center text-sm opacity-60 dark:bg-white/5">
            {t('noMatchesToday')}
          </p>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold opacity-80">{t('upcoming')}</h2>
          {upcoming.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </section>
      )}

      {matches.length === 0 && (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-8 text-center text-sm opacity-70">
          No fixtures loaded. Set <code className="font-mono">FOOTBALL_DATA_API_KEY</code> for
          authoritative data; the free OpenFootball schedule loads at runtime otherwise. (Source:{' '}
          {catalogSourceName()})
        </p>
      )}
    </div>
  );
}
