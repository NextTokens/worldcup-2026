import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from './session-cookie';

/**
 * Household sign-in.
 *
 * One shared passcode for the family — no accounts, no third-party sign-in.
 * If APP_PASSWORD is unset the app is open, which is fine locally and flagged
 * in the UI so nobody deploys it that way by accident.
 */

export { SESSION_COOKIE };
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — a family device stays signed in.

function secret(): string {
  return process.env.SESSION_SECRET ?? process.env.APP_PASSWORD ?? 'whats-for-dinner-dev-secret';
}

export function passwordRequired(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Token is `issuedAt.signature`, so rotating the secret logs everyone out. */
export function issueToken(): string {
  const issued = Date.now().toString(36);
  const sig = createHmac('sha256', secret()).update(issued).digest('hex');
  return `${issued}.${sig}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [issued, sig] = token.split('.');
  if (!issued || !sig) return false;

  const expected = createHmac('sha256', secret()).update(issued).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const ageMs = Date.now() - parseInt(issued, 36);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_SECONDS * 1000;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  const a = Buffer.from(candidate ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isSignedIn(): Promise<boolean> {
  if (!passwordRequired()) return true;
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export async function signIn(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, issueToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Guard for server actions. */
export async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error('Not signed in');
}

/**
 * Guard for pages. The Edge middleware only checks that a cookie is present —
 * it cannot verify the HMAC — so every page re-checks it here in Node.
 */
export async function requirePage(next?: string): Promise<void> {
  if (await isSignedIn()) return;
  redirect(next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login');
}
