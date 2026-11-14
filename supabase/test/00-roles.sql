-- Minimal stand-in for the roles Supabase creates, for the local test stack
-- (docker-compose.test.yml). Not used in production.
create role anon nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'authenticator-test-password';
grant anon, service_role to authenticator;
