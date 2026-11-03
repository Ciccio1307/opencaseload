'use server';

import { redirect } from 'next/navigation';
import { verifyPassword, setPassword } from '@/lib/password';
import { createSession, deleteSession } from '@/lib/session';
import { verifySession } from '@/lib/dal';

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') || '');

  const ok = await verifyPassword(password);
  if (!ok) {
    return { error: 'Password errata, riprova.' };
  }

  await createSession();
  redirect('/');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  await verifySession();

  const currentPassword = String(formData.get('currentPassword') || '');
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  const ok = await verifyPassword(currentPassword);
  if (!ok) {
    return { error: 'La password attuale non è corretta.' };
  }

  if (newPassword.length < 6) {
    return { error: 'La nuova password deve avere almeno 6 caratteri.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Le nuove password non combaciano.' };
  }

  await setPassword(newPassword);
  return { success: true };
}
