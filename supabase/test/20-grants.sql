-- Supabase's default grants: both API roles may touch the tables, and Row
-- Level Security (enabled in schema.sql, with no policies) is what keeps the
-- public anon key out. The integration tests check exactly that.
grant usage on schema public to anon, service_role;
grant all on all tables in schema public to anon, service_role;
