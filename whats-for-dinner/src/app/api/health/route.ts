import { NextResponse } from 'next/server';
import { databaseConfigured, getSql } from '@/lib/db';
import { aiConfigured } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

/** Railway health check. Reports degraded rather than failing on a DB blip. */
export async function GET() {
  let database: 'ok' | 'unreachable' | 'not-configured' = 'not-configured';

  if (databaseConfigured()) {
    try {
      await getSql()`select 1`;
      database = 'ok';
    } catch {
      database = 'unreachable';
    }
  }

  return NextResponse.json({
    status: 'ok',
    database,
    ai: aiConfigured() ? 'configured' : 'disabled',
    time: new Date().toISOString(),
  });
}
