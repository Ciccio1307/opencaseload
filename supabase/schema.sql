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
