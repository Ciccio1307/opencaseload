import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';

const db = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createFakeSupabase> }));
vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return db.current.client;
  },
}));

async function load(initialPassword?: string) {
  vi.resetModules();
  if (initialPassword === undefined) delete process.env.APP_INITIAL_PASSWORD;
  else process.env.APP_INITIAL_PASSWORD = initialPassword;
  return import('@/lib/password');
}

beforeEach(() => {
  db.current = createFakeSupabase({ app_settings: [] });
});

describe('verifyPassword before a password is set', () => {
  it('accepts only APP_INITIAL_PASSWORD', async () => {
    const { verifyPassword } = await load('first-run-pass');
    expect(await verifyPassword('first-run-pass')).toBe(true);
    expect(await verifyPassword('first-run-pas')).toBe(false);
    expect(await verifyPassword('')).toBe(false);
  });

  it('rejects everything when no initial password is configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { verifyPassword } = await load();
    expect(await verifyPassword('')).toBe(false);
    expect(await verifyPassword('anything')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('unsafe first-run passwords', () => {
  it.each(['change-me', 'CHANGE-ME', 'password', 'short'])('refuses "%s"', async value => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { verifyPassword } = await load(value);
    expect(await verifyPassword(value)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('setPassword', () => {
  it('stores a salted scrypt hash, never the password', async () => {
    const { setPassword } = await load('first-run-pass');
    await setPassword('correct horse');
    const stored = String(db.current.tables.app_settings.find(r => r.key === 'password_hash')?.value);
    expect(stored).not.toContain('correct horse');
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('uses a fresh salt each time', async () => {
    const { setPassword } = await load();
    await setPassword('same');
    const first = db.current.tables.app_settings[0].value;
    await setPassword('same');
    expect(db.current.tables.app_settings[0].value).not.toBe(first);
  });

  it('replaces the initial password once set', async () => {
    const { setPassword, verifyPassword } = await load('first-run-pass');
    await setPassword('correct horse');
    expect(await verifyPassword('correct horse')).toBe(true);
    expect(await verifyPassword('first-run-pass')).toBe(false);
  });

  it('rejects a malformed stored hash', async () => {
    const { verifyPassword } = await load('first-run-pass');
    db.current.tables.app_settings.push({ key: 'password_hash', value: 'garbage' });
    expect(await verifyPassword('garbage')).toBe(false);
    expect(await verifyPassword('first-run-pass')).toBe(false);
  });
});
