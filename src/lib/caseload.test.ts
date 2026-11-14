import { describe, expect, it } from 'vitest';
import {
  daySchedule,
  formatHours,
  groupByPatient,
  indexById,
  matchesSearch,
  patientStats,
  pendingRecoveries,
  weekSummary,
} from '@/lib/caseload';
import { weekDayKeys } from '@/lib/dates';
import type { Patient, Session } from '@/types/database';

// Instance zone: Europe/Rome (UTC+1 in November). See vitest.config.mts.
let n = 0;
const s = (patient_id: string, date: string, duration_minutes: number, status: Session['status']): Session => ({
  id: `s${++n}`,
  patient_id,
  date,
  duration_minutes,
  status,
});
const patient = (id: string, name = id): Patient => ({ id, name, parent_contact: '', created_at: '' });

describe('indexById / groupByPatient', () => {
  it('index items by id', () => {
    const map = indexById([patient('a'), patient('b')]);
    expect(map.get('b')?.name).toBe('b');
    expect(map.get('c')).toBeUndefined();
  });

  it('group sessions by patient, keeping their order', () => {
    const list = [s('a', '2026-11-01T10:00:00Z', 60, 'completed'), s('b', '2026-11-01T11:00:00Z', 60, 'completed'), s('a', '2026-11-02T10:00:00Z', 30, 'absent')];
    const groups = groupByPatient(list);
    expect(groups.get('a')?.map(x => x.duration_minutes)).toEqual([60, 30]);
    expect(groups.get('b')).toHaveLength(1);
    expect(groupByPatient([]).size).toBe(0);
  });
});

describe('formatHours', () => {
  it.each([
    [0, '0.0'],
    [45, '0.8'],
    [90, '1.5'],
    [480, '8.0'],
  ])('%i min → %s h', (min, h) => expect(formatHours(min)).toBe(h));
});

describe('daySchedule', () => {
  const day = '2026-11-08';
  const sessions = [
    s('a', '2026-11-08T14:00:00Z', 60, 'completed'), // 15:00 Rome
    s('b', '2026-11-08T14:00:00Z', 60, 'absent'), //    same slot: group session
    s('c', '2026-11-08T08:00:00Z', 45, 'absent'), //    09:00, nobody came
    s('d', '2026-11-08T08:00:00Z', 30, 'completed'), // 09:00 but a different duration: own slot
    s('e', '2026-11-07T23:30:00Z', 60, 'completed'), // 00:30 on the 8th in Rome
    s('f', '2026-11-08T23:30:00Z', 60, 'completed'), // 00:30 on the 9th in Rome: excluded
  ];

  it('keeps only the sessions of that day in the instance zone', () => {
    expect(daySchedule(sessions, day).sessionCount).toBe(5);
  });

  it('groups same start and duration into one slot, chronologically', () => {
    const { slots } = daySchedule(sessions, day);
    expect(slots.map(x => [x.start.toISOString(), x.duration, x.sessions.length])).toEqual([
      ['2026-11-07T23:30:00.000Z', 60, 1],
      ['2026-11-08T08:00:00.000Z', 30, 1],
      ['2026-11-08T08:00:00.000Z', 45, 1],
      ['2026-11-08T14:00:00.000Z', 60, 2],
    ]);
  });

  it('counts a slot once if anyone attended, never when nobody did', () => {
    // 60 (00:30) + 30 (09:00 completed) + 60 (group) — the absent 45 is out.
    expect(daySchedule(sessions, day).minutesWorked).toBe(150);
  });

  it('handles an empty day', () => {
    expect(daySchedule(sessions, '2026-01-01')).toEqual({ slots: [], sessionCount: 0, minutesWorked: 0 });
  });
});

describe('weekSummary', () => {
  const week = weekDayKeys('2026-11-08'); // Mon 2 → Sun 8 Nov
  const sessions = [
    s('a', '2026-11-02T09:00:00Z', 60, 'completed'),
    s('a', '2026-11-02T15:00:00Z', 60, 'completed'), // same patient twice: counted once
    s('b', '2026-11-02T10:00:00Z', 60, 'absent'),
    s('c', '2026-11-08T22:30:00Z', 60, 'scheduled'), // 23:30 Sunday in Rome
    s('d', '2026-11-08T23:30:00Z', 60, 'scheduled'), // Monday 9th in Rome: next week
    s('e', '2026-11-01T22:59:00Z', 60, 'scheduled'), // 23:59 Sunday 1st: previous week
  ];

  it('lists only days with sessions, Monday first', () => {
    expect(weekSummary(sessions, week).map(d => [d.day, [...d.patientIds]])).toEqual([
      ['2026-11-02', ['a', 'b']],
      ['2026-11-08', ['c']],
    ]);
  });

  it('dates each day at midday in the instance zone', () => {
    expect(weekSummary(sessions, week)[0].date.toISOString()).toBe('2026-11-02T11:00:00.000Z');
  });
});

describe('patientStats', () => {
  const sessions = [
    s('a', '2026-10-31T22:30:00Z', 60, 'completed'), // 23:30 31 Oct Rome
    s('a', '2026-10-31T23:30:00Z', 60, 'completed'), // 00:30 1 Nov Rome
    s('a', '2026-11-15T10:00:00Z', 90, 'absent'),
    s('a', '2026-11-16T10:00:00Z', 30, 'recovered'),
    s('a', '2026-11-17T10:00:00Z', 45, 'scheduled'),
  ];

  it('totals worked hours of all time', () => {
    expect(patientStats(sessions, '2026-11').totalHours).toBe('2.0');
  });

  it('filters the month in the instance zone', () => {
    const stats = patientStats(sessions, '2026-11');
    expect(stats.monthSessions).toHaveLength(4);
    expect(stats.monthHours).toBe('1.0');
    expect(stats.monthMissed).toBe(2);
    expect(patientStats(sessions, '2026-10').monthSessions).toHaveLength(1);
  });

  it('exports everything when the month is empty', () => {
    expect(patientStats(sessions, '').monthSessions).toHaveLength(5);
  });

  it('does not return the input array itself', () => {
    expect(patientStats(sessions, '').monthSessions).not.toBe(sessions);
  });
});

describe('pendingRecoveries', () => {
  const patients = indexById([patient('a', 'Ada'), patient('b', 'Bea')]);
  const sessions = [
    s('a', '2026-11-02T09:00:00Z', 60, 'absent'),
    s('a', '2026-11-03T09:00:00Z', 45, 'to_recover'),
    s('a', '2026-11-04T09:00:00Z', 60, 'recovered'),
    s('b', '2026-11-02T09:00:00Z', 60, 'completed'),
    s('ghost', '2026-11-02T09:00:00Z', 60, 'absent'), // deleted patient
  ];

  it('sums the minutes owed per patient, skipping recovered and unknown ones', () => {
    const result = pendingRecoveries(sessions, patients);
    expect(result.map(r => [r.patient.name, r.totalMinutes, r.sessions.length])).toEqual([['Ada', 105, 2]]);
  });

  it('returns nothing when everything is recovered', () => {
    expect(pendingRecoveries([sessions[2], sessions[3]], patients)).toEqual([]);
  });
});

describe('matchesSearch', () => {
  it('ignores case, accents and surrounding spaces', () => {
    expect(matchesSearch('Niccolò Pérez', 'nicco')).toBe(true);
    expect(matchesSearch('Niccolò Pérez', ' PEREZ ')).toBe(true);
    expect(matchesSearch('Niccolò Pérez', 'niccolò')).toBe(true);
    expect(matchesSearch('Ada', 'bea')).toBe(false);
  });

  it('matches everything with an empty query', () => {
    expect(matchesSearch('Ada', '')).toBe(true);
  });

  it('treats regex and LIKE characters literally', () => {
    expect(matchesSearch('%_\\ wildcard', '%_')).toBe(true);
    expect(matchesSearch('Ada', '.*')).toBe(false);
  });
});
