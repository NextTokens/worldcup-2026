import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getStandings } from '@/lib/data/catalog';
import { GroupTable } from '@/components/GroupTable';

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Groups');

  const standings = await getStandings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-xs opacity-60">{t('thirdPlaceNote')}</p>
      </div>

      {standings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-8 text-center text-sm opacity-70">
          {t('thirdPlaceNote')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {standings.map((g) => (
            <GroupTable key={g.group} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
