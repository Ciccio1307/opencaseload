/**
 * Input validation for Server Actions.
 *
 * Server Actions are public HTTP endpoints: anyone holding a session cookie can
 * call them with arbitrary payloads, bypassing the forms. Everything they write
 * is normalised and checked here before it reaches the database.
 */
import type { SessionStatus } from '@/types/database';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 120;
export const MAX_TEXT_LENGTH = 2000;
/** Longest session accepted, in minutes (one working day). */
export const MAX_SESSION_MINUTES = 8 * 60;

const STATUSES: readonly SessionStatus[] = [
  'scheduled',
  'completed',
  'absent',
  'to_recover',
  'recovered',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function isSessionStatus(value: unknown): value is SessionStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export type PatientInput = { name: string; parent_contact: string; notes: string };

/** Trims the fields and rejects a missing name or oversized text. */
export function parsePatientInput(input: unknown): Validated<PatientInput> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const value = {
    name: text(raw.name),
    parent_contact: text(raw.parent_contact),
    notes: text(raw.notes),
  };
  if (!value.name) return { ok: false, error: 'Name is required.' };
  if (value.name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be at most ${MAX_NAME_LENGTH} characters.` };
  }
  if (value.parent_contact.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Contact must be at most ${MAX_NAME_LENGTH} characters.` };
  }
  if (value.notes.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Notes must be at most ${MAX_TEXT_LENGTH} characters.` };
  }
  return { ok: true, value };
}

export type SessionInput = {
  patient_id: string;
  date: string;
  duration_minutes: number;
  status: SessionStatus;
  notes: string;
};

/** Checks ids, date, duration and status of a new session. */
export function parseSessionInput(input: unknown): Validated<SessionInput> {
  const raw = (input ?? {}) as Record<string, unknown>;
  if (!isUuid(raw.patient_id)) return { ok: false, error: 'Invalid patient.' };

  const date = typeof raw.date === 'string' ? new Date(raw.date) : null;
  if (!date || Number.isNaN(date.getTime())) return { ok: false, error: 'Invalid date.' };

  const duration = raw.duration_minutes;
  if (
    typeof duration !== 'number' ||
    !Number.isInteger(duration) ||
    duration <= 0 ||
    duration > MAX_SESSION_MINUTES
  ) {
    return { ok: false, error: `Duration must be 1–${MAX_SESSION_MINUTES} minutes.` };
  }

  const status = raw.status ?? 'scheduled';
  if (!isSessionStatus(status)) return { ok: false, error: 'Invalid status.' };

  const notes = text(raw.notes);
  if (notes.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Notes must be at most ${MAX_TEXT_LENGTH} characters.` };
  }

  return {
    ok: true,
    value: { patient_id: raw.patient_id, date: date.toISOString(), duration_minutes: duration, status, notes },
  };
}

/**
 * Safe file name for a report: patient names may contain characters that are
 * illegal in file names (/ \ : * ? " < > |) or accents some systems mangle.
 */
export function reportFileName(patientName: string, extension: 'pdf' | 'xlsx') {
  const base =
    patientName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'patient';
  return `Report_${base}.${extension}`;
}
