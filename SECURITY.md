# Security

## Reporting a vulnerability

Please do not open a public issue. Contact the maintainer privately with:

- the affected version or commit
- steps to reproduce the problem
- the estimated impact

You will get a reply as soon as possible; the fix will be released together with
an advisory, if needed.

## Notes for people hosting the app

- Keep `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` only in the host's
  environment variables, never in the repository.
- Change `APP_INITIAL_PASSWORD` at first sign-in from Settings.
- Do not disable Row Level Security: the app uses the service role key on the
  server and needs no public policies.
- Back up the database regularly and retain patient data in line with the
  applicable regulations.
