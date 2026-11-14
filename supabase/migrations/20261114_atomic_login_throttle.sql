-- Atomic sign-in throttling.
--
-- The app used to read the failure counter, compare and write it back in
-- separate requests: parallel guesses all read the same value, so a burst of
-- requests got unlimited password checks and never triggered the lockout.
-- This function claims an attempt under a row lock, BEFORE the password is
-- checked, so at most `max_attempts` checks happen per window, whatever the
-- concurrency. The app falls back to the old logic (with a warning) until
-- this migration has run.
--
-- Idempotent: safe to run more than once.

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
