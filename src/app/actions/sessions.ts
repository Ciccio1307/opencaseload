'use server';

import { verifySession } from '@/lib/dal';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Session, SessionStatus } from '@/types/database';

type Result<T> = { data: T | null; error: string | null };

export async function listSessions(): Promise<Result<Session[]>> {
  await verifySession();
  const { data, error } = await supabaseAdmin.from('sessions').select('*');
  return { data: data ?? null, error: error?.message ?? null };
}

export async function createTherapySession(input: {
  patient_id: string;
  date: string;
  duration_minutes: number;
  status: SessionStatus;
  notes: string;
}): Promise<Result<Session>> {
  await verifySession();
  const { data, error } = await supabaseAdmin.from('sessions').insert([input]).select().single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus
): Promise<Result<Session>> {
  await verifySession();
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
  const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id);
  return { data: null, error: error?.message ?? null };
}

export async function recoverSessions(ids: string[]): Promise<Result<null>> {
  await verifySession();
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({ status: 'recuperata' })
    .in('id', ids);
  return { data: null, error: error?.message ?? null };
}
