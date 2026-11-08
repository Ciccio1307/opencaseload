<div align="center">

# 🗓️ OpenCaseload

**Your caseload, without the spreadsheet.**

Open-source, self-hosted session tracking for therapists: patients, agenda,
recovery hours and monthly reports. All in one place, on your phone.

[![License: MIT](https://img.shields.io/badge/License-MIT-7c1034?style=for-the-badge)](LICENSE)
[![CI](https://github.com/Ciccio1307/opencaseload/actions/workflows/ci.yml/badge.svg)](https://github.com/Ciccio1307/opencaseload/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff7a59?style=for-the-badge)](#-contributing)

</div>

---

## 👋 Why OpenCaseload

Therapists — speech therapists, psychologists, physiotherapists, educators —
spend their days between sessions, commutes and parents to call back. The hours
log, though, often stays a notebook or a spreadsheet updated in the evening, in
a hurry.

**OpenCaseload** exists to take that weight away: an app that fits in your pocket,
installs on your phone's home screen and answers one question — *how many hours
did I work, and how many do I still owe?*

It is meant to be **yours**: you install it on your own space, the data stays
yours, and nobody asks you for a subscription.

> A small project, still growing (v0.1). If something is missing,
> [open an issue](../../issues/new): it is the best way to help it grow.

## ✨ What it does

| | |
| :-- | :-- |
| 📅 **Today's agenda** | The day's sessions in time order, one tap to mark *present* or *absent*. |
| 👥 **Patients** | Contacts, notes and total hours for every person you see. |
| 🔁 **Recoveries** | Missed sessions become outstanding hours per patient: you always know who owes you time. |
| 📄 **Reports** | Monthly PDF or Excel, ready to send or archive. |
| 📱 **PWA** | Add it to the home screen and it opens like a real app. |
| 🔒 **Private by design** | Password access, signed session, data read only on the server. |
| 🎨 **A bit yours** | Name, greeting and colours are set through environment variables. |

## 🚀 Up and running in five minutes

You need [Node 20+](https://nodejs.org) and a free
[Supabase](https://supabase.com) project.

**1. Set up the database**

In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql)
once: it creates the tables and enables Row Level Security.

**2. Configure the environment**

```bash
cp .env.example .env.local
```

| Variable | Required | What it is for |
| :-- | :--: | :-- |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (server only) |
| `SESSION_SECRET` | ✅ | Random string used to sign cookies (`openssl rand -base64 32`) |
| `APP_INITIAL_PASSWORD` | first run | Password until you change it from Settings |
| `NEXT_PUBLIC_APP_NAME` | — | App name (default `OpenCaseload`) |
| `NEXT_PUBLIC_APP_SHORT_NAME` | — | Short name for the home-screen icon |
| `NEXT_PUBLIC_APP_DESCRIPTION` | — | Manifest and SEO description |
| `NEXT_PUBLIC_THERAPIST_NAME` | — | Your name, shown in the greeting |
| `NEXT_PUBLIC_LOCALE` | — | Date/time locale (default `en-GB`) |
| `NEXT_PUBLIC_TIMEZONE` | — | IANA time zone of the practice, e.g. `Europe/Rome` (default `Europe/London`) |

**3. Run it**

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, sign in with `APP_INITIAL_PASSWORD` and change it
right away from **Settings**. Done.

## ☁️ Putting it online

**Netlify** is the shortest path: import the repository, add the environment
variables and deploy. `netlify.toml` is already configured and the Next.js
runtime is detected automatically.

Any Node host works too: `npm run build && npm start`.

> `NEXT_PUBLIC_*` variables are read at build time: if you change them, you need
> a new deploy.

## 🔐 Privacy, plainly

OpenCaseload stores names and contacts of real people, often minors. So:

- **Whoever deploys an instance is the data controller.** The maintainer runs
  no hosted service and never sees your data.
- The database is not reachable from the browser: the app talks to Supabase only
  from the server, with the service role key.
- Row Level Security is enabled with no public policies: the anon key cannot
  read anything.
- For screenshots, demos and bug reports, use **invented data only**.

Keep regular backups and retain data according to the rules that apply to you
(GDPR in the EU).

## 🎨 Make it yours

All branding lives in [`src/lib/branding.ts`](src/lib/branding.ts) and comes from
environment variables: no component needs to change to rename the app or the
greeting. Colours are CSS variables in
[`src/app/globals.css`](src/app/globals.css): the bordeaux theme is only a
starting point.

## 🧱 How it is built

```
src/
  app/                 pages, Server Components and Server Actions
  components/          UI (shadcn/ui + app shell)
  lib/                 auth, session, Supabase, exports, branding
  types/               shared types
supabase/schema.sql    database schema
```

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript ·
Tailwind CSS v4 · shadcn/ui · Supabase (PostgreSQL) · jsPDF · SheetJS.

## 🗺️ Where it is going

- [x] Explicit session status flow: `scheduled → completed | absent → recovered`
- [x] Exclude absences from exported totals
- [x] Timezone-safe month filtering
- [ ] Supabase Auth with a first-run setup wizard
- [x] Rate limiting on sign-in
- [ ] CSV export and replacement of the unmaintained `xlsx` dependency
- [ ] Automated tests and CI
- [ ] Docker Compose for self-hosting

Priorities are not set in stone: if one matters to you, say so.

## 🤝 Contributing

Whether you found a bug, want to translate the UI or add a feature, you are
welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md): it is short.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

For security issues, write privately instead of opening a public issue: see
[SECURITY.md](SECURITY.md).

## 📄 License

[MIT](LICENSE). Use it, change it, host it: if it helps you, a star ⭐ is always
appreciated.
