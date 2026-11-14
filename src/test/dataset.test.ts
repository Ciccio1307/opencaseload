/**
 * Integration over the generated dataset (scripts/generate-test-data.mjs):
 * 30 invented patients and 120 sessions with edge cases. Each result of the
 * optimised code is checked against a naive re-implementation.
 */
import { describe, expect, it } from 'vitest';
import dataset from '@/test/fixtures/dataset.json';
import { daySchedule, groupByPatient, indexById, patientStats, pendingRecoveries, weekSummary } from '@/lib/caseload';
import { dayKey, monthKey, weekDayKeys } from '@/lib/dates';
import { parsePatientInput, parseSessionInput, reportFileName } from '@/lib/validation';
import { summarise } from '@/lib/exportUtils';
import type { Patient, Session } from '@/types/database';

const patients = dataset.patients as Patient[];
const sessions = dataset.sessions as Session[];

describe('dataset shape', () => {
  it('has at least 50 records and unique ids', () => {
    expect(patients.length + sessions.length).toBeGreaterThanOrEqual(50);
    expect(new Set(patients.map(p => p.id)).size).toBe(patients.length);
    expect(new Set(sessions.map(s => s.id)).size).toBe(sessions.length);
  });

  it('only references existing patients and uses every status', () => {
    const ids = new Set(patients.map(p => p.id));
    expect(sessions.every(s => ids.has(s.patient_id))).toBe(true);
    expect(new Set(sessions.map(s => s.status)).size).toBe(5);
  });
});

describe('validation accepts every record', () => {
  it.each(patients.map(p => [p.name.slice(0, 30), p] as const))('patient %s', (_name, p) => {
    expect(parsePatientInput(p)).toMatchObject({ ok: true });
  });

  it('every session', () => {
    const rejected = sessions.filter(s => !parseSessionInput(s).ok);
    expect(rejected).toEqual([]);
  });

  it('keeps hostile strings verbatim (they are data, not code)', () => {
    const xss = patients.find(p => p.name.startsWith('<script>'))!;
    expect(parsePatientInput(xss)).toMatchObject({ ok: true, value: { name: '<script>alert(1)</script>' } });
  });
});

describe('report file names are always safe', () => {
  it.each(patients.map(p => [p.name.slice(0, 30), p.name] as const))('%s', (_label, name) => {
    expect(reportFileName(name, 'pdf')).toMatch(/^Report_[A-Za-z0-9_-]+\.pdf$/);
  });
});

describe('aggregations match a naive implementation', () => {
  const byPatient = groupByPatient(sessions);
  const months = [...new Set(sessions.map(s => monthKey(s.date)))];

  it('patient stats for every patient and month', () => {
    for (const p of patients) {
      const mine = sessions.filter(s => s.patient_id === p.id);
      for (const month of months) {
        const naive = mine.filter(s => monthKey(s.date) === month);
        const stats = patientStats(byPatient.get(p.id) ?? [], month);
        expect(stats.monthSessions.map(s => s.id)).toEqual(naive.map(s => s.id));
        const worked = naive.filter(s => s.status === 'completed').reduce((a, s) => a + s.duration_minutes, 0);
        expect(stats.monthHours).toBe((worked / 60).toFixed(1));
        expect(stats.monthHours).toBe(summarise(naive).workedHours);
      }
    }
  });

  it('day schedules for every day with sessions', () => {
    for (const day of new Set(sessions.map(s => dayKey(s.date)))) {
      const naive = sessions.filter(s => dayKey(s.date) === day);
      const { slots, sessionCount } = daySchedule(sessions, day);
      expect(sessionCount).toBe(naive.length);
      expect(slots.flatMap(x => x.sessions).length).toBe(naive.length);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].start.getTime()).toBeGreaterThanOrEqual(slots[i - 1].start.getTime());
      }
    }
  });

  it('week summaries cover every session of the week exactly once', () => {
    for (const day of new Set(sessions.map(s => dayKey(s.date)))) {
      const week = weekDayKeys(day);
      const inWeek = sessions.filter(s => week.includes(dayKey(s.date)));
      const summary = weekSummary(sessions, week);
      const pairs = new Set(inWeek.map(s => `${dayKey(s.date)}|${s.patient_id}`));
      expect(summary.reduce((a, d) => a + d.patientIds.size, 0)).toBe(pairs.size);
    }
  });

  it('pending recoveries equal the sum of absent and to-recover minutes', () => {
    const owed = pendingRecoveries(sessions, indexById(patients)).reduce((a, r) => a + r.totalMinutes, 0);
    const naive = sessions
      .filter(s => s.status === 'absent' || s.status === 'to_recover')
      .reduce((a, s) => a + s.duration_minutes, 0);
    expect(owed).toBe(naive);
  });

  it('places the DST and midnight edge cases on the right Rome day', () => {
    const at = (iso: string) => sessions.find(s => s.date === iso)!;
    expect(dayKey(at('2026-10-31T23:30:00.000Z').date)).toBe('2026-11-01');
    expect(monthKey(at('2026-12-31T23:30:00.000Z').date)).toBe('2027-01');
    expect(dayKey(at('2026-11-08T23:00:00.000Z').date)).toBe('2026-11-09');
    expect(dayKey(at('2026-11-08T22:59:00.000Z').date)).toBe('2026-11-08');
    expect(dayKey(at('2028-02-29T10:00:00.000Z').date)).toBe('2028-02-29');
  });
});
