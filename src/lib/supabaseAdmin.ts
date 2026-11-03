import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set: add them to .env.local (see .env.example)'
  );
}

/**
 * Supabase client using the service role key: it bypasses Row Level Security
 * and may therefore be used ONLY in server-only code (Server Actions/DAL).
 * Never import this file from a client component.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
