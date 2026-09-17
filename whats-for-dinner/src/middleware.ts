import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session-cookie';

/**
 * Edge-side gate. It only checks that a session cookie is present and
 * well-formed enough to be worth trying; the signature is verified in Node on
 * the page itself (`isSignedIn`), because the Edge runtime has no node:crypto.
 */
export function middleware(req: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && token.includes('.')) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = req.nextUrl.pathname === '/' ? '' : `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/health|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
