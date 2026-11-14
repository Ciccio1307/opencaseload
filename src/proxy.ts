import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, getSessionFromToken } from '@/lib/session'

/**
 * Optimistic gate: visitors without a validly signed session cookie are sent
 * to /login. The real authorisation (signature + session epoch) is repeated
 * server-side in every page and Server Action, see src/lib/dal.ts.
 *
 * Signed-in visitors are deliberately NOT bounced away from /login: a token
 * whose epoch was revoked still has a valid signature, and dal.ts sends it to
 * /login, so bouncing it back to / would loop forever.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionFromToken(token))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Exclude Next.js internals and static files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sitemap.xml|robots.txt).*)',
  ],
}
