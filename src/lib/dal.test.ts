import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';

const m = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof createFakeSupabase>,
  getSession: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/lib/session', () => ({ getSession: m.getSession }));
vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return m.db.client;
  },
}));

// React's cache() only memoises inside a server request: here every call runs.
const { verifySession } = await import('@/lib/dal');
const { bumpEpoch, currentEpoch } = await import('@/lib/sessionEpoch');

beforeEach(() => {
  vi.clearAllMocks();
  m.db = createFakeSupabase({ app_settings: [] });
});

describe('session epoch', () => {
  it('starts at 0 and goes up by one per bump', async () => {
    expect(await currentEpoch()).toBe(0);
    expect(await bumpEpoch()).toBe(1);
    expect(await bumpEpoch()).toBe(2);
    expect(await currentEpoch()).toBe(2);
  });

  it('treats a corrupted value as 0', async () => {
    m.db.tables.app_settings.push({ key: 'session_epoch', value: '-7' });
    expect(await currentEpoch()).toBe(0);
  });
});

describe('verifySession', () => {
  it('lets a session of the current epoch through', async () => {
    m.getSession.mockResolvedValue({ authorized: true, epoch: 0 });
    await expect(verifySession()).resolves.toEqual({ isAuth: true });
  });

  it('redirects without a session', async () => {
    m.getSession.mockResolvedValue(null);
    await expect(verifySession()).rejects.toThrow('REDIRECT /login');
  });

  it('redirects a session revoked by an epoch bump', async () => {
    m.getSession.mockResolvedValue({ authorized: true, epoch: 0 });
    await bumpEpoch();
    await expect(verifySession()).rejects.toThrow('REDIRECT /login');
  });

  it('accepts the session issued after the bump', async () => {
    await bumpEpoch();
    m.getSession.mockResolvedValue({ authorized: true, epoch: 1 });
    await expect(verifySession()).resolves.toEqual({ isAuth: true });
  });
});
