import { useTranslations } from 'next-intl';
import { Crest } from './Crest';
import type { AppGroupStanding } from '@/lib/data/provider';

export function GroupTable({ group }: { group: AppGroupStanding }) {
  const t = useTranslations('Standings');
  const tc = useTranslations('Common');

  return (
    <div className="overflow-hidden rounded-lg border border-black/5 bg-surface shadow-sm dark:bg-white/5">
      <h3 className="border-b border-black/5 px-3 py-2 text-sm font-bold">
        {tc('groupX', { letter: group.group })}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide opacity-60">
            <th className="px-2 py-1.5 text-start font-medium">{t('pos')}</th>
            <th className="px-1 py-1.5 text-start font-medium">{t('team')}</th>
            <th className="px-1 py-1.5 text-center font-medium">{t('played')}</th>
            <th className="px-1 py-1.5 text-center font-medium">{t('goalDifference')}</th>
            <th className="px-2 py-1.5 text-center font-medium">{t('points')}</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => {
            const pos = r.rank ?? i + 1;
            // Top 2 qualify directly; 3rd is "in the race" (best 8 of 12 advance).
            const advance = pos <= 2;
            const bubble = pos === 3;
            return (
              <tr
                key={r.teamId ?? r.teamName}
                className="border-t border-black/5 last:border-b-0"
              >
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                      advance
                        ? 'bg-pitch-500/15 text-pitch-700'
                        : bubble
                          ? 'bg-amber-400/20 text-amber-700'
                          : 'opacity-60'
                    }`}
                  >
                    {pos}
                  </span>
                </td>
                <td className="px-1 py-1.5">
                  <span className="flex items-center gap-2">
                    <Crest src={r.crestUrl} alt={r.teamName} size={18} />
                    <span className="truncate">{r.teamName}</span>
                  </span>
                </td>
                <td className="px-1 py-1.5 text-center tabular-nums">{r.played}</td>
                <td className="px-1 py-1.5 text-center tabular-nums">
                  {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                </td>
                <td className="px-2 py-1.5 text-center font-bold tabular-nums">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
