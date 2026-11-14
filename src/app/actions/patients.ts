'use server';

import { verifySession } from '@/lib/dal';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isUuid, parsePatientInput } from '@/lib/validation';
import type { Patient } from '@/types/database';

type Result<T> = { data: T | null; error: string | null };

/** All patients, alphabetically. */
export async function listPatients(): Promise<Result<Patient[]>> {
  await verifySession();
  const { data, error } = await supabaseAdmin.from('patients').select('*').order('name');
  return { data: data ?? null, error: error?.message ?? null };
}

/** Creates a patient after trimming and validating the fields. */
export async function createPatient(input: {
  name: string;
  parent_contact: string;
  notes: string;
}): Promise<Result<Patient>> {
  await verifySession();
  const parsed = parsePatientInput(input);
  if (!parsed.ok) return { data: null, error: parsed.error };
  const { data, error } = await supabaseAdmin.from('patients').insert([parsed.value]).select().single();
  return { data: data ?? null, error: error?.message ?? null };
}

/** Updates a patient's name, contact and notes. */
export async function updatePatient(
  id: string,
  input: { name: string; parent_contact: string; notes: string }
): Promise<Result<Patient>> {
  await verifySession();
  if (!isUuid(id)) return { data: null, error: 'Invalid patient.' };
  const parsed = parsePatientInput(input);
  if (!parsed.ok) return { data: null, error: parsed.error };
  const { data, error } = await supabaseAdmin
    .from('patients')
    .update(parsed.value)
    .eq('id', id)
    .select()
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

/** Deletes a patient; their sessions are removed by the ON DELETE CASCADE. */
export async function deletePatient(id: string): Promise<Result<null>> {
  await verifySession();
  if (!isUuid(id)) return { data: null, error: 'Invalid patient.' };
  const { error } = await supabaseAdmin.from('patients').delete().eq('id', id);
  return { data: null, error: error?.message ?? null };
}
