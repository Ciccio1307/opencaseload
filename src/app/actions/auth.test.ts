import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  setPassword: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  verifySession: vi.fn(),
  currentEpoch: vi.fn(),
  bumpEpoch: vi.fn(),
  claimAttempt: vi.fn(),
  clearFailures: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/lib/password', () => ({ verifyPassword: m.verifyPassword, setPassword: m.setPassword }));
vi.mock('@/lib/session', () => ({ createSession: m.createSession, deleteSession: m.deleteSession }));
vi.mock('@/lib/sessionEpoch', () => ({ currentEpoch: m.currentEpoch, bumpEpoch: m.bumpEpoch }));
vi.mock('@/lib/dal', () => ({ verifySession: m.verifySession }));
vi.mock('@/lib/loginThrottle', () => ({ claimAttempt: m.claimAttempt, clearFailures: m.clearFailures }));

const { changePassword, login, logout, logoutEverywhere } = await import('@/app/actions/auth');

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  m.claimAttempt.mockResolvedValue({ allowed: true, lastMinutes: 0 });
  m.currentEpoch.mockResolvedValue(4);
  m.bumpEpoch.mockResolvedValue(5);
});

describe('login', () => {
  it('issues a session for the current epoch, clears failures and redirects home', async () => {
    m.verifyPassword.mockResolvedValue(true);
    await expect(login(undefined, form({ password: 'right' }))).rejects.toThrow('REDIRECT /');
    expect(m.clearFailures).toHaveBeenCalled();
    expect(m.createSession).toHaveBeenCalledWith(4);
  });

  it('claims an attempt before checking a wrong password', async () => {
    m.verifyPassword.mockResolvedValue(false);
    expect(await login(undefined, form({ password: 'wrong' }))).toEqual({ error: 'Wrong password, try again.' });
    expect(m.claimAttempt.mock.invocationCallOrder[0]).toBeLessThan(m.verifyPassword.mock.invocationCallOrder[0]);
    expect(m.clearFailures).not.toHaveBeenCalled();
    expect(m.createSession).not.toHaveBeenCalled();
  });

  it('reports the lockout when the last allowed attempt fails', async () => {
    m.verifyPassword.mockResolvedValue(false);
    m.claimAttempt.mockResolvedValue({ allowed: true, lastMinutes: 15 });
    expect(await login(undefined, form({ password: 'wrong' }))).toEqual({
      error: 'Too many failed attempts. Try again in 15 min.',
    });
  });

  it('does not even check the password while locked out', async () => {
    m.claimAttempt.mockResolvedValue({ allowed: false, minutes: 7 });
    m.verifyPassword.mockResolvedValue(true);
    expect(await login(undefined, form({ password: 'right' }))).toEqual({
      error: 'Too many failed attempts. Try again in 7 min.',
    });
    expect(m.verifyPassword).not.toHaveBeenCalled();
    expect(m.createSession).not.toHaveBeenCalled();
  });

  it('treats a missing password field as empty', async () => {
    m.verifyPassword.mockResolvedValue(false);
    await login(undefined, new FormData());
    expect(m.verifyPassword).toHaveBeenCalledWith('');
  });
});

describe('logout', () => {
  it('deletes this session only and redirects to /login', async () => {
    await expect(logout()).rejects.toThrow('REDIRECT /login');
    expect(m.deleteSession).toHaveBeenCalled();
    expect(m.bumpEpoch).not.toHaveBeenCalled();
  });
});

describe('logoutEverywhere', () => {
  it('revokes every session, then signs out', async () => {
    await expect(logoutEverywhere()).rejects.toThrow('REDIRECT /login');
    expect(m.bumpEpoch).toHaveBeenCalled();
    expect(m.deleteSession).toHaveBeenCalled();
  });

  it('requires a valid session', async () => {
    m.verifySession.mockRejectedValueOnce(new Error('REDIRECT /login'));
    await expect(logoutEverywhere()).rejects.toThrow('REDIRECT /login');
    expect(m.bumpEpoch).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  const fields = { currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'new-password' };

  it('requires a signed-in session', async () => {
    m.verifySession.mockRejectedValueOnce(new Error('REDIRECT /login'));
    await expect(changePassword(undefined, form(fields))).rejects.toThrow('REDIRECT /login');
    expect(m.setPassword).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password and counts it as an attempt', async () => {
    m.verifyPassword.mockResolvedValue(false);
    expect(await changePassword(undefined, form(fields))).toEqual({ error: 'Current password is incorrect.' });
    expect(m.claimAttempt).toHaveBeenCalled();
    expect(m.clearFailures).not.toHaveBeenCalled();
    expect(m.setPassword).not.toHaveBeenCalled();
  });

  it('is blocked by the lockout too', async () => {
    m.claimAttempt.mockResolvedValue({ allowed: false, minutes: 3 });
    m.verifyPassword.mockResolvedValue(true);
    expect(await changePassword(undefined, form(fields))).toEqual({
      error: 'Too many failed attempts. Try again in 3 min.',
    });
    expect(m.verifyPassword).not.toHaveBeenCalled();
  });

  it('rejects a new password shorter than 8 characters', async () => {
    m.verifyPassword.mockResolvedValue(true);
    const r = await changePassword(undefined, form({ ...fields, newPassword: 'short12', confirmPassword: 'short12' }));
    expect(r?.error).toMatch(/at least 8/);
    expect(m.setPassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    m.verifyPassword.mockResolvedValue(true);
    const r = await changePassword(undefined, form({ ...fields, confirmPassword: 'new-passwordX' }));
    expect(r).toEqual({ error: 'New passwords do not match.' });
    expect(m.setPassword).not.toHaveBeenCalled();
  });

  it('stores the new password, revokes other sessions and keeps this device signed in', async () => {
    m.verifyPassword.mockResolvedValue(true);
    expect(await changePassword(undefined, form(fields))).toEqual({ success: true });
    expect(m.setPassword).toHaveBeenCalledWith('new-password');
    expect(m.bumpEpoch).toHaveBeenCalled();
    expect(m.createSession).toHaveBeenCalledWith(5);
    expect(m.setPassword.mock.invocationCallOrder[0]).toBeLessThan(m.bumpEpoch.mock.invocationCallOrder[0]);
  });
});

describe('throttle failure', () => {
  it('fails closed: no password check when the throttle is unavailable', async () => {
    m.claimAttempt.mockRejectedValue(new Error('Sign-in throttle unavailable'));
    m.verifyPassword.mockResolvedValue(true);
    await expect(login(undefined, form({ password: 'right' }))).rejects.toThrow(/unavailable/);
    expect(m.verifyPassword).not.toHaveBeenCalled();
    expect(m.createSession).not.toHaveBeenCalled();
  });
});
