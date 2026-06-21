'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { AppLiveMatch } from '@/lib/data/provider';
import type { MatchSummary } from '@/lib/ai/summary';

function eventIcon(type: string): string {
  if (type.includes('goal')) return '⚽';
  if (type === 'red' || type === 'yellow_red') return '🟥';
  if (type === 'yellow') return '🟨';
  if (type === 'substitution') return '🔁';
  return '•';
}

export function MatchLive({
  matchId,
  locale,
  initialLive,
  initialSummary,
}: {
  matchId: string;
  locale: string;
  initialLive: AppLiveMatch | null;
  initialSummary: MatchSummary | null;
}) {
  const t = useTranslations('Match');
  const tc = useTranslations('Common');
  const [live, setLive] = useState<AppLiveMatch | null>(initialLive);
  const [summary, setSummary] = useState<MatchSummary | null>(initialSummary);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${matchId}/live?locale=${locale}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { live: AppLiveMatch | null; summary: MatchSummary | null };
      setLive(data.live ?? null);
      setSummary(data.summary ?? null);
    } catch {
      /* keep last known */
    }
  }, [matchId, locale]);

  const isLive = live?.status === 'live' || live?.status === 'paused';

  useEffect(() => {
    if (!isLive) return;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isLive, refresh]);

  const finished = live?.status === 'finished';
  const showScore = isLive || finished;

  return (
    <div className="space-y-4">
      {showScore && live && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-black/5 bg-surface py-3 shadow-sm dark:bg-white/5">
          <span className="text-3xl font-extrabold tabular-nums">
            {live.homeScore ?? 0}–{live.awayScore ?? 0}
          </span>
          <span className={isLive ? 'text-xs font-semibold text-red-600' : 'text-xs opacity-60'}>
            {isLive ? `${tc('live')}${live.minute ? ` ${live.minute}'` : ''}` : tc('finished')}
          </span>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold opacity-80">{t('aiSummary')}</h2>
        <div className="rounded-xl border border-black/5 bg-surface p-4 text-sm shadow-sm dark:bg-white/5">
          {summary ? (
            <>
              <p className="leading-relaxed">{summary.body}</p>
              {summary.asOfMinute != null && (
                <p className="mt-2 text-[11px] font-medium opacity-50">
                  {t('asOfMinute', { minute: summary.asOfMinute })}
                </p>
              )}
              {summary.keyEvents.length > 0 && (
                <div className="mt-3 border-t border-black/5 pt-3">
                  <p className="mb-1 text-xs font-semibold opacity-70">{t('latestUpdates')}</p>
                  <ul className="space-y-1">
                    {summary.keyEvents
                      .slice()
                      .reverse()
                      .map((e) => (
                        <li key={e.sourceEventId} className="flex items-start gap-2 text-xs">
                          <span className="w-8 shrink-0 tabular-nums opacity-50">
                            {e.minute != null ? `${e.minute}'` : ''}
                          </span>
                          <span aria-hidden>{eventIcon(e.type)}</span>
                          <span className="flex-1">{e.description}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="opacity-70">{t('noSummaryYet')}</p>
          )}
          <p className="mt-3 text-[11px] opacity-50">{t('aiDisclaimer')}</p>
        </div>
      </section>
    </div>
  );
}
