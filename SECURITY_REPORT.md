# Security report

Security audit of OpenCaseload, November 2026. Scope: the whole repository
(`src/`, `supabase/`, configuration, CI, dependencies, git history). Method:
code review, threat modelling for a single-user app holding data about minors,
dependency audit, and **verification by tests**. Every fixed finding has an
automated test that fails without the fix. Several were checked against a real
Postgres + PostgREST (`npm run test:integration`), and in a browser against the
production build.

For how to report a vulnerability, see [SECURITY.md](SECURITY.md).

## Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| H1 | **High** | Sign-in throttle bypassed by parallel requests (race condition) | Fixed |
| H2 | **High** | Example `SESSION_SECRET` accepted: anyone can forge a session | Fixed |
| H3 | **High** | Example / trivial `APP_INITIAL_PASSWORD` accepted (default credentials) | Fixed |
| H4 | **High** | Sessions cannot be revoked: a stolen cookie works for 30 days, even after a password change | Fixed |
| M1 | Medium | Global lockout lets anyone keep the therapist from signing in | Open (by design, mitigated) |
| M2 | Medium | Server Actions trust their input (status, ids, lengths, recovery of any session) | Fixed |
| M3 | Medium | No security headers: clickjacking, MIME sniffing, no CSP | Fixed |
| M4 | Medium | Password change is an unthrottled password oracle for a session thief | Fixed |
| M5 | Medium | `xlsx` 0.18.5 with published advisories | Fixed (0.20.3) |
| L1 | Low | Full session history sent to the browser on every page | Open |
| L2 | Low | Settings page rendered without a server-side session check | Fixed |
| L3 | Low | Unsafe characters in report file names | Fixed |
| L4 | Low | Minimum password length 6 | Fixed (8) |
| L5 | Low | CSP still needs `'unsafe-inline'` for scripts | Open |
| L6 | Low | Advisories in dev-only tooling (eslint, shadcn CLI) | Open (not shipped) |
| L7 | Low | `X-Powered-By` header discloses the framework | Fixed |

**No critical findings.** No secret has ever been committed: the full git
history was searched for keys and JWTs. Supabase is never reachable from the
browser, and Row Level Security blocks the public key. Those last two points
are verified by integration tests.

---

## High

### H1. Sign-in throttle bypassed by parallel requests

**Where:** `src/lib/loginThrottle.ts` (before), `src/app/actions/auth.ts`.

The throttle read the failure counter, checked the password, then wrote the
counter back, in separate database round trips. Concurrent requests all read
the same counter, so each one got a password check and none of them triggered
the lockout. The "5 attempts per 15 minutes" limit therefore held only for a
polite attacker.

**Exploit:** the login form is a Server Action, so it is a plain POST that a
script can repeat. The action id is in the page's JavaScript. For example, with
a list of candidate passwords:

```bash
# 40 guesses at once: every one of them was checked, and no lockout followed
cat guesses.txt | xargs -P 40 -I{} curl -s https://caseload.example/login \
  -H 'Next-Action: <id from the login page bundle>' \
  -F '1_password={}' -F '0=["$K1"]'
```

**Measured before the fix** against the real database: 40 parallel wrong
guesses meant 40 password checks, and the 41st attempt was *not* locked out.

**Fix:**
- A new Postgres function, `claim_login_attempt()` (in `supabase/schema.sql`
  and migration `20261114_atomic_login_throttle.sql`), *claims* each attempt
  **before** the password is checked. It takes a row lock (`SELECT … FOR
  UPDATE`), so parallel requests are processed one at a time.
- Execute permission on the function is revoked from `anon` and
  `authenticated`.
- If the throttle cannot be read, the app *fails closed*: no password is
  checked.
- Databases that have not run the migration yet fall back to the old logic and
  log a warning.

**Verified:** `src/test/integration/race.int.test.ts`. In a 40-request burst,
at most 5 passwords are checked and the next attempt is locked out. The anon
key gets `42501 permission denied` when calling the function.

### H2. Example `SESSION_SECRET` accepted

**Where:** `src/lib/session.ts`, `.env.example`.

`.env.example` ships `SESSION_SECRET=change-me-with-a-long-random-string`. Any
instance deployed with the example values signs its cookies with a key that is
public on GitHub. An attacker then mints their own session and gets full
access to every patient record:

```js
// anyone can run this against an instance that kept the example secret
new SignJWT({ authorized: true }).setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('30d')
  .sign(new TextEncoder().encode('change-me-with-a-long-random-string'))
// → Cookie: session=<token>
```

Short secrets were also accepted (for example `SESSION_SECRET=secret`). They
can be brute-forced offline from a single captured cookie.

**Fix:** the app refuses to start if the secret is a known placeholder or
shorter than 32 characters. The error message tells you how to generate one.
Tested in `src/lib/session.test.ts`.

### H3. Default first-run password

**Where:** `src/lib/password.ts`.

`APP_INITIAL_PASSWORD=change-me` from `.env.example` worked as a real
password, and stayed valid until someone changed it in Settings.

**Payload:** the password `change-me` on any freshly deployed instance.

**Fix:** sign-in with the initial password is disabled, with a log message,
when it is a known placeholder (`change-me`, `changeme`, `password`, `admin`)
or shorter than 8 characters. Tested in `src/lib/password.test.ts`.

### H4. Sessions could not be revoked

**Where:** `src/lib/session.ts`, `src/lib/dal.ts`, `src/app/actions/auth.ts`.

The session is a stateless 30-day JWT. "Sign out" only deleted the cookie in
*this* browser, and changing the password did not affect existing tokens. A
cookie copied from a shared computer, a lost phone or a backup kept working
for up to 30 days, and the therapist had no way to stop it.

**Fix: session epoch.**
- A counter in `app_settings` is copied into every token when it is issued.
- `verifySession()` (which runs on every page and every action) rejects tokens
  from an older epoch.
- Changing the password bumps the counter, and the current device gets a fresh
  token.
- A new **Sign out of all devices** button in Settings bumps it on demand.
- The proxy no longer sends signed-in users from `/login` to `/`. With
  revocation that would have looped forever, since a revoked token still has a
  valid signature.

**Verified:**
- `src/lib/dal.test.ts` and the integration test "changing the password revokes
  stolen sessions": the stolen cookie gets a redirect to `/login`.
- In the browser, a second signed-in device ends up on `/login`, with no
  redirect loop.

---

## Medium

### M1. Anyone can lock the therapist out

The throttle is global, not per IP: there is one account, and per-IP limits
are bypassed by rotating addresses. As a consequence, anyone who knows the
URL can send 5 wrong passwords every 15 minutes and keep the real user from
signing in:

```bash
for i in 1 2 3 4 5; do curl -s … -F '1_password=x'; done   # repeat every 15 min
```

**Mitigations already in place:**
- Devices that are already signed in are not affected, because sessions last
  30 days.
- No data is exposed by this attack.

**Recommendation:** combine a per-IP limit with a higher global ceiling, or
move to Supabase Auth with per-user lockout and email recovery. Supabase Auth
is already on the roadmap.

### M2. Server Actions trusted their input

Server Actions are public HTTP endpoints. Anyone holding a session cookie can
call them with any payload, skipping the forms. The following were accepted
before the fix:

| Payload | Effect before the fix |
|---|---|
| `recoverSessions(["<id of a completed session>"])` | turned a worked session into "recovered", changing the hours |
| `createPatient({ name: "x".repeat(10_000_000) })` | stored arbitrarily large rows |
| `createTherapySession({ duration_minutes: 1e9 })` | absurd report totals |
| `updateSessionStatus(id, "programmata")` | only the database check constraint stopped it |
| `deletePatient("1 or 1=1")`, ids with `,` or `)` | went to PostgREST filters unvalidated (PostgREST quoted them, so no injection, but they were never checked) |
| `createPatient({ name: "Ada", id: "<chosen uuid>", created_at: "1970-…" })` | extra columns were passed straight to the insert |

**Fix:** `src/lib/validation.ts` is used by every action. It checks UUIDs, the
5 statuses, a duration of 1 to 480 minutes, valid dates, and length limits
(name and contact up to 120 characters, notes up to 2000), trims the text, and
keeps only the columns it expects. `recoverSessions` also filters on
`status in (absent, to_recover)`. The client now reports errors instead of
updating the screen as if the change had worked.

Tested in:
- `src/lib/validation.test.ts`
- `src/app/actions/data.test.ts`
- the integration tests
- the browser (a 130-character name is refused)

### M3. No security headers

Before the fix:
- the app could be framed by any site (clickjacking, e.g. a hidden iframe over
  "Delete patient");
- there was no CSP, no `nosniff` and no `Referrer-Policy`;
- `X-Powered-By: Next.js` was sent.

**Fix (`next.config.ts`):**
- CSP: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`;
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and HSTS;
- `poweredByHeader: false`.

`upgrade-insecure-requests` is deliberately left out, because it breaks
instances served over plain http on a LAN.

Checked on the production build: the headers are present, and there are no
CSP violations while browsing, exporting PDF/Excel or using dark mode.

### M4. Password change as an unthrottled oracle

`changePassword` checked the current password with no rate limit. A session
thief could use it to guess the real password at full speed, then keep access
after a password change. It now goes through the same atomic claim as sign-in.
Tested in `src/app/actions/auth.test.ts`.

### M5. `xlsx` 0.18.5

The npm registry only has SheetJS 0.18.5, which is affected by
CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS). Both are in
*parsing*, and the app only *writes* files, so they were not reachable here.
Even so, npm audit reported them as High.

**Fix:** upgraded to 0.20.3 from the official SheetJS CDN. After the upgrade,
`npm audit --omit=dev` reports no high or critical issues.

**Note:** Dependabot does not track packages installed from a tarball, so new
SheetJS releases have to be watched by hand.

---

## Low

- **L1. Over-fetching.** Every page receives every session ever recorded, so
  the full history sits in browser memory and in RSC payloads. The pages are
  served `no-store`. Load only the needed date range (see ARCHITECTURE_AUDIT §5.2).
- **L2. Settings page without a server check.** The page was a client
  component guarded only by the optimistic proxy. It holds no data, but it
  could be opened with a revoked token. It is now wrapped in a server
  component that calls `verifySession()`.
- **L3. Report file names.** Names like `../../etc/passwd` or `A/B: "C"?`
  ended up in download file names. `reportFileName()` now keeps only
  `[A-Za-z0-9_-]` and strips accents.
- **L4. Password minimum raised from 6 to 8 characters**, enforced on the
  server and shown in the form.
- **L5. `'unsafe-inline'` scripts.** The CSP needs it until every page uses
  nonces.
- **L6. Dev-only advisories.** `minimatch` (ReDoS) via typescript-eslint, and
  `deepmerge` via the shadcn CLI. These are build tools, not shipped to users.
  `shadcn` was moved to `devDependencies`.
- **L7. `X-Powered-By`** removed.

---

## Checked and not vulnerable

| Class | Why it is not exploitable | Evidence |
|---|---|---|
| SQL injection | No SQL is built by hand; PostgREST parameterises; ids are validated as UUIDs | integration test stores `Robert'); DROP TABLE sessions;--` verbatim |
| XSS | React escapes all text; no `dangerouslySetInnerHTML`/`innerHTML` anywhere; PDF text is not HTML | browser test: patient named `<script>alert(1)</script>` renders as text, no dialog |
| CSRF | Server Actions are POST-only and Next.js rejects mismatched `Origin`; cookie is `SameSite=Lax`, `HttpOnly`, `Secure` in production | — |
| Broken access control | Every page and action calls `verifySession()` (signature + epoch); proxy is only a first gate | `data.test.ts`: all 9 data actions reject an unauthenticated call before any query |
| Database exposure | Service role key only in `server-only` modules; RLS on, no policies | integration: anon key reads `[]` from all 3 tables, writes rejected |
| JWT attacks | `alg` pinned to HS256; `none` and HS512 rejected; expiry enforced | `session.test.ts` |
| Password storage | scrypt, 16-byte random salt, timing-safe comparison | `password.test.ts`, integration "never stores the password in clear" |
| Spreadsheet formula injection | SheetJS writes strings as type `s`, never formulas | `exportUtils.test.ts` (`=HYPERLINK(…)`, `@SUM`, `+1-1`) |
| Secrets in the repository | None in the tree or the git history; `.env*` ignored | history search |

## Test summary

| Suite | Command | Result |
|---|---|---|
| Unit (14 files) | `npm test` | **231 / 231 passed** |
| Integration, real Postgres + PostgREST (2 files) | `npm run test:integration` | **21 / 21 passed** |
| Browser smoke test on the production build | (local Playwright run) | **16 / 16 passed** |
| Lint / type check / build | `npm run lint`, `npx tsc --noEmit`, `npm run build` | clean |

Mutation checks: removing the epoch check, or the status filter in
`recoverSessions`, makes the corresponding tests fail.
