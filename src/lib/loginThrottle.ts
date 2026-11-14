import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Brute-force protection for the single shared password: at most
 * MAX_ATTEMPTS password checks per WINDOW, then a LOCKOUT.
 *
 * An attempt is *claimed* before the password is checked, atomically, by the
 * `claim_login_attempt` Postgres function (supabase/schema.sql): parallel
 * requests are serialised by a row lock, so a burst of guesses cannot slip
 * past the limit. State lives in `app_settings` ('login_failures'), shared
 * by every serverless instance. The limit is global rather than per IP: there
 * is only one account to guess, and client IPs are easy to rotate or spoof.
 *
 * Databases that have not run the 20261114 migration yet fall back to a
 * non-atomic version of the same rules, with a warning in the logs.
 */
const KEY = 'login_failures';
export const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

export type AttemptClaim =
  /** Go ahead and check the password. `lastMinutes` > 0: this was the last try. */
  | { allowed: true; lastMinutes: number }
  /** Locked out: do not even check the password. */
  | { allowed: false; minutes: number };

type FailureState = { count: number; firstAt: number; lockedUntil: number };
const EMPTY: FailureState = { count: 0, firstAt: 0, lockedUntil: 0 };

let warnedFallback = false;

/** Claims one password check, or reports the lockout. */
export async function claimAttempt(): Promise<AttemptClaim> {
  const { data, error } = await supabaseAdmin.rpc('claim_login_attempt', {
    max_attempts: MAX_ATTEMPTS,
    window_seconds: WINDOW_MS / 1000,
    lockout_seconds: LOCKOUT_MS / 1000,
  });

  if (!error && data && typeof data === 'object') {
    const r = data as { allowed?: boolean; last?: boolean; minutes?: number };
    return r.allowed
      ? { allowed: true, lastMinutes: r.last ? Number(r.minutes) || 0 : 0 }
      : { allowed: false, minutes: Math.max(1, Number(r.minutes) || 1) };
  }

  // PGRST202: function not found, the migration has not run yet.
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        '[auth] claim_login_attempt() is missing: run supabase/migrations/20261114_atomic_login_throttle.sql. ' +
          'Until then sign-in throttling is not safe against parallel requests.'
      );
    }
    return claimAttemptFallback();
  }

  // Fail closed: if the throttle cannot be checked, no password is checked.
  throw new Error(`Sign-in throttle unavailable: ${error?.message ?? 'unexpected response'}`);
}

/** A correct password resets the counter and lifts any lockout. */
export async function clearFailures() {
  await supabaseAdmin.from('app_settings').delete().eq('key', KEY);
}

// ---------------------------------------------------------------------------
// Non-atomic fallback: same rules as the SQL function, read-modify-write.

async function readState(): Promise<FailureState> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', KEY).maybeSingle();
  if (!data?.value) return EMPTY;
  try {
    return { ...EMPTY, ...JSON.parse(data.value) };
  } catch {
    return EMPTY;
  }
}

async function writeState(state: FailureState) {
  await supabaseAdmin.from('app_settings').upsert({ key: KEY, value: JSON.stringify(state) }, { onConflict: 'key' });
}

export async function claimAttemptFallback(): Promise<AttemptClaim> {
  const now = Date.now();
  const state = await readState();
  if (state.lockedUntil > now) {
    return { allowed: false, minutes: Math.ceil((state.lockedUntil - now) / 60000) };
  }
  const fresh = now - state.firstAt > WINDOW_MS;
  const count = (fresh ? 0 : state.count) + 1;
  if (count >= MAX_ATTEMPTS) {
    await writeState({ count: 0, firstAt: 0, lockedUntil: now + LOCKOUT_MS });
    return { allowed: true, lastMinutes: LOCKOUT_MS / 60000 };
  }
  await writeState({ count, firstAt: fresh ? now : state.firstAt, lockedUntil: 0 });
  return { allowed: true, lastMinutes: 0 };
}
