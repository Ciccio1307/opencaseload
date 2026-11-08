/**
 * Date helpers pinned to the instance time zone (NEXT_PUBLIC_TIMEZONE).
 *
 * Sessions are stored as UTC instants. Formatting them with the runtime's own
 * time zone would give different results on the server (usually UTC) and in
 * the browser, causing hydration mismatches and sessions landing on the wrong
 * day or month. Every date shown or grouped in the UI goes through here.
 */
import { LOCALE, TIMEZONE } from '@/lib/branding';

const pad = (n: number) => String(n).padStart(2, '0');

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Calendar fields of an instant, as seen in the instance time zone. */
export function zonedParts(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const get = (type: string) =>
    Number(partsFormatter.formatToParts(d).find(p => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** "YYYY-MM-DD" in the instance time zone (also the value of <input type="date">). */
export function dayKey(date: Date | string) {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM" in the instance time zone (also the value of <input type="month">). */
export function monthKey(date: Date | string) {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}`;
}

/** The seven "YYYY-MM-DD" keys (Monday to Sunday) of the week containing `date`. */
export function weekDayKeys(date: Date | string) {
  const p = zonedParts(date);
  // Plain calendar arithmetic on a UTC date: no time zone involved any more.
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const mondayOffset = (base.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - mondayOffset + i);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  });
}

/** Offset (ms) of the instance time zone from UTC at the given instant. */
function tzOffset(utcMs: number) {
  const p = zonedParts(new Date(utcMs));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

/**
 * Converts a wall-clock date and time typed in the instance time zone
 * ("2026-11-08", "15:00") to a UTC ISO string, independently of the
 * browser's own time zone. Handles DST changes.
 */
export function zonedToUtcISO(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wallClock = Date.UTC(y, m - 1, d, h, mi);
  let utc = wallClock - tzOffset(wallClock);
  // Second pass: the offset may differ at the corrected instant (DST edge).
  utc = wallClock - tzOffset(utc);
  return new Date(utc).toISOString();
}

export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(date).toLocaleDateString(LOCALE, { ...options, timeZone: TIMEZONE });
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}
