import { getTranslations, setRequestLocale, getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getMatchById } from '@/lib/data/catalog';
import { getLiveMatch } from '@/lib/live';
import { getMatchSummary } from '@/lib/ai/summary';
import { Crest } from '@/components/Crest';
import { KickoffTime } from '@/components/KickoffTime';
import { MatchLive } from '@/components/MatchLive';
import { formatDateTime } from '@/lib/time';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ locale: string; matchId: string }>;
}) {
  const { locale, matchId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Match');
  const tc = await getTranslations('Common');
  const activeLocale = await getLocale();

  const match = await getMatchById(matchId);
  if (!match) notFound();

  const live = await getLiveMatch(match);
  const summary = live ? await getMatchSummary(match, live, activeLocale) : null;

  const venueTz = match.venue?.ianaTz ?? 'UTC';
  const started = live?.status === 'live' || live?.status === 'paused' || live?.status === 'finished';

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-black/5 bg-surface p-4 shadow-sm dark:bg-white/5">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex flex-col items-center gap-2 text-center">
            <Crest src={match.home?.crestUrl} alt={match.home?.name ?? ''} size={44} />
            <span className="text-sm font-semibold">{match.home?.name ?? '—'}</span>
          </div>
          <div className="flex flex-col items-center">
            {started ? (
              <span className="text-sm font-semibold opacity-70">{tc('vs')}</span>
            ) : (
              <KickoffTime iso={match.kickoffUtc} venueTz={venueTz} />
            )}
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <Crest src={match.away?.crestUrl} alt={match.away?.name ?? ''} size={44} />
            <span className="text-sm font-semibold">{match.away?.name ?? '—'}</span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-black/5 pt-3 text-xs">
          <div>
            <dt className="opacity-50">{t('kickoff')}</dt>
            <dd>{formatDateTime(match.kickoffUtc, venueTz, activeLocale)}</dd>
          </div>
          {match.venue?.name && (
            <div>
              <dt className="opacity-50">{t('venue')}</dt>
              <dd>{match.venue.name}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Live score + AI summary (refreshes client-side while live) */}
      <MatchLive
        matchId={match.id}
        locale={activeLocale}
        initialLive={live}
        initialSummary={summary}
      />
    </div>
  );
}
