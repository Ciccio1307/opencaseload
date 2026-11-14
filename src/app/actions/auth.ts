'use server';

import { redirect } from 'next/navigation';
import { verifyPassword, setPassword } from '@/lib/password';
import { createSession, deleteSession } from '@/lib/session';
import { bumpEpoch, currentEpoch } from '@/lib/sessionEpoch';
import { verifySession } from '@/lib/dal';
import { claimAttempt, clearFailures } from '@/lib/loginThrottle';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation';

export type LoginState = { error?: string } | undefined;

const lockedMessage = (minutes: number) => `Too many failed attempts. Try again in ${minutes} min.`;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') || '');

  // The attempt is counted before the password is checked (atomically), so
  // parallel guesses cannot get past the limit.
  const claim = await claimAttempt();
  if (!claim.allowed) return { error: lockedMessage(claim.minutes) };

  if (!(await verifyPassword(password))) {
    return { error: claim.lastMinutes ? lockedMessage(claim.lastMinutes) : 'Wrong password, try again.' };
  }

  await clearFailures();
  await createSession(await currentEpoch());
  redirect('/');
}

/** Signs out this device only. */
export async function logout() {
  await deleteSession();
  redirect('/login');
}

/** Revokes every session on every device, this one included. */
export async function logoutEverywhere() {
  await verifySession();
  await bumpEpoch();
  await deleteSession();
  redirect('/login');
}

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

/**
 * Changes the password and revokes every other session: whoever had stolen a
 * session cookie loses it. This device gets a fresh session and stays in.
 */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  await verifySession();

  const currentPassword = String(formData.get('currentPassword') || '');
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  // Counts towards the lockout like a failed sign-in: a stolen session must
  // not become an unthrottled oracle for guessing the password.
  const claim = await claimAttempt();
  if (!claim.allowed) return { error: lockedMessage(claim.minutes) };

  if (!(await verifyPassword(currentPassword))) {
    return { error: claim.lastMinutes ? lockedMessage(claim.lastMinutes) : 'Current password is incorrect.' };
  }
  await clearFailures();

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' };
  }

  await setPassword(newPassword);
  await createSession(await bumpEpoch());
  return { success: true };
}
