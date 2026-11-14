import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const { decrypt, getSessionFromToken } = await import('@/lib/session');

const key = (secret: string) => new TextEncoder().encode(secret);
const GOOD = key(process.env.SESSION_SECRET!);

function token(payload: Record<string, unknown>, { secret = GOOD, exp = '1h', alg = 'HS256' } = {}) {
  return new SignJWT(payload).setProtectedHeader({ alg }).setIssuedAt().setExpirationTime(exp).sign(secret);
}

describe('getSessionFromToken', () => {
  it('accepts a token signed with SESSION_SECRET', async () => {
    expect(await getSessionFromToken(await token({ authorized: true }))).toBe(true);
  });

  it('rejects a missing or garbage token', async () => {
    expect(await getSessionFromToken(undefined)).toBe(false);
    expect(await getSessionFromToken('')).toBe(false);
    expect(await getSessionFromToken('not.a.jwt')).toBe(false);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await token({ authorized: true }, { secret: key('another-secret-also-32-characters-long') });
    expect(await getSessionFromToken(forged)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const expired = await token({ authorized: true }, { exp: Math.floor(Date.now() / 1000) - 10 } as never);
    expect(await getSessionFromToken(expired)).toBe(false);
  });

  it('rejects a token without the authorized claim', async () => {
    expect(await getSessionFromToken(await token({}))).toBe(false);
    expect(await getSessionFromToken(await token({ authorized: 'true' }))).toBe(false);
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const [, body] = (await token({ authorized: true })).split('.');
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    expect(await getSessionFromToken(`${header}.${body}.`)).toBe(false);
  });

  it('rejects a token signed with a different HMAC algorithm', async () => {
    expect(await getSessionFromToken(await token({ authorized: true }, { alg: 'HS512' }))).toBe(false);
  });
});

describe('decrypt', () => {
  it('returns the epoch carried by the token', async () => {
    expect(await decrypt(await token({ authorized: true, epoch: 3 }))).toEqual({ authorized: true, epoch: 3 });
  });

  it('reads tokens issued before epochs existed as epoch 0', async () => {
    expect(await decrypt(await token({ authorized: true }))).toEqual({ authorized: true, epoch: 0 });
    expect(await decrypt(await token({ authorized: true, epoch: 'x' }))).toEqual({ authorized: true, epoch: 0 });
  });
});

describe('SESSION_SECRET', () => {
  it('refuses to start with a secret shorter than 32 characters', async () => {
    const original = process.env.SESSION_SECRET;
    vi.resetModules();
    process.env.SESSION_SECRET = 'short-secret';
    await expect(import('@/lib/session')).rejects.toThrow(/at least 32/);
    vi.resetModules();
    process.env.SESSION_SECRET = 'change-me-with-a-long-random-string';
    await expect(import('@/lib/session')).rejects.toThrow(/example value/);
    delete process.env.SESSION_SECRET;
    vi.resetModules();
    await expect(import('@/lib/session')).rejects.toThrow(/not set/);
    process.env.SESSION_SECRET = original;
  });
});
