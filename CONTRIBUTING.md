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
npm test
npm run build
```

Tests live next to the code they cover (`src/**/*.test.ts`) and run in
Node with Vitest, without a database: server code gets the in-memory fake in
`src/test/fakeSupabase.ts`. They run in the `America/New_York` zone with the
instance zone set to `Europe/Rome`, so any date code that leaks the runtime's
own zone fails. `npm run test:watch` reruns them on save.

Integration tests (`src/test/integration/`) run the real Server Actions
against Postgres + PostgREST in Docker, loaded with `supabase/schema.sql` and
the invented dataset:

```bash
docker compose -f docker-compose.test.yml up -d --wait
npm run test:integration
docker compose -f docker-compose.test.yml down
```

The dataset comes from `node scripts/generate-test-data.mjs` (deterministic):
regenerate it instead of editing `dataset.json` or `test-data.sql` by hand,
and never put real patient data in fixtures.

- Keep changes small and focused on one thing.
- Write commit messages in the imperative mood (e.g. `Fix month filter in
  patient export`).
- Never include real patient data: use invented data only.
- For larger changes, open an issue first to discuss the approach.

## Reporting issues

When you open an issue, do not include names, contacts or any other personal
data. For security problems, follow [SECURITY.md](SECURITY.md).
