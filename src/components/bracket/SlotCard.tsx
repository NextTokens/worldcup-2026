'use client';

import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { Crest } from '@/components/Crest';
import type { ResolvedSlot, ResolvedSide, TeamLite } from '@/lib/bracket/types';

function usePlaceholderLabel() {
  const t = useTranslations('Bracket');
  return (side: ResolvedSide): string => {
    const s = side.source;
    switch (s.kind) {
      case 'group_winner':
        return t('winnerGroup', { letter: s.group });
      case 'group_runnerup':
        return t('runnerUpGroup', { letter: s.group });
      case 'third_place':
        return t('bestThird', { groups: s.candidates.join('/') });
      case 'match_winner':
        return t('winnerOfMatch', { n: side.label.replace(/\D/g, '') });
      case 'match_loser':
        return t('loserOfMatch', { n: side.label.replace(/\D/g, '') });
      default:
        return t('tbd');
    }
  };
}

function possibleText(teams: TeamLite[]): { text: string; more: number } {
  const names = teams.map((t) => t.name);
  const shown = names.slice(0, 3);
  return { text: shown.join(' / '), more: Math.max(0, names.length - shown.length) };
}

export function SlotCard({
  slot,
  onPick,
  highlightTeamId,
}: {
  slot: ResolvedSlot;
  onPick?: (slotId: string, side: 'home' | 'away') => void;
  highlightTeamId?: string | null;
}) {
  const t = useTranslations('Bracket');
  const placeholder = usePlaceholderLabel();

  const renderSide = (side: ResolvedSide, which: 'home' | 'away') => {
    const isWinner = slot.winner != null && side.team?.id === slot.winner.id;
    const isHighlight = highlightTeamId != null && side.team?.id === highlightTeamId;
    const clickable = !!onPick && !!side.team;

    let content;
    if (side.team) {
      content = (
        <>
          <Crest src={side.team.crestUrl} alt={side.team.name} size={18} />
          <span className="flex-1 truncate">{side.team.name}</span>
        </>
      );
    } else if (side.possible.length > 0) {
      const { text, more } = possibleText(side.possible);
      content = (
        <span className="flex-1 truncate text-xs italic opacity-70">
          {text}
          {more > 0 ? ` +${more}` : ''}
        </span>
      );
    } else {
      content = <span className="flex-1 truncate opacity-55">{placeholder(side)}</span>;
    }

    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={clickable ? () => onPick!(slot.slotId, which) : undefined}
        className={clsx(
          'flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-start text-sm transition-colors sm:min-h-0 sm:py-1.5',
          clickable && 'hover:bg-pitch-500/10',
          isWinner && 'font-bold',
          isHighlight && 'bg-pitch-500/15',
        )}
      >
        {content}
        {isWinner && <span className="text-pitch-600">✓</span>}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-surface shadow-sm dark:bg-white/5">
      <div className="flex items-center justify-between gap-2 border-b border-black/5 px-2 py-1 text-[10px] uppercase tracking-wide opacity-55">
        <span>#{slot.matchNumber}</span>
        <span className="flex items-center gap-1">
          {slot.overridden && (
            <span className="rounded bg-[var(--color-slot-whatif)]/15 px-1 text-[var(--color-slot-whatif)]">
              {t('whatIf')}
            </span>
          )}
          {slot.date && <span>{slot.date.slice(5)}</span>}
        </span>
      </div>
      {renderSide(slot.home, 'home')}
      <div className="border-t border-black/5" />
      {renderSide(slot.away, 'away')}
    </div>
  );
}
