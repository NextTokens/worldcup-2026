import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getTeams, getSquad, getMatches } from '@/lib/data/catalog';
import { MatchCard } from '@/components/MatchCard';
import { Crest } from '@/components/Crest';
import { Link } from '@/i18n/navigation';
import { ageFrom } from '@/lib/time';

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Team');
  const tc = await getTranslations('Common');

  const teams = await getTeams();
  const team = teams.find((x) => x.id === teamId);
  const [squad, matches] = await Promise.all([getSquad(teamId), getMatches()]);
  if (!team && squad.length === 0) notFound();

  const fixtures = matches.filter(
    (m) => m.home?.id === teamId || m.away?.id === teamId,
  );
  const now = new Date();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Crest src={team?.crestUrl} alt={team?.name ?? teamId} size={40} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{team?.name ?? teamId}</h1>
          <p className="mt-1 text-xs">
            <Link href="/bracket" className="text-pitch-700 underline">
              {tc('viewYourPath')}
            </Link>
          </p>
        </div>
      </header>

      {fixtures.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold opacity-80">{t('fixtures')}</h2>
          {fixtures.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold opacity-80">{t('squad')}</h2>
        {squad.length === 0 ? (
          <p className="text-sm opacity-60">{t('noSquad')}</p>
        ) : (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 bg-surface dark:bg-white/5">
            {squad.map((p) => {
              const age = ageFrom(p.dob, now);
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-6 text-center tabular-nums opacity-50">
                    {p.shirtNumber ?? ''}
                  </span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs opacity-60">{p.position ?? ''}</span>
                  {age != null && <span className="w-8 text-end text-xs opacity-60">{age}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
