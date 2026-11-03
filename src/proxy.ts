import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromToken } from '@/lib/session'

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  // Optimistic check: validate the session cookie signature.
  // The real authorisation is repeated server-side in every Server Action (see src/lib/dal.ts).
  const isAuthorized = await getSessionFromToken(sessionCookie?.value)

  // If the user is not authenticated and is not on the login page, redirect to /login
  if (!isAuthorized && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If the user is authenticated and tries to open /login, redirect to the home page
  if (isAuthorized && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
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
