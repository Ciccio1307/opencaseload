import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { supabaseAdmin: db } = await import('@/lib/supabaseAdmin');
const { login } = await import('@/app/actions/auth');

const wrong = (i: number) => {
  const fd = new FormData();
  fd.set('password', `guess-${i}`);
  return login(undefined, fd);
};

beforeEach(async () => {
  await db.from('app_settings').delete().neq('key', '');
});

describe('login throttle under concurrency', () => {
  it('a burst of 40 parallel wrong guesses still ends in a lockout', async () => {
    await Promise.all(Array.from({ length: 40 }, (_, i) => wrong(i)));
    const r = await wrong(999);
    expect(r?.error).toMatch(/Too many failed attempts/);
  });

  it('at most 5 guesses of a burst are actually checked', async () => {
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => wrong(i)));
    const checked = results.filter(r => r?.error === 'Wrong password, try again.').length;
    expect(checked).toBeLessThanOrEqual(5);
  });
});
