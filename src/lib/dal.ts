import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { currentEpoch } from '@/lib/sessionEpoch';

/**
 * Ensures the request is authenticated. Call it at the start of every Server
 * Action and every function that reads or writes sensitive data: the proxy
 * only performs an optimistic check, this is the real line of defence.
 *
 * Besides the signature it checks the session epoch, so tokens revoked by a
 * password change or "Sign out of all devices" stop working at once, even
 * though their signature is still valid. Cached per request.
 */
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session || session.epoch !== (await currentEpoch())) {
    redirect('/login');
  }
  return { isAuth: true as const };
});
