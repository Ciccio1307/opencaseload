import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/**
 * Verifica che la richiesta sia autenticata. Da chiamare all'inizio di ogni
 * Server Action e di ogni funzione che legge/scrive dati sensibili: il proxy
 * fa solo un controllo ottimistico, questa è la vera linea di difesa.
 */
export const verifySession = cache(async () => {
  const isAuthorized = await getSession();
  if (!isAuthorized) {
    redirect('/login');
  }
  return { isAuth: true as const };
});
