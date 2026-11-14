import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const { proxy, config } = await import('@/proxy');

const validToken = () =>
  new SignJWT({ authorized: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, 'https://caseload.example'), {
    headers: cookie ? { cookie: `session=${cookie}` } : {},
  });
}

const location = (res: Response) => res.headers.get('location');

describe('proxy', () => {
  it('sends anonymous visitors to /login', async () => {
    expect(location(await proxy(request('/patients')))).toBe('https://caseload.example/login');
  });

  it('sends visitors with a forged cookie to /login', async () => {
    expect(location(await proxy(request('/', 'forged.token.value')))).toBe('https://caseload.example/login');
  });

  it('lets anonymous visitors see /login', async () => {
    expect(location(await proxy(request('/login')))).toBeNull();
  });

  it('lets signed-in users through', async () => {
    expect(location(await proxy(request('/recoveries', await validToken())))).toBeNull();
  });

  it('leaves signed-in users on /login (a revoked token would otherwise loop)', async () => {
    expect(location(await proxy(request('/login', await validToken())))).toBeNull();
  });

  it('treats sub-paths of /login as the login page', async () => {
    expect(location(await proxy(request('/login/help')))).toBeNull();
  });
});

describe('proxy matcher', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(['/', '/patients', '/recoveries', '/settings', '/login'])('runs on %s', path => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(['/_next/static/chunk.js', '/favicon.ico', '/icon', '/apple-icon', '/manifest.webmanifest'])(
    'skips %s',
    path => {
      expect(matcher.test(path)).toBe(false);
    }
  );
});
