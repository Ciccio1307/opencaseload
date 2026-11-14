import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Session epoch: a counter stored in `app_settings` and copied into every
 * session token when it is issued. Bumping it invalidates every token issued
 * before, on every device, without keeping a list of sessions. It is bumped
 * when the password changes and by "Sign out of all devices".
 */
const KEY = 'session_epoch';

export async function currentEpoch(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();
  if (error) throw new Error(`Could not read the session epoch: ${error.message}`);
  const epoch = Number(data?.value ?? 0);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0;
}

/** Revokes every session issued so far; returns the new epoch. */
export async function bumpEpoch(): Promise<number> {
  const next = (await currentEpoch()) + 1;
  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key: KEY, value: String(next) }, { onConflict: 'key' });
  if (error) throw new Error(`Could not revoke the sessions: ${error.message}`);
  return next;
}
