import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/**
 * Ensures the request is authenticated. Call it at the start of every Server
 * Action and every function that reads or writes sensitive data: the proxy
 * only performs an optimistic check, this is the real line of defence.
 */
export const verifySession = cache(async () => {
  const isAuthorized = await getSession();
  if (!isAuthorized) {
    redirect('/login');
  }
  return { isAuth: true as const };
});
