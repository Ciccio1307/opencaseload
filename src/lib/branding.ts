/**
 * Branding dell'app.
 *
 * Ogni istanza può personalizzarlo dalle variabili d'ambiente `NEXT_PUBLIC_*`
 * (vedi `.env.example`). Sono lette sia lato server sia lato client, quindi
 * possono essere usate liberamente nei componenti.
 */

const clean = (value: string | undefined) => value?.trim() || undefined;

export const APP_NAME = clean(process.env.NEXT_PUBLIC_APP_NAME) ?? "Sedute";
export const APP_SHORT_NAME = clean(process.env.NEXT_PUBLIC_APP_SHORT_NAME) ?? APP_NAME;
export const APP_DESCRIPTION =
  clean(process.env.NEXT_PUBLIC_APP_DESCRIPTION) ??
  "Agenda, recuperi e resoconti per l’attività di terapia.";
export const THERAPIST_NAME = clean(process.env.NEXT_PUBLIC_THERAPIST_NAME) ?? "";

/** Saluto in base all'ora, con il nome del terapista se configurato. */
export function greeting(hour: number, name = THERAPIST_NAME) {
  const base =
    hour < 6 ? "Buonanotte" : hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  return name ? `${base}, ${name}` : base;
}
