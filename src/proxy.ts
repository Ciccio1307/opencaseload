import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromToken } from '@/lib/session'

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  // Controllo ottimistico: valida la firma del cookie di sessione.
  // La vera autorizzazione viene rifatta lato server in ogni Server Action (vedi src/lib/dal.ts).
  const isAuthorized = await getSessionFromToken(sessionCookie?.value)

  // Se l'utente non è autenticato e non è sulla pagina di login, reindirizza a /login
  if (!isAuthorized && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Se l'utente è autenticato e cerca di andare su /login, reindirizza alla home /
  if (isAuthorized && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Esclude i path interni di Next.js e i file statici
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sitemap.xml|robots.txt).*)',
  ],
}
