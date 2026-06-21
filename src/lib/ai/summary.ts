import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { cacheGet, cacheSet } from '@/lib/cache';
import { liveSeq } from '@/lib/live';
import type { AppMatch, AppLiveMatch, AppLiveEvent } from '@/lib/data/provider';

/**
 * AI live-summary engine (ARCHITECTURE.md §4). Grounded in fetched events only,
 * structured output with mandatory source_event_id validation, per-locale,
 * cached by (matchId, eventSeq, status, locale). Falls back to a templated recap
 * when ANTHROPIC_API_KEY is absent so the feature is always visible.
 */

const MODEL = 'claude-haiku-4-5';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  ar: 'Arabic',
  zh: 'Simplified Chinese',
};

export interface SummaryEvent {
  minute: number | null;
  type: string;
  description: string;
  sourceEventId: string;
}

export interface MatchSummary {
  body: string;
  keyEvents: SummaryEvent[];
  asOfMinute: number | null;
  score: { home: number | null; away: number | null };
  generated: boolean; // true = AI, false = templated fallback
}

const GROUNDING_CONTRACT = `You generate concise live summaries for football (soccer) matches at the FIFA World Cup.
Rules you MUST follow:
- Summarize ONLY the events provided in the user message. Invent nothing.
- No player history, no predictions, no opinions, no events not in the data.
- If the data is sparse, say so plainly rather than padding.
- Every entry in key_events MUST cite a source_event_id that appears in the input events.
- Keep the summary to 2-4 sentences. Be factual and neutral.
- Write the summary and descriptions in the requested language.`;

const SummaryZ = z.object({
  summary: z.string(),
  key_events: z
    .array(
      z.object({
        minute: z.number().nullable().optional(),
        type: z.string(),
        description: z.string(),
        source_event_id: z.string(),
      }),
    )
    .default([]),
  as_of_minute: z.number().nullable().optional(),
});

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-4 sentence grounded recap in the requested language.' },
    key_events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          minute: { type: 'number' },
          type: { type: 'string' },
          description: { type: 'string' },
          source_event_id: { type: 'string' },
        },
        required: ['type', 'description', 'source_event_id'],
      },
    },
    as_of_minute: { type: 'number' },
  },
  required: ['summary', 'key_events'],
};

function eventLabel(type: AppLiveEvent['type']): string {
  switch (type) {
    case 'goal':
    case 'penalty_goal':
      return 'Goal';
    case 'own_goal':
      return 'Own goal';
    case 'penalty_missed':
      return 'Penalty missed';
    case 'yellow':
      return 'Yellow card';
    case 'red':
    case 'yellow_red':
      return 'Red card';
    case 'substitution':
      return 'Substitution';
    default:
      return 'VAR';
  }
}

function templateFallback(match: AppMatch, live: AppLiveMatch): MatchSummary {
  const home = match.home?.name ?? 'Home';
  const away = match.away?.name ?? 'Away';
  const score = `${live.homeScore ?? 0}–${live.awayScore ?? 0}`;
  const body =
    live.status === 'finished'
      ? `Full time: ${home} ${score} ${away}.`
      : `${home} ${score} ${away}${live.minute ? `, ${live.minute}'` : ''}.`;
  const keyEvents: SummaryEvent[] = live.events.slice(-6).map((e) => ({
    minute: e.minute,
    type: e.type,
    description: `${eventLabel(e.type)}${e.player ? ` — ${e.player}` : ''}`,
    sourceEventId: e.eventId,
  }));
  return {
    body,
    keyEvents,
    asOfMinute: live.minute ?? null,
    score: { home: live.homeScore, away: live.awayScore },
    generated: false,
  };
}

async function generateWithClaude(
  match: AppMatch,
  live: AppLiveMatch,
  locale: string,
): Promise<MatchSummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const lang = LOCALE_NAMES[locale] ?? 'English';
  const validIds = new Set(live.events.map((e) => e.eventId));

  const payload = {
    home: match.home?.name,
    away: match.away?.name,
    status: live.status,
    minute: live.minute,
    score: { home: live.homeScore, away: live.awayScore },
    events: live.events.map((e) => ({
      event_id: e.eventId,
      minute: e.minute,
      type: e.type,
      team: e.teamId,
      player: e.player,
    })),
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [{ type: 'text', text: GROUNDING_CONTRACT, cache_control: { type: 'ephemeral' } }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ name: 'emit_summary', description: 'Return the grounded match summary.', input_schema: TOOL_SCHEMA as any }],
    tool_choice: { type: 'tool', name: 'emit_summary' },
    messages: [
      {
        role: 'user',
        content: `Write the summary in ${lang}. Summarize ONLY this match data (JSON):\n${JSON.stringify(payload)}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return null;
  const parsed = SummaryZ.safeParse(block.input);
  if (!parsed.success) return null;

  // Anti-hallucination: drop any key_event whose id isn't in the input feed.
  const keyEvents: SummaryEvent[] = parsed.data.key_events
    .filter((k) => validIds.has(k.source_event_id))
    .map((k) => ({
      minute: k.minute ?? null,
      type: k.type,
      description: k.description,
      sourceEventId: k.source_event_id,
    }));

  return {
    body: parsed.data.summary,
    keyEvents,
    asOfMinute: parsed.data.as_of_minute ?? live.minute ?? null,
    score: { home: live.homeScore, away: live.awayScore },
    generated: true,
  };
}

export async function getMatchSummary(
  match: AppMatch,
  live: AppLiveMatch,
  locale: string,
): Promise<MatchSummary | null> {
  if (live.status === 'scheduled') return null;

  const key = `sum:${match.id}:${locale}:${live.status}:${liveSeq(live)}`;
  const cached = await cacheGet<MatchSummary>(key);
  if (cached) return cached;

  let summary: MatchSummary | null = null;
  try {
    summary = await generateWithClaude(match, live, locale);
  } catch {
    summary = null;
  }
  if (!summary) summary = templateFallback(match, live);

  await cacheSet(key, summary, 60);
  return summary;
}
