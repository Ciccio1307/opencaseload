-- Schema di base per Sedute.
-- Eseguilo una volta nel SQL Editor di Supabase, su un progetto vuoto.

create extension if not exists "pgcrypto";

-- Anagrafica pazienti --------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_contact text,
  notes text,
  created_at timestamptz not null default now()
);

-- Sedute ---------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  date timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'programmata'
    check (status in ('programmata', 'completata', 'assente', 'da_recuperare', 'recuperata')),
  notes text
);

create index if not exists sessions_patient_id_idx on public.sessions (patient_id);
create index if not exists sessions_date_idx on public.sessions (date);

-- Impostazioni (password hash e configurazione) ------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

-- Row Level Security ---------------------------------------------------------
-- L'app accede solo lato server con la service role key, che bypassa la RLS.
-- Abilitare la RLS senza policy blocca del tutto l'accesso con la chiave
-- pubblica (anon): non aggiungere policy permissive.
alter table public.patients enable row level security;
alter table public.sessions enable row level security;
alter table public.app_settings enable row level security;
