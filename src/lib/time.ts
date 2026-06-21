/**
 * Timezone & locale-aware formatting (ARCHITECTURE.md §5).
 *
 * Rules:
 *  - All instants are stored/transported in UTC (ISO 8601).
 *  - The SERVER always formats with an EXPLICIT timeZone (UTC or the venue zone)
 *    so SSR output is deterministic and hydration-safe.
 *  - VIEWER-LOCAL time is inherently client-only (the server can't know the
 *    browser's zone) — render it after mount. See <KickoffTime>.
 *
 * These functions are pure and isomorphic.
 */

export function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

export function formatInTimeZone(
  d: Date | string | number,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(toDate(d));
}

/** Time only, e.g. "19:00". */
export function formatTime(d: Date | string | number, timeZone: string, locale: string): string {
  return formatInTimeZone(d, timeZone, locale, { hour: '2-digit', minute: '2-digit' });
}

/** Date + time, e.g. "Jun 11, 19:00". */
export function formatDateTime(
  d: Date | string | number,
  timeZone: string,
  locale: string,
): string {
  return formatInTimeZone(d, timeZone, locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Long weekday + date heading, e.g. "Thursday, 11 June". */
export function formatDateHeading(
  d: Date | string | number,
  timeZone: string,
  locale: string,
): string {
  return formatInTimeZone(d, timeZone, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Stable grouping key for "by day" schedules. Computed in a fixed zone (UTC by
 * default) so server and client agree regardless of the viewer's locale/zone.
 * Returns "YYYY-MM-DD".
 */
export function dateKey(d: Date | string | number, timeZone = 'UTC'): string {
  // en-CA yields ISO-like YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(d));
}

/** Detect the viewer's IANA timezone (client-only). */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Whole years between dob and now — locale-independent. Returns null if no dob. */
export function ageFrom(dob: string | null | undefined, now: Date): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
