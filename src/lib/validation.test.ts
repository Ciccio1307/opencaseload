import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_LENGTH,
  MAX_SESSION_MINUTES,
  MAX_TEXT_LENGTH,
  isSessionStatus,
  isUuid,
  parsePatientInput,
  parseSessionInput,
  reportFileName,
} from '@/lib/validation';

const PATIENT_ID = '3f2b8c1e-5a4d-4e6f-9b7a-0c1d2e3f4a5b';

describe('isSessionStatus', () => {
  it('accepts the five statuses', () => {
    for (const s of ['scheduled', 'completed', 'absent', 'to_recover', 'recovered']) {
      expect(isSessionStatus(s)).toBe(true);
    }
  });

  it('rejects anything else, including the old Italian values', () => {
    for (const s of ['programmata', 'Completed', '', null, undefined, 3]) {
      expect(isSessionStatus(s)).toBe(false);
    }
  });
});

describe('isUuid', () => {
  it('accepts a UUID and rejects other strings', () => {
    expect(isUuid(PATIENT_ID)).toBe(true);
    expect(isUuid(PATIENT_ID.toUpperCase())).toBe(true);
    expect(isUuid('1')).toBe(false);
    expect(isUuid(`${PATIENT_ID},x`)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('parsePatientInput', () => {
  it('trims every field', () => {
    expect(parsePatientInput({ name: '  Ada Rossi ', parent_contact: ' 333 ', notes: ' x ' })).toEqual({
      ok: true,
      value: { name: 'Ada Rossi', parent_contact: '333', notes: 'x' },
    });
  });

  it('turns missing optional fields into empty strings', () => {
    expect(parsePatientInput({ name: 'Ada' })).toEqual({
      ok: true,
      value: { name: 'Ada', parent_contact: '', notes: '' },
    });
  });

  it('requires a name', () => {
    expect(parsePatientInput({ name: '   ' })).toMatchObject({ ok: false });
    expect(parsePatientInput(undefined)).toMatchObject({ ok: false });
  });

  it('limits field lengths', () => {
    expect(parsePatientInput({ name: 'a'.repeat(MAX_NAME_LENGTH + 1) })).toMatchObject({ ok: false });
    expect(parsePatientInput({ name: 'a', parent_contact: 'a'.repeat(MAX_NAME_LENGTH + 1) })).toMatchObject({
      ok: false,
    });
    expect(parsePatientInput({ name: 'a', notes: 'a'.repeat(MAX_TEXT_LENGTH + 1) })).toMatchObject({ ok: false });
    expect(parsePatientInput({ name: 'a'.repeat(MAX_NAME_LENGTH) })).toMatchObject({ ok: true });
  });

  it('ignores unexpected fields', () => {
    const r = parsePatientInput({ name: 'Ada', id: 'evil', created_at: 'x' });
    expect(r.ok && Object.keys(r.value)).toEqual(['name', 'parent_contact', 'notes']);
  });
});

describe('parseSessionInput', () => {
  const valid = {
    patient_id: PATIENT_ID,
    date: '2026-11-08T14:00:00.000Z',
    duration_minutes: 60,
    status: 'scheduled',
    notes: ' first ',
  };

  it('accepts a valid session and normalises it', () => {
    expect(parseSessionInput({ ...valid, date: '2026-11-08T15:00:00+01:00' })).toEqual({
      ok: true,
      value: { ...valid, notes: 'first' },
    });
  });

  it('defaults the status to scheduled', () => {
    expect(parseSessionInput({ ...valid, status: undefined })).toMatchObject({ ok: true, value: { status: 'scheduled' } });
  });

  it.each([
    ['patient id', { patient_id: 'nope' }],
    ['date', { date: 'not a date' }],
    ['date type', { date: 1731074400000 }],
    ['zero duration', { duration_minutes: 0 }],
    ['negative duration', { duration_minutes: -30 }],
    ['fractional duration', { duration_minutes: 30.5 }],
    ['string duration', { duration_minutes: '60' }],
    ['huge duration', { duration_minutes: MAX_SESSION_MINUTES + 1 }],
    ['status', { status: 'programmata' }],
    ['notes', { notes: 'a'.repeat(MAX_TEXT_LENGTH + 1) }],
  ])('rejects an invalid %s', (_label, patch) => {
    expect(parseSessionInput({ ...valid, ...patch })).toMatchObject({ ok: false });
  });
});

describe('reportFileName', () => {
  it('replaces spaces and unsafe characters', () => {
    expect(reportFileName('Ada Rossi', 'pdf')).toBe('Report_Ada_Rossi.pdf');
    expect(reportFileName('A/B: "C"?', 'xlsx')).toBe('Report_A_B_C.xlsx');
    expect(reportFileName('../../etc/passwd', 'pdf')).toBe('Report_etc_passwd.pdf');
  });

  it('strips accents', () => {
    expect(reportFileName('Niccolò Pérez', 'pdf')).toBe('Report_Niccolo_Perez.pdf');
  });

  it('falls back when nothing usable is left', () => {
    expect(reportFileName('???', 'pdf')).toBe('Report_patient.pdf');
  });
});
