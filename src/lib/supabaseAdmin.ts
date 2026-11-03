import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non impostate: aggiungile a .env.local (vedi .env.example)'
  );
}

/**
 * Client Supabase con la service role key: bypassa la Row Level Security ed
 * è quindi utilizzabile SOLO in codice server-only (Server Actions/DAL).
 * Non importare mai questo file da un componente client.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
