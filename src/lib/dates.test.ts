import { describe, expect, it } from 'vitest';
import { dayKey, formatDate, formatTime, monthKey, weekDayKeys, zonedToUtcISO } from '@/lib/dates';

// vitest.config.ts runs the tests in America/New_York with the instance zone
// set to Europe/Rome: every result below must follow Rome, not the runtime.

describe('test setup', () => {
  it('runs in a runtime zone different from the instance zone', () => {
    // 03:00 UTC on the 8th is still the 7th in New York.
    expect(new Date('2026-11-08T03:00:00Z').getDate()).toBe(7);
  });
});

describe('dayKey', () => {
  it('uses the instance zone, not UTC or the runtime zone', () => {
    // 23:30 UTC on 7 Nov is 00:30 on 8 Nov in Rome (UTC+1).
    expect(dayKey('2026-11-07T23:30:00Z')).toBe('2026-11-08');
    // 03:00 UTC on 8 Nov is the 8th in Rome but the 7th in New York.
    expect(dayKey('2026-11-08T03:00:00Z')).toBe('2026-11-08');
  });

  it('accepts Date objects and strings alike', () => {
    expect(dayKey(new Date('2026-01-05T10:00:00Z'))).toBe(dayKey('2026-01-05T10:00:00Z'));
  });
});

describe('monthKey', () => {
  it('puts a late-evening session in the right month', () => {
    // 31 Oct 23:30 UTC is already 1 Nov in Rome.
    expect(monthKey('2026-10-31T23:30:00Z')).toBe('2026-11');
    expect(monthKey('2026-10-31T22:30:00Z')).toBe('2026-10');
  });

  it('handles the year boundary', () => {
    expect(monthKey('2026-12-31T23:30:00Z')).toBe('2027-01');
  });
});

describe('weekDayKeys', () => {
  it('returns Monday to Sunday of the week', () => {
    // Sunday 8 Nov 2026 (Rome).
    expect(weekDayKeys('2026-11-08T12:00:00Z')).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('starts the week on the same Monday when given that Monday', () => {
    expect(weekDayKeys('2026-11-02T00:30:00+01:00')[0]).toBe('2026-11-02');
  });

  it('spans month and year boundaries', () => {
    expect(weekDayKeys('2026-12-31T12:00:00Z')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});

describe('zonedToUtcISO', () => {
  it('converts winter wall-clock time (UTC+1)', () => {
    expect(zonedToUtcISO('2026-11-08', '15:00')).toBe('2026-11-08T14:00:00.000Z');
  });

  it('converts summer wall-clock time (UTC+2)', () => {
    expect(zonedToUtcISO('2026-07-01', '09:00')).toBe('2026-07-01T07:00:00.000Z');
  });

  it('handles the days around the spring DST change (29 Mar 2026)', () => {
    expect(zonedToUtcISO('2026-03-28', '23:30')).toBe('2026-03-28T22:30:00.000Z');
    expect(zonedToUtcISO('2026-03-29', '03:30')).toBe('2026-03-29T01:30:00.000Z');
  });

  it('handles the days around the autumn DST change (25 Oct 2026)', () => {
    expect(zonedToUtcISO('2026-10-24', '10:00')).toBe('2026-10-24T08:00:00.000Z');
    expect(zonedToUtcISO('2026-10-25', '10:00')).toBe('2026-10-25T09:00:00.000Z');
  });

  it('round-trips through dayKey', () => {
    expect(dayKey(zonedToUtcISO('2026-11-08', '00:15'))).toBe('2026-11-08');
    expect(dayKey(zonedToUtcISO('2026-11-08', '23:45'))).toBe('2026-11-08');
  });
});

describe('formatDate / formatTime', () => {
  it('format in the instance zone and locale', () => {
    expect(formatDate('2026-11-07T23:30:00Z')).toBe('08/11/2026');
    expect(formatTime('2026-11-07T23:30:00Z')).toBe('00:30');
  });

  it('pass extra options through', () => {
    expect(formatDate('2026-11-08T12:00:00Z', { weekday: 'long' })).toBe('Sunday');
  });
});
