import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Crest } from './Crest';
import { KickoffTime } from './KickoffTime';
import type { AppMatch, AppTeamRef } from '@/lib/data/provider';

function TeamLine({ team, align = 'start' }: { team: AppTeamRef | null; align?: 'start' | 'end' }) {
  const name = team?.name ?? '—';
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === 'end' ? 'flex-row-reverse text-end' : ''
      }`}
    >
      <Crest src={team?.crestUrl} alt={name} />
      <span className="truncate text-sm font-medium">{name}</span>
    </div>
  );
}

export function MatchCard({ match }: { match: AppMatch }) {
  const t = useTranslations('Common');
  const live = match.status === 'live' || match.status === 'paused';
  const finished = match.status === 'finished';
  const showScore = live || finished;

  return (
    <Link
      href={`/match/${match.id}`}
      className="flex items-center gap-3 rounded-lg border border-black/5 bg-surface px-3 py-2.5 shadow-sm transition-colors hover:bg-surface-muted dark:bg-white/5 dark:hover:bg-white/10"
    >
      <TeamLine team={match.home} />
      <div className="flex w-16 shrink-0 flex-col items-center">
        {showScore ? (
          <span className="text-base font-bold tabular-nums">
            {match.homeScore ?? 0}–{match.awayScore ?? 0}
          </span>
        ) : (
          <KickoffTime iso={match.kickoffUtc} venueTz={match.venue?.ianaTz ?? 'UTC'} />
        )}
        {live && (
          <span className="mt-0.5 text-[10px] font-semibold text-red-600">
            {t('live')}
            {match.minute ? ` ${match.minute}'` : ''}
          </span>
        )}
        {finished && <span className="mt-0.5 text-[10px] opacity-60">{t('finished')}</span>}
      </div>
      <TeamLine team={match.away} align="end" />
    </Link>
  );
}
