'use server';

import { verifySession } from '@/lib/dal';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Patient } from '@/types/database';

type Result<T> = { data: T | null; error: string | null };

export async function listPatients(): Promise<Result<Patient[]>> {
  await verifySession();
  const { data, error } = await supabaseAdmin.from('patients').select('*').order('name');
  return { data: data ?? null, error: error?.message ?? null };
}

export async function createPatient(input: {
  name: string;
  parent_contact: string;
  notes: string;
}): Promise<Result<Patient>> {
  await verifySession();
  const { data, error } = await supabaseAdmin.from('patients').insert([input]).select().single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function updatePatient(
  id: string,
  input: { name: string; parent_contact: string; notes: string }
): Promise<Result<Patient>> {
  await verifySession();
  const { data, error } = await supabaseAdmin
    .from('patients')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function deletePatient(id: string): Promise<Result<null>> {
  await verifySession();
  const { error } = await supabaseAdmin.from('patients').delete().eq('id', id);
  return { data: null, error: error?.message ?? null };
}
