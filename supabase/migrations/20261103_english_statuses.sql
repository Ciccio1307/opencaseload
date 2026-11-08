-- Migrates session statuses from Italian to English.
-- Run once on databases created with the previous schema.
-- Wrapped in a transaction: if any step fails, nothing is changed.

begin;

alter table public.sessions drop constraint if exists sessions_status_check;

update public.sessions
set status = case status
  when 'programmata' then 'scheduled'
  when 'completata' then 'completed'
  when 'assente' then 'absent'
  when 'da_recuperare' then 'to_recover'
  when 'recuperata' then 'recovered'
  else status
end;

alter table public.sessions
  add constraint sessions_status_check
  check (status in ('scheduled', 'completed', 'absent', 'to_recover', 'recovered'));

alter table public.sessions alter column status set default 'scheduled';

commit;
