'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { resolveBracket } from '@/lib/bracket/engine';
import { teamPath } from '@/lib/bracket/path';
import { encodeScenario, type Overrides } from '@/lib/bracket/scenario';
import type { BracketSeed, StandingsInput, BracketRound } from '@/lib/bracket/types';
import { SlotCard } from './SlotCard';

type View = 'rounds' | 'overview' | 'path';
type RankChoice = 'current' | 1 | 2 | 3;

const ROUND_KEYS: [BracketRound, string][] = [
  ['R32', 'roundOf32'],
  ['R16', 'roundOf16'],
  ['QF', 'quarterFinals'],
  ['SF', 'semiFinals'],
  ['F', 'final'],
];

/** Force a team to a given group finishing position (for the tri-route view). */
function withForcedRank(
  standings: StandingsInput,
  teamId: string,
  group: string,
  rank: 1 | 2 | 3,
): StandingsInput {
  const g = standings.groups[group];
  if (!g) return standings;
  const ranked = g.ranked.filter((r) => r.team.id !== teamId);
  const me = g.ranked.find((r) => r.team.id === teamId);
  if (!me) return standings;
  ranked.splice(rank - 1, 0, me);
  const reRanked = ranked.map((r, i) => ({ ...r, rank: i + 1 }));

  // For a 3rd-place route, ensure the team is considered among the qualifying thirds.
  let thirdPlaceOrder = standings.thirdPlaceOrder;
  if (rank === 3) {
    thirdPlaceOrder = [
      { group, team: me.team, clinched: false },
      ...standings.thirdPlaceOrder.filter((t) => t.group !== group),
    ];
  }

  return {
    ...standings,
    groups: { ...standings.groups, [group]: { ...g, ranked: reRanked } },
    thirdPlaceOrder,
  };
}

export function BracketExplorer({
  seed,
  standings,
  initialOverrides = {},
  initialTeamId = null,
}: {
  seed: BracketSeed;
  standings: StandingsInput;
  initialOverrides?: Overrides;
  initialTeamId?: string | null;
}) {
  const t = useTranslations('Bracket');
  const tc = useTranslations('Common');
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [view, setView] = useState<View>(initialTeamId ? 'path' : 'rounds');
  const [teamId, setTeamId] = useState<string | null>(initialTeamId);
  const [rankChoice, setRankChoice] = useState<RankChoice>('current');

  const resolved = useMemo(
    () => resolveBracket({ seed, standings, overrides }),
    [seed, standings, overrides],
  );

  const teams = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of Object.values(standings.groups)) {
      for (const r of g.ranked) m.set(r.team.id, r.team.name);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [standings]);

  const teamGroup = useMemo(() => {
    if (!teamId) return null;
    for (const [letter, g] of Object.entries(standings.groups)) {
      if (g.ranked.some((r) => r.team.id === teamId)) return letter;
    }
    return null;
  }, [teamId, standings]);

  const selectedTeamName = teamId ? teams.find((x) => x.id === teamId)?.name ?? '' : '';

  const pick = useCallback((slotId: string, side: 'home' | 'away') => {
    setOverrides((o) => ({ ...o, [slotId]: side }));
  }, []);

  const reset = useCallback(() => setOverrides({}), []);

  const share = useCallback(() => {
    const params = new URLSearchParams();
    const enc = encodeScenario(overrides);
    if (enc) params.set('wi', enc);
    if (teamId) params.set('team', teamId);
    const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState(null, '', url);
    void navigator.clipboard?.writeText(window.location.origin + url).catch(() => {});
  }, [overrides, teamId]);

  const slotsByRound = (round: BracketRound) =>
    Object.values(resolved.slots)
      .filter((s) => s.round === round)
      .sort((a, b) => a.matchNumber - b.matchNumber);

  // Path view bracket (optionally with a forced finishing rank).
  const pathBracket = useMemo(() => {
    if (rankChoice === 'current' || !teamId || !teamGroup) return resolved;
    return resolveBracket({
      seed,
      standings: withForcedRank(standings, teamId, teamGroup, rankChoice),
      overrides,
    });
  }, [rankChoice, teamId, teamGroup, resolved, seed, standings, overrides]);

  const path = useMemo(
    () => (teamId ? teamPath(seed, pathBracket, teamId) : []),
    [teamId, seed, pathBracket],
  );

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-4">
      {/* View tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-black/10 p-0.5 text-sm">
          {(
            [
              ['rounds', t('viewByRound')],
              ['overview', t('viewOverview')],
              ['path', t('viewYourPath')],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={clsx(
                'rounded-md px-3 py-1',
                view === v ? 'bg-pitch-600 text-white' : 'opacity-70 hover:opacity-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {hasOverrides && (
          <button type="button" onClick={reset} className="text-sm text-pitch-700 underline">
            {t('resetProjection')}
          </button>
        )}
        <button type="button" onClick={share} className="ms-auto text-sm text-pitch-700 underline">
          {t('share')}
        </button>
      </div>

      {/* Team selector */}
      <div className="flex items-center gap-2">
        <select
          aria-label={t('viewYourPath')}
          value={teamId ?? ''}
          onChange={(e) => {
            setTeamId(e.target.value || null);
            setRankChoice('current');
            if (e.target.value) setView('path');
          }}
          className="w-full rounded-lg border border-black/10 bg-surface px-2 py-1.5 text-sm dark:bg-white/5"
        >
          <option value="">{t('pickTeam')}</option>
          {teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <p className="text-[11px] opacity-60">{t('basedOnStandings')}</p>
      {(hasOverrides || teamId) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-60">
          {hasOverrides && (
            <span className="text-[var(--color-slot-whatif)]">■ {t('whatIf')}</span>
          )}
          {teamId && (
            <span className="text-pitch-700">■ {teams.find((x) => x.id === teamId)?.name}</span>
          )}
        </p>
      )}

      {view === 'rounds' && (
        <div className="space-y-5">
          {ROUND_KEYS.map(([round, key]) => (
            <section key={round} className="space-y-2">
              <h2 className="text-sm font-semibold opacity-80">{t(key)}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {slotsByRound(round).map((s) => (
                  <SlotCard key={s.slotId} slot={s} onPick={pick} highlightTeamId={teamId} />
                ))}
              </div>
            </section>
          ))}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold opacity-80">{t('thirdPlace')}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {slotsByRound('3P').map((s) => (
                <SlotCard key={s.slotId} slot={s} onPick={pick} highlightTeamId={teamId} />
              ))}
            </div>
          </section>
        </div>
      )}

      {view === 'overview' && (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max gap-3">
            {ROUND_KEYS.map(([round, key]) => (
              <div key={round} className="flex w-56 shrink-0 flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  {t(key)}
                </h2>
                {slotsByRound(round).map((s) => (
                  <SlotCard key={s.slotId} slot={s} onPick={pick} highlightTeamId={teamId} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'path' && (
        <div className="space-y-3">
          {!teamId && <p className="text-sm opacity-60">{t('pickTeam')}</p>}

          {teamId && teamGroup && !standings.groups[teamGroup]?.final && (
            <div className="inline-flex rounded-lg border border-black/10 p-0.5 text-xs">
              {(
                [
                  ['current', t('projected')],
                  [1, t('first')],
                  [2, t('second')],
                  [3, t('third')],
                ] as [RankChoice, string][]
              ).map(([r, label]) => (
                <button
                  key={String(r)}
                  type="button"
                  aria-pressed={rankChoice === r}
                  onClick={() => setRankChoice(r)}
                  className={clsx(
                    'rounded-md px-2.5 py-1',
                    rankChoice === r ? 'bg-pitch-600 text-white' : 'opacity-70',
                  )}
                >
                  {r === 'current' ? label : `${t('ifFinishes', { team: '' }).trim()} ${label}`}
                </button>
              ))}
            </div>
          )}

          {teamId && path.length === 0 && (
            <p className="rounded-lg border border-dashed border-black/15 px-3 py-6 text-center text-sm opacity-70">
              {t('thirdPlace')} — {t('tbd')}
            </p>
          )}

          {path.map((step) => {
            const picked = overrides[step.slot.slotId] === step.teamSide;
            const opp = step.opponent;
            const oppIsPossible = !opp.team && opp.possible.length > 0;
            const oppName = opp.team
              ? opp.team.name
              : opp.possible.length > 0
                ? opp.possible.slice(0, 3).map((x) => x.name).join(' / ') +
                  (opp.possible.length > 3 ? ` +${opp.possible.length - 3}` : '')
                : t('tbd');
            return (
              <div
                key={step.slot.slotId}
                className="rounded-lg border border-black/10 bg-surface p-3 shadow-sm dark:bg-white/5"
              >
                <div className="flex items-center justify-between text-xs font-semibold opacity-70">
                  <span>{t(ROUND_KEYS.find(([r]) => r === step.slot.round)?.[1] ?? 'final')}</span>
                  <span className="font-normal opacity-60">
                    {step.slot.date?.slice(5)}
                    {step.slot.venue?.name ? ` · ${step.slot.venue.name}` : ''}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-pitch-700">{selectedTeamName}</span>
                  <span className="opacity-50">{tc('vs')}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {oppIsPossible && (
                      <span className="me-1 opacity-50">{t('couldFace')}:</span>
                    )}
                    <span className={oppIsPossible ? 'italic opacity-70' : ''}>{oppName}</span>
                  </span>
                  <button
                    type="button"
                    aria-pressed={picked}
                    onClick={() => pick(step.slot.slotId, step.teamSide)}
                    className={clsx(
                      'shrink-0 rounded-md px-2 py-1 text-xs',
                      picked ? 'bg-pitch-600 text-white' : 'border border-black/15',
                    )}
                  >
                    {picked ? t('advanced') : t('advance')}
                  </button>
                </div>
              </div>
            );
          })}

          {teamId && resolved.champion?.id === teamId && (
            <p className="rounded-lg bg-pitch-500/15 px-3 py-3 text-center text-sm font-bold text-pitch-700">
              🏆 {t('champion')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
