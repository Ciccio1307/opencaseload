'use server';

import { verifySession } from '@/lib/dal';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSessionStatus, isUuid, parseSessionInput } from '@/lib/validation';
import type { Session, SessionStatus } from '@/types/database';

type Result<T> = { data: T | null; error: string | null };

/** Every session, of every patient. */
export async function listSessions(): Promise<Result<Session[]>> {
  await verifySession();
  const { data, error } = await supabaseAdmin.from('sessions').select('*');
  return { data: data ?? null, error: error?.message ?? null };
}

/** Schedules a session. `date` is a UTC ISO instant (see `zonedToUtcISO`). */
export async function createTherapySession(input: {
  patient_id: string;
  date: string;
  duration_minutes: number;
  status: SessionStatus;
  notes: string;
}): Promise<Result<Session>> {
  await verifySession();
  const parsed = parseSessionInput(input);
  if (!parsed.ok) return { data: null, error: parsed.error };
  const { data, error } = await supabaseAdmin.from('sessions').insert([parsed.value]).select().single();
  return { data: data ?? null, error: error?.message ?? null };
}

/** Sets the status of one session (e.g. scheduled → completed or absent). */
export async function updateSessionStatus(
  id: string,
  status: SessionStatus
): Promise<Result<Session>> {
  await verifySession();
  if (!isUuid(id)) return { data: null, error: 'Invalid session.' };
  if (!isSessionStatus(status)) return { data: null, error: 'Invalid status.' };
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function deleteTherapySession(id: string): Promise<Result<null>> {
  await verifySession();
  if (!isUuid(id)) return { data: null, error: 'Invalid session.' };
  const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id);
  return { data: null, error: error?.message ?? null };
}

/**
 * Marks missed sessions as recovered. Only sessions that are still waiting
 * for a recovery change: completed or scheduled ones are never touched, even
 * if their id is passed.
 */
export async function recoverSessions(ids: string[]): Promise<Result<null>> {
  await verifySession();
  if (!Array.isArray(ids) || !ids.every(isUuid)) return { data: null, error: 'Invalid session.' };
  if (ids.length === 0) return { data: null, error: null };
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({ status: 'recovered' })
    .in('id', ids)
    .in('status', ['absent', 'to_recover']);
  return { data: null, error: error?.message ?? null };
}
