import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

/** HS256 needs a key at least as long as its 256-bit output. */
export const MIN_SECRET_LENGTH = 32;

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error('SESSION_SECRET is not set: add it to .env.local (see .env.example)');
}
// Values published in .env.example and the docs: anyone could forge sessions.
const PUBLIC_PLACEHOLDERS = ['change-me-with-a-long-random-string', 'your-session-secret'];
if (PUBLIC_PLACEHOLDERS.includes(secretKey)) {
  throw new Error('SESSION_SECRET is still the example value: generate one with `openssl rand -base64 32`');
}
if (secretKey.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters: generate one with \`openssl rand -base64 32\``
  );
}
const encodedKey = new TextEncoder().encode(secretKey);

export const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionPayload = {
  authorized: true;
  /** Session epoch at sign-in (see lib/sessionEpoch.ts). */
  epoch: number;
};

async function encrypt(payload: SessionPayload, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(encodedKey);
}

/** Verified payload of a session token, or null if missing, forged or expired. */
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Partial<SessionPayload>>(token, encodedKey, {
      algorithms: ['HS256'],
    });
    if (payload.authorized !== true) return null;
    // Tokens issued before epochs existed count as epoch 0.
    const epoch = Number.isSafeInteger(payload.epoch) ? (payload.epoch as number) : 0;
    return { authorized: true, epoch };
  } catch {
    return null;
  }
}

/** Issues the session cookie for the given epoch. */
export async function createSession(epoch: number) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encrypt({ authorized: true, epoch }, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Optimistic check: the signature is valid and not expired (used by
 * proxy.ts). It does not know about revoked epochs; lib/dal.ts does.
 */
export async function getSessionFromToken(token: string | undefined) {
  return (await decrypt(token)) !== null;
}

/** Verified payload of the current request's session cookie. */
export async function getSession() {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
