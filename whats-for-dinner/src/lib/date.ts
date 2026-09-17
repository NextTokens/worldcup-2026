/**
 * Dates are "what day is dinner", never timestamps. The server may well sit in
 * a different timezone from the family, so every calendar day is resolved
 * through APP_TIMEZONE (an IANA name, e.g. Europe/London).
 */

export function appTimeZone(): string {
  return process.env.APP_TIMEZONE || process.env.TZ || 'UTC';
}

/** YYYY-MM-DD for "now" in the family's timezone. */
export function todayIso(tz: string = appTimeZone()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addDays(dateIso: string, days: number): string {
  const ms = Date.parse(`${dateIso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** The next `count` days starting at `from`, inclusive. */
export function dateRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export function formatDay(dateIso: string, today: string): string {
  if (dateIso === today) return 'Today';
  if (dateIso === addDays(today, 1)) return 'Tomorrow';
  if (dateIso === addDays(today, -1)) return 'Yesterday';
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function weekdayLong(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}
