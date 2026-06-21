import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getTeams } from '@/lib/data/catalog';
import { Link } from '@/i18n/navigation';
import { Crest } from '@/components/Crest';

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Nav');

  const teams = (await getTeams()).filter((team) => team.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('teams')}</h1>

      {teams.length === 0 ? (
        <p className="text-sm opacity-60">—</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className="flex items-center gap-2 rounded-lg border border-black/5 bg-surface px-3 py-2 text-sm shadow-sm hover:bg-surface-muted dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Crest src={team.crestUrl} alt={team.name} />
                <span className="truncate">{team.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
