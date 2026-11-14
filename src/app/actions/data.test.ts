import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';

const m = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof createFakeSupabase>,
  verifySession: vi.fn(),
}));
vi.mock('@/lib/dal', () => ({ verifySession: m.verifySession }));
vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return m.db.client;
  },
}));

const patients = await import('@/app/actions/patients');
const sessions = await import('@/app/actions/sessions');

const P1 = '11111111-1111-4111-8111-111111111111';
const S = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

beforeEach(() => {
  vi.clearAllMocks();
  m.verifySession.mockResolvedValue({ isAuth: true });
  m.db = createFakeSupabase({
    patients: [{ id: P1, name: 'Ada Rossi', parent_contact: '', notes: '' }],
    sessions: [
      { id: S(1), patient_id: P1, status: 'absent', duration_minutes: 60 },
      { id: S(2), patient_id: P1, status: 'to_recover', duration_minutes: 45 },
      { id: S(3), patient_id: P1, status: 'completed', duration_minutes: 60 },
      { id: S(4), patient_id: P1, status: 'scheduled', duration_minutes: 60 },
    ],
  });
});

describe('every data action checks the session first', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['listPatients', () => patients.listPatients()],
    ['createPatient', () => patients.createPatient({ name: 'X', parent_contact: '', notes: '' })],
    ['updatePatient', () => patients.updatePatient(P1, { name: 'X', parent_contact: '', notes: '' })],
    ['deletePatient', () => patients.deletePatient(P1)],
    ['listSessions', () => sessions.listSessions()],
    [
      'createTherapySession',
      () =>
        sessions.createTherapySession({
          patient_id: P1,
          date: '2026-11-08T14:00:00Z',
          duration_minutes: 60,
          status: 'scheduled',
          notes: '',
        }),
    ],
    ['updateSessionStatus', () => sessions.updateSessionStatus(S(4), 'completed')],
    ['deleteTherapySession', () => sessions.deleteTherapySession(S(4))],
    ['recoverSessions', () => sessions.recoverSessions([S(1)])],
  ];

  it.each(calls)('%s', async (_name, call) => {
    m.verifySession.mockRejectedValueOnce(new Error('REDIRECT /login'));
    await expect(call()).rejects.toThrow('REDIRECT /login');
    expect(m.db.queries).toHaveLength(0);
  });
});

describe('patients', () => {
  it('stores trimmed fields only', async () => {
    const { data, error } = await patients.createPatient({
      name: '  Bea Verdi ',
      parent_contact: ' 333 ',
      notes: '',
      id: 'injected',
    } as never);
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: 'Bea Verdi', parent_contact: '333' });
    expect(m.db.queries[0].payload).toEqual([{ name: 'Bea Verdi', parent_contact: '333', notes: '' }]);
  });

  it('refuses an empty name without touching the database', async () => {
    expect(await patients.createPatient({ name: ' ', parent_contact: '', notes: '' })).toEqual({
      data: null,
      error: 'Name is required.',
    });
    expect(m.db.queries).toHaveLength(0);
  });

  it('refuses a malformed id', async () => {
    expect((await patients.deletePatient('1 or 1=1')).error).toBe('Invalid patient.');
    expect(m.db.tables.patients).toHaveLength(1);
  });
});

describe('sessions', () => {
  it('rejects an unknown status', async () => {
    expect((await sessions.updateSessionStatus(S(4), 'programmata' as never)).error).toBe('Invalid status.');
    expect(m.db.queries).toHaveLength(0);
  });

  it('rejects an invalid new session', async () => {
    const r = await sessions.createTherapySession({
      patient_id: P1,
      date: '2026-11-08T14:00:00Z',
      duration_minutes: 0,
      status: 'scheduled',
      notes: '',
    });
    expect(r.error).toMatch(/Duration/);
    expect(m.db.queries).toHaveLength(0);
  });

  it('recovers only sessions that are still missed', async () => {
    const r = await sessions.recoverSessions([S(1), S(2), S(3), S(4)]);
    expect(r.error).toBeNull();
    const status = Object.fromEntries(m.db.tables.sessions.map(s => [s.id, s.status]));
    expect(status).toEqual({
      [S(1)]: 'recovered',
      [S(2)]: 'recovered',
      [S(3)]: 'completed',
      [S(4)]: 'scheduled',
    });
  });

  it('does nothing for an empty recovery list', async () => {
    expect(await sessions.recoverSessions([])).toEqual({ data: null, error: null });
    expect(m.db.queries).toHaveLength(0);
  });

  it('rejects a recovery list with a malformed id', async () => {
    expect((await sessions.recoverSessions([S(1), 'x'])).error).toBe('Invalid session.');
    expect(m.db.tables.sessions[0].status).toBe('absent');
  });
});
