import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Brute-force protection for the single shared password.
 *
 * State lives in the `app_settings` table, so it survives restarts and is
 * shared by every serverless instance (an in-memory counter would not be).
 * The limit is global rather than per IP: there is only one account to guess.
 */
const KEY = 'login_failures';
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgotten
const LOCKOUT_MS = 15 * 60 * 1000;

type FailureState = { count: number; firstAt: number; lockedUntil: number };

const EMPTY: FailureState = { count: 0, firstAt: 0, lockedUntil: 0 };

async function readState(): Promise<FailureState> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();
  if (!data?.value) return EMPTY;
  try {
    return { ...EMPTY, ...JSON.parse(data.value) };
  } catch {
    return EMPTY;
  }
}

async function writeState(state: FailureState) {
  await supabaseAdmin
    .from('app_settings')
    .upsert({ key: KEY, value: JSON.stringify(state) }, { onConflict: 'key' });
}

/** Minutes left on the lockout, or 0 if signing in is allowed. */
export async function lockoutMinutesLeft(): Promise<number> {
  const { lockedUntil } = await readState();
  const left = lockedUntil - Date.now();
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

/** Records a wrong password; returns the lockout minutes if it triggered one. */
export async function recordFailure(): Promise<number> {
  const now = Date.now();
  const state = await readState();
  const fresh = now - state.firstAt > WINDOW_MS;
  const count = (fresh ? 0 : state.count) + 1;

  if (count >= MAX_FAILURES) {
    await writeState({ count: 0, firstAt: 0, lockedUntil: now + LOCKOUT_MS });
    return Math.ceil(LOCKOUT_MS / 60000);
  }

  await writeState({ count, firstAt: fresh ? now : state.firstAt, lockedUntil: 0 });
  return 0;
}

export async function clearFailures() {
  await supabaseAdmin.from('app_settings').delete().eq('key', KEY);
}
