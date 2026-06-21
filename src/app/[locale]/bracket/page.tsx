import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getStandings } from '@/lib/data/catalog';
import { bracketSeed, toStandingsInput } from '@/lib/bracket/fromCatalog';
import { decodeScenario } from '@/lib/bracket/scenario';
import { BracketExplorer } from '@/components/bracket/BracketExplorer';

export default async function BracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Bracket');
  const sp = await searchParams;

  const standings = await getStandings();
  // allGroupsFinal=false → projection mode (groups still in progress).
  const input = toStandingsInput(standings, false);

  const overrides = decodeScenario(typeof sp.wi === 'string' ? sp.wi : undefined);
  const team = typeof sp.team === 'string' ? sp.team : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm opacity-70">{t('subtitle')}</p>
      </header>

      <BracketExplorer
        seed={bracketSeed}
        standings={input}
        initialOverrides={overrides}
        initialTeamId={team}
      />
    </div>
  );
}
