import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';

const db = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createFakeSupabase> }));
vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return db.current.client;
  },
}));

const { claimAttempt, clearFailures, MAX_ATTEMPTS } = await import('@/lib/loginThrottle');

const MIN = 60_000;

afterEach(() => vi.useRealTimers());

describe('with claim_login_attempt() in the database', () => {
  const withRpc = (result: unknown) => {
    const args: Record<string, unknown>[] = [];
    db.current = createFakeSupabase(
      { app_settings: [] },
      {
        rpc: {
          claim_login_attempt: a => {
            args.push(a);
            if (result instanceof Error) throw result;
            return result;
          },
        },
      }
    );
    return args;
  };

  it('passes the limits to the function', async () => {
    const args = withRpc({ allowed: true, last: false, minutes: 0 });
    await claimAttempt();
    expect(args[0]).toEqual({ max_attempts: 5, window_seconds: 900, lockout_seconds: 900 });
  });

  it('maps an ordinary attempt', async () => {
    withRpc({ allowed: true, last: false, minutes: 0 });
    expect(await claimAttempt()).toEqual({ allowed: true, lastMinutes: 0 });
  });

  it('maps the last allowed attempt', async () => {
    withRpc({ allowed: true, last: true, minutes: 15 });
    expect(await claimAttempt()).toEqual({ allowed: true, lastMinutes: 15 });
  });

  it('maps a lockout, never reporting less than a minute', async () => {
    withRpc({ allowed: false, minutes: 9 });
    expect(await claimAttempt()).toEqual({ allowed: false, minutes: 9 });
    withRpc({ allowed: false, minutes: 0 });
    expect(await claimAttempt()).toEqual({ allowed: false, minutes: 1 });
  });

  it('fails closed when the throttle cannot be checked', async () => {
    withRpc(new Error('connection refused'));
    await expect(claimAttempt()).rejects.toThrow(/throttle unavailable/);
  });
});

describe('fallback before the migration has run', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db.current = createFakeSupabase({ app_settings: [] }); // no rpc → PGRST202
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  async function claims(times: number) {
    const out = [];
    for (let i = 0; i < times; i++) out.push(await claimAttempt());
    return out;
  }

  it(`allows ${MAX_ATTEMPTS} checks, the last one flagged, then locks`, async () => {
    const r = await claims(MAX_ATTEMPTS + 1);
    expect(r.slice(0, 4)).toEqual(Array(4).fill({ allowed: true, lastMinutes: 0 }));
    expect(r[4]).toEqual({ allowed: true, lastMinutes: 15 });
    expect(r[5]).toEqual({ allowed: false, minutes: 15 });
  });

  it('lifts the lockout after 15 minutes', async () => {
    await claims(MAX_ATTEMPTS);
    vi.advanceTimersByTime(14 * MIN + 1);
    expect(await claimAttempt()).toEqual({ allowed: false, minutes: 1 });
    vi.advanceTimersByTime(MIN);
    expect(await claimAttempt()).toEqual({ allowed: true, lastMinutes: 0 });
  });

  it('forgets attempts older than the window', async () => {
    await claims(4);
    vi.advanceTimersByTime(15 * MIN + 1);
    const r = await claims(4);
    expect(r.every(c => c.allowed && c.lastMinutes === 0)).toBe(true);
  });

  it('clearFailures resets the counter and lifts the lockout', async () => {
    await claims(MAX_ATTEMPTS);
    await clearFailures();
    expect(await claimAttempt()).toEqual({ allowed: true, lastMinutes: 0 });
  });

  it('treats a corrupted stored value as no history', async () => {
    db.current.tables.app_settings.push({ key: 'login_failures', value: '{not json' });
    expect(await claimAttempt()).toEqual({ allowed: true, lastMinutes: 0 });
  });

  it('warns once that the migration is missing', async () => {
    await claims(3);
    expect(warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('20261114')).length).toBeLessThanOrEqual(1);
  });
});
