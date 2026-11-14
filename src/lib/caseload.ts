/**
 * Caseload arithmetic shared by the pages: grouping sessions by day, week,
 * patient and month, and adding up hours. Pure functions, no React and no
 * I/O, so they are unit-tested directly (caseload.test.ts).
 *
 * Every loop is linear in the number of sessions: lookups go through Maps
 * built once, instead of `array.find` inside a loop (which was O(P × S)).
 */
import { dayKey, monthKey, zonedToUtcISO } from '@/lib/dates';
import { isMissedSession, isWorkedSession, needsRecovery, type Patient, type Session } from '@/types/database';

/** Map from id to item, for O(1) lookups. */
export function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map(item => [item.id, item]));
}

/** Sessions of each patient, in input order. */
export function groupByPatient(sessions: readonly Session[]): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = groups.get(s.patient_id);
    if (list) list.push(s);
    else groups.set(s.patient_id, [s]);
  }
  return groups;
}

export const sumMinutes = (sessions: readonly Session[]) =>
  sessions.reduce((acc, s) => acc + s.duration_minutes, 0);

/** Minutes of the sessions that actually took place. */
export const workedMinutes = (sessions: readonly Session[]) => sumMinutes(sessions.filter(isWorkedSession));

/** "1.5" for 90 minutes. */
export const formatHours = (minutes: number) => (minutes / 60).toFixed(1);

export type TimeSlot = { start: Date; duration: number; sessions: Session[] };

/**
 * The sessions of one day grouped into time slots (same start and duration:
 * a group session), in chronological order.
 *
 * Minutes worked count each slot once if at least one of its sessions took
 * place: a therapist seeing three children together works one hour, not three.
 */
export function daySchedule(sessions: readonly Session[], day: string) {
  const slots = new Map<string, TimeSlot>();
  let count = 0;
  for (const s of sessions) {
    if (dayKey(s.date) !== day) continue;
    count++;
    const start = new Date(s.date);
    const key = `${start.getTime()}_${s.duration_minutes}`;
    const slot = slots.get(key);
    if (slot) slot.sessions.push(s);
    else slots.set(key, { start, duration: s.duration_minutes, sessions: [s] });
  }
  const ordered = [...slots.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.duration - b.duration
  );
  const minutesWorked = ordered
    .filter(slot => slot.sessions.some(isWorkedSession))
    .reduce((acc, slot) => acc + slot.duration, 0);
  return { slots: ordered, sessionCount: count, minutesWorked };
}

/** `date` is midday of `day` in the instance zone, ready for formatDate. */
export type WeekDay = { day: string; date: Date; patientIds: Set<string> };

/** For each day of `weekDays` with at least one session, the patients seen. */
export function weekSummary(sessions: readonly Session[], weekDays: readonly string[]): WeekDay[] {
  const days = new Map<string, WeekDay>(
    weekDays.map(day => [day, { day, date: new Date(zonedToUtcISO(day, '12:00')), patientIds: new Set<string>() }])
  );
  for (const s of sessions) {
    const entry = days.get(dayKey(s.date));
    if (!entry) continue;
    entry.patientIds.add(s.patient_id);
  }
  // weekDays is already Monday → Sunday.
  return [...days.values()].filter(d => d.patientIds.size > 0);
}

export type PatientStats = {
  /** Hours worked with the patient, all time. */
  totalHours: string;
  /** The patient's sessions in `month` (all of them if `month` is empty). */
  monthSessions: Session[];
  monthHours: string;
  monthMissed: number;
};

/** Totals shown on a patient card and used by its monthly report. */
export function patientStats(sessions: readonly Session[], month: string): PatientStats {
  const monthSessions = month ? sessions.filter(s => monthKey(s.date) === month) : [...sessions];
  return {
    totalHours: formatHours(workedMinutes(sessions)),
    monthSessions,
    monthHours: formatHours(workedMinutes(monthSessions)),
    monthMissed: monthSessions.filter(isMissedSession).length,
  };
}

export type PatientRecovery = { patient: Patient; totalMinutes: number; sessions: Session[] };

/**
 * Patients with missed sessions still to recover, with the minutes owed.
 * Sessions of unknown (deleted) patients are skipped.
 */
export function pendingRecoveries(
  sessions: readonly Session[],
  patientsById: ReadonlyMap<string, Patient>
): PatientRecovery[] {
  const result = new Map<string, PatientRecovery>();
  for (const s of sessions) {
    if (!needsRecovery(s)) continue;
    const patient = patientsById.get(s.patient_id);
    if (!patient) continue;
    const entry = result.get(patient.id) ?? { patient, totalMinutes: 0, sessions: [] };
    entry.totalMinutes += s.duration_minutes;
    entry.sessions.push(s);
    result.set(patient.id, entry);
  }
  return [...result.values()];
}

/** Case- and accent-insensitive name search ("nicolo" finds "Nicolò"). */
export function matchesSearch(name: string, query: string) {
  const fold = (v: string) => v.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return fold(name).includes(fold(query.trim()));
}
