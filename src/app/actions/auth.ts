'use server';

import { redirect } from 'next/navigation';
import { verifyPassword, setPassword } from '@/lib/password';
import { createSession, deleteSession } from '@/lib/session';
import { verifySession } from '@/lib/dal';
import { clearFailures, lockoutMinutesLeft, recordFailure } from '@/lib/loginThrottle';

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') || '');

  const locked = await lockoutMinutesLeft();
  if (locked > 0) {
    return { error: `Too many failed attempts. Try again in ${locked} min.` };
  }

  const ok = await verifyPassword(password);
  if (!ok) {
    const lockout = await recordFailure();
    return {
      error: lockout
        ? `Too many failed attempts. Try again in ${lockout} min.`
        : 'Wrong password, try again.',
    };
  }

  await clearFailures();
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
    return { error: 'Current password is incorrect.' };
  }

  if (newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' };
  }

  await setPassword(newPassword);
  return { success: true };
}
