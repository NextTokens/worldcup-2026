import { NextRequest, NextResponse } from 'next/server';
import { getMatchById } from '@/lib/data/catalog';
import { getLiveMatch } from '@/lib/live';
import { getMatchSummary } from '@/lib/ai/summary';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

/** Live state + AI summary for a match, in the requested locale (client poller). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const requested = req.nextUrl.searchParams.get('locale') ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(requested)
    ? requested
    : routing.defaultLocale;

  const match = await getMatchById(matchId);
  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const live = await getLiveMatch(match);
  const summary = live ? await getMatchSummary(match, live, locale) : null;

  return NextResponse.json({ live, summary });
}
