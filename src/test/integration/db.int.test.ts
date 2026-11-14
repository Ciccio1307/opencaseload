/**
 * End-to-end through the server layer against a real database: the real
 * Server Actions, password hashing, throttling, session epochs, supabase-js,
 * PostgREST, RLS and the schema constraints. Only Next.js request APIs
 * (cookies, redirect) are replaced, by an in-memory cookie jar.
 */
import { createClient } from '@supabase/supabase-js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import dataset from '@/test/fixtures/dataset.json';
import { dayKey, zonedToUtcISO } from '@/lib/dates';

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { supabaseAdmin: db } = await import('@/lib/supabaseAdmin');
const auth = await import('@/app/actions/auth');
const patients = await import('@/app/actions/patients');
const sessions = await import('@/app/actions/sessions');
const { verifySession } = await import('@/lib/dal');

const NIL = '00000000-0000-0000-0000-000000000000';
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

async function resetDatabase() {
  await db.from('sessions').delete().neq('id', NIL);
  await db.from('patients').delete().neq('id', NIL);
  await db.from('app_settings').delete().neq('key', '');
  const p = await db.from('patients').insert(dataset.patients);
  const s = await db.from('sessions').insert(dataset.sessions);
  if (p.error || s.error) throw new Error(p.error?.message ?? s.error?.message);
}

async function signIn(password = 'first-run-password') {
  jar.clear();
  await expect(auth.login(undefined, form({ password }))).rejects.toThrow('REDIRECT /');
}

beforeAll(async () => {
  const ping = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`).catch(() => null);
  if (!ping?.ok) {
    throw new Error('Test database not reachable: docker compose -f docker-compose.test.yml up -d --wait');
  }
});

beforeEach(async () => {
  await resetDatabase();
  jar.clear();
});

describe('row level security', () => {
  const anon = () =>
    createClient(process.env.SUPABASE_URL!, process.env.TEST_ANON_KEY!, { auth: { persistSession: false } });

  it.each(['patients', 'sessions', 'app_settings'])('hides %s from the public anon key', async table => {
    const { data, error } = await anon().from(table).select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('refuses writes with the anon key', async () => {
    const { error } = await anon().from('patients').insert({ name: 'Intruder' });
    expect(error?.message).toMatch(/row-level security/);
    const { error: e2 } = await anon().from('app_settings').upsert({ key: 'password_hash', value: 'x:y' });
    expect(e2).not.toBeNull();
  });

  it('refuses the throttle function to the anon key (no lockout by anonymous RPC)', async () => {
    const { error } = await anon().rpc('claim_login_attempt', {});
    expect(error?.code).toBe('42501');
  });
});

describe('schema constraints (defence in depth behind validation)', () => {
  it('rejects unknown statuses and non-positive durations', async () => {
    const base = { patient_id: dataset.patients[0].id, date: '2026-11-08T10:00:00Z', duration_minutes: 60 };
    expect((await db.from('sessions').insert({ ...base, status: 'programmata' })).error?.code).toBe('23514');
    expect((await db.from('sessions').insert({ ...base, status: 'completed', duration_minutes: 0 })).error?.code).toBe('23514');
  });

  it('deletes the sessions of a deleted patient (on delete cascade)', async () => {
    await signIn();
    const victim = dataset.patients[0].id;
    expect((await patients.deletePatient(victim)).error).toBeNull();
    const { data } = await db.from('sessions').select('id').eq('patient_id', victim);
    expect(data).toEqual([]);
  });
});

describe('sign-in, throttling and session revocation', () => {
  it('refuses data to a request without a session', async () => {
    await expect(patients.listPatients()).rejects.toThrow('REDIRECT /login');
  });

  it('signs in with the first-run password and reads the caseload', async () => {
    await signIn();
    const { data } = await patients.listPatients();
    expect(data).toHaveLength(dataset.patients.length);
  });

  it('locks sign-in after five failures, even for the right password', async () => {
    for (let i = 0; i < 4; i++) {
      expect(await auth.login(undefined, form({ password: `wrong-${i}` }))).toEqual({ error: 'Wrong password, try again.' });
    }
    expect((await auth.login(undefined, form({ password: 'wrong-5' })))?.error).toMatch(/Try again in 15 min/);
    expect((await auth.login(undefined, form({ password: 'first-run-password' })))?.error).toMatch(/Too many/);
    expect(jar.size).toBe(0);
  });

  it('changing the password revokes stolen sessions but keeps this device in', async () => {
    await signIn();
    const stolen = jar.get('session')!;

    const r = await auth.changePassword(
      undefined,
      form({ currentPassword: 'first-run-password', newPassword: 'a-much-better-pass', confirmPassword: 'a-much-better-pass' })
    );
    expect(r).toEqual({ success: true });
    await expect(verifySession()).resolves.toEqual({ isAuth: true }); // fresh cookie

    jar.set('session', stolen);
    await expect(verifySession()).rejects.toThrow('REDIRECT /login');

    // The first-run password no longer works; the new one does.
    jar.clear();
    expect((await auth.login(undefined, form({ password: 'first-run-password' })))?.error).toBeDefined();
    await signIn('a-much-better-pass');
  });

  it('"sign out of all devices" revokes every session', async () => {
    await signIn();
    const other = jar.get('session')!;
    await expect(auth.logoutEverywhere()).rejects.toThrow('REDIRECT /login');
    jar.set('session', other);
    await expect(sessions.listSessions()).rejects.toThrow('REDIRECT /login');
  });

  it('never stores the password in clear', async () => {
    await signIn();
    await auth.changePassword(
      undefined,
      form({ currentPassword: 'first-run-password', newPassword: 'clear-text-check', confirmPassword: 'clear-text-check' })
    );
    const { data } = await db.from('app_settings').select('value').eq('key', 'password_hash').single();
    expect(data?.value).not.toContain('clear-text-check');
  });
});

describe('patients and sessions through the Server Actions', () => {
  beforeEach(() => signIn());

  it('stores hostile strings verbatim and harmlessly', async () => {
    const name = `Robert'); DROP TABLE sessions;-- <img src=x onerror=alert(1)>`;
    const { data, error } = await patients.createPatient({ name, parent_contact: "' OR 1=1 --", notes: '=1+1' });
    expect(error).toBeNull();
    expect(data?.name).toBe(name);
    expect((await sessions.listSessions()).data).toHaveLength(dataset.sessions.length);
  });

  it('keeps unicode intact', async () => {
    const { data } = await patients.createPatient({ name: 'Zoë 🌈 محمد 李', parent_contact: '', notes: '' });
    const { data: row } = await db.from('patients').select('name').eq('id', data!.id).single();
    expect(row?.name).toBe('Zoë 🌈 محمد 李');
  });

  it('round-trips a session time through the database in the instance zone', async () => {
    const patient_id = dataset.patients[1].id;
    const date = zonedToUtcISO('2026-11-08', '00:30'); // 23:30 UTC on the 7th
    const { data, error } = await sessions.createTherapySession({ patient_id, date, duration_minutes: 45, status: 'scheduled', notes: '' });
    expect(error).toBeNull();
    expect(new Date(data!.date).toISOString()).toBe('2026-11-07T23:30:00.000Z');
    expect(dayKey(data!.date)).toBe('2026-11-08');
  });

  it('moves a session through scheduled → absent → recovered', async () => {
    const patient_id = dataset.patients[2].id;
    const { data: created } = await sessions.createTherapySession({
      patient_id,
      date: '2026-11-10T09:00:00Z',
      duration_minutes: 60,
      status: 'scheduled',
      notes: '',
    });
    expect(created?.status).toBe('scheduled');
    expect((await sessions.updateSessionStatus(created!.id, 'absent')).data?.status).toBe('absent');
    await sessions.recoverSessions([created!.id]);
    const { data } = await db.from('sessions').select('status').eq('id', created!.id).single();
    expect(data?.status).toBe('recovered');
  });

  it('recoverSessions never touches completed or scheduled sessions', async () => {
    const all = dataset.sessions.map(s => s.id);
    expect((await sessions.recoverSessions(all)).error).toBeNull();
    const { data } = await db.from('sessions').select('id, status');
    const before = new Map(dataset.sessions.map(s => [s.id, s.status]));
    for (const row of data!) {
      const was = before.get(row.id)!;
      const expected = was === 'absent' || was === 'to_recover' ? 'recovered' : was;
      expect([row.id, row.status]).toEqual([row.id, expected]);
    }
  });

  it('reports a missing row instead of pretending to succeed', async () => {
    const r = await sessions.updateSessionStatus('99999999-0000-4000-8000-000000000000', 'completed');
    expect(r.data).toBeNull();
    expect(r.error).not.toBeNull();
  });
});
