# Contributing

Thanks for your interest! This project is small and deliberately simple: the
most useful contributions are bug fixes, tests and documentation improvements.

## Local setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. `cp .env.example .env.local` and fill in the values.
3. `npm install && npm run dev`.

## Before opening a pull request

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- Keep changes small and focused on one thing.
- Write commit messages in the imperative mood (e.g. `Fix month filter in
  patient export`).
- Never include real patient data: use invented data only.
- For larger changes, open an issue first to discuss the approach.

## Reporting issues

When you open an issue, do not include names, contacts or any other personal
data. For security problems, follow [SECURITY.md](SECURITY.md).
