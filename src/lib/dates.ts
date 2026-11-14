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

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Calendar fields of an instant, as seen in the instance time zone. */
export function zonedParts(date: Date | string): ZonedParts {
  const d = typeof date === 'string' ? new Date(date) : date;
  // One formatToParts call (it is the expensive part), not one per field.
  const parts: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
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

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The seven "YYYY-MM-DD" keys (Monday to Sunday) of the week containing
 * `date`: an instant, or a day key itself. A bare "YYYY-MM-DD" is read as a
 * calendar day, not as UTC midnight (which is the previous day west of UTC).
 */
export function weekDayKeys(date: Date | string) {
  const m = typeof date === 'string' ? DAY_KEY_RE.exec(date) : null;
  const p = m ? { year: +m[1], month: +m[2], day: +m[3] } : zonedParts(date);
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

/** Localised date in the instance zone and locale (LOCALE, e.g. "08/11/2026"). */
export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(date).toLocaleDateString(LOCALE, { ...options, timeZone: TIMEZONE });
}

/** Localised "HH:MM" in the instance zone and locale. */
export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}
