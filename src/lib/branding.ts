/**
 * App branding.
 *
 * Every instance can customise it through the `NEXT_PUBLIC_*` environment
 * variables (see `.env.example`). They are available on both the server and
 * the client, so they can be used freely in components.
 */

const clean = (value: string | undefined) => value?.trim() || undefined;

export const APP_NAME = clean(process.env.NEXT_PUBLIC_APP_NAME) ?? "OpenCaseload";
export const APP_SHORT_NAME = clean(process.env.NEXT_PUBLIC_APP_SHORT_NAME) ?? APP_NAME;
export const APP_DESCRIPTION =
  clean(process.env.NEXT_PUBLIC_APP_DESCRIPTION) ??
  "Open-source caseload management for therapists: sessions, recovery hours and reports.";
export const THERAPIST_NAME = clean(process.env.NEXT_PUBLIC_THERAPIST_NAME) ?? "";

/** Locale used for dates and times (configurable per instance). */
export const LOCALE = clean(process.env.NEXT_PUBLIC_LOCALE) ?? "en-GB";

/**
 * IANA time zone the practice works in (e.g. "Europe/Rome"). Dates are always
 * shown and grouped in this zone, so server and browser render the same thing.
 */
export const TIMEZONE = clean(process.env.NEXT_PUBLIC_TIMEZONE) ?? "Europe/London";

/** Time-based greeting, with the therapist name when configured. */
export function greeting(hour: number, name = THERAPIST_NAME) {
  const base =
    hour < 6 ? "Good night" : hour < 13 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : base;
}
