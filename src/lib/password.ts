import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// First-run password, used only until one is set from Settings: from then on
// only the hash stored in the database is valid. Configure it in .env.local
// (see .env.example).
const INITIAL_PASSWORD = process.env.APP_INITIAL_PASSWORD;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyHash(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hashHex, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function getStoredHash(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'password_hash')
    .maybeSingle();
  return data?.value ?? null;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const storedHash = await getStoredHash();
  if (storedHash) {
    return verifyHash(password, storedHash);
  }

  if (!INITIAL_PASSWORD) {
    console.warn(
      '[auth] No password configured: set APP_INITIAL_PASSWORD in .env.local on first install.'
    );
    return false;
  }

  return safeEqual(password, INITIAL_PASSWORD);
}

export async function setPassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key: 'password_hash', value: hash }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
