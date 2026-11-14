-- Base schema for OpenCaseload.
-- Run it once in the Supabase SQL Editor on an empty project.

create extension if not exists "pgcrypto";

-- Patients -------------------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_contact text,
  notes text,
  created_at timestamptz not null default now()
);

-- Sessions -------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  date timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'absent', 'to_recover', 'recovered')),
  notes text
);

create index if not exists sessions_patient_id_idx on public.sessions (patient_id);
create index if not exists sessions_date_idx on public.sessions (date);

-- Settings (password hash and configuration) ---------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

-- Row Level Security ---------------------------------------------------------
-- The app only accesses data server-side with the service role key, which
-- bypasses RLS. Enabling RLS without policies blocks the public (anon) key
-- completely: do not add permissive policies.
alter table public.patients enable row level security;
alter table public.sessions enable row level security;
alter table public.app_settings enable row level security;

-- Sign-in throttling ----------------------------------------------------------
-- Same function as supabase/migrations/20261114_atomic_login_throttle.sql,
-- which explains it. Keep the two in sync.
create or replace function public.claim_login_attempt(
  max_attempts integer default 5,
  window_seconds integer default 900,
  lockout_seconds integer default 900
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  state jsonb;
  attempts integer;
  first_at bigint;
  locked_until bigint;
begin
  insert into public.app_settings (key, value)
  values ('login_failures', '{"count":0,"firstAt":0,"lockedUntil":0}')
  on conflict (key) do nothing;

  -- Serialises concurrent sign-ins: each waits for the previous claim.
  select value::jsonb into state
  from public.app_settings
  where key = 'login_failures'
  for update;

  attempts := coalesce((state->>'count')::integer, 0);
  first_at := coalesce((state->>'firstAt')::bigint, 0);
  locked_until := coalesce((state->>'lockedUntil')::bigint, 0);

  if locked_until > now_ms then
    return jsonb_build_object('allowed', false, 'minutes', ceil((locked_until - now_ms) / 60000.0)::integer);
  end if;

  if now_ms - first_at > window_seconds * 1000 then
    attempts := 0;
    first_at := now_ms;
  end if;
  attempts := attempts + 1;

  if attempts >= max_attempts then
    -- This is the last check allowed; lock until the window has passed.
    -- A correct password still signs in and clears the lock.
    locked_until := now_ms + lockout_seconds * 1000;
    attempts := 0;
    first_at := 0;
  else
    locked_until := 0;
  end if;

  update public.app_settings
  set value = jsonb_build_object('count', attempts, 'firstAt', first_at, 'lockedUntil', locked_until)::text
  where key = 'login_failures';

  return jsonb_build_object(
    'allowed', true,
    'last', locked_until > 0,
    'minutes', case when locked_until > 0 then lockout_seconds / 60 else 0 end
  );
exception
  when invalid_text_representation then
    -- Corrupted state: start over rather than locking everyone out forever.
    update public.app_settings
    set value = '{"count":1,"firstAt":' || now_ms || ',"lockedUntil":0}'
    where key = 'login_failures';
    return jsonb_build_object('allowed', true, 'last', false, 'minutes', 0);
end;
$$;

-- Only the server (service role) may call it: never the public anon key.
revoke all on function public.claim_login_attempt(integer, integer, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.claim_login_attempt(integer, integer, integer) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.claim_login_attempt(integer, integer, integer) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_login_attempt(integer, integer, integer) to service_role';
  end if;
end;
$$;
