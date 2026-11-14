#!/usr/bin/env node
/**
 * Generates the test dataset: invented patients and sessions, deterministic
 * (fixed seed), full of edge cases. Writes:
 *
 *   src/test/fixtures/dataset.json   used by the unit/integration tests
 *   supabase/seed/test-data.sql      loads the same data into a database
 *
 * Every person here is invented. Never put real patient data in fixtures.
 *
 *   node scripts/generate-test-data.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Small deterministic PRNG (mulberry32): same output on every run.
let seed = 20261114;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = list => list[Math.floor(rand() * list.length)];
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
// aaaaaaaa-… are patients, bbbbbbbb-… sessions: easy to spot in a database.

// ---------------------------------------------------------------- patients
const edgeCasePatients = [
  { name: "Aoife O'Connor", parent_contact: '+353 87 000 0001', notes: 'Apostrophe in the name (SQL quoting).' },
  { name: 'Niccolò Ğür-Ñúñez', parent_contact: 'mamma.niccolo@example.invalid', notes: 'Accents and non-Latin letters.' },
  { name: 'محمد الأحمد', parent_contact: '', notes: 'Right-to-left script, no contact.' },
  { name: '李小龙', parent_contact: '+86 000 0000 0000', notes: 'CJK characters.' },
  { name: 'Zoë 🌈 Smith', parent_contact: '07000 000003', notes: 'Emoji (astral plane, surrogate pairs).' },
  { name: '<script>alert(1)</script>', parent_contact: '"><img src=x onerror=alert(1)>', notes: 'XSS payloads must render as text.' },
  { name: '=HYPERLINK("http://evil.invalid","x")', parent_contact: '+1-000', notes: '@SUM(1+1)*cmd|/C calc!A0' },
  { name: "Robert'); DROP TABLE patients;--", parent_contact: "' OR '1'='1", notes: 'SQL injection strings stored verbatim.' },
  { name: 'A'.repeat(120), parent_contact: '9'.repeat(120), notes: 'N'.repeat(2000) },
  { name: 'X', parent_contact: '', notes: '' },
  { name: 'Line\nBreak  Tabs\tName', parent_contact: 'multi\nline', notes: 'First line\nSecond line\r\nThird line' },
  { name: '../../etc/passwd', parent_contact: 'C:\\Windows\\system32', notes: 'Path characters (export file names).' },
  { name: 'NULL', parent_contact: 'undefined', notes: 'null' },
  { name: '%_\\ wildcard', parent_contact: '*', notes: 'LIKE wildcards.' },
];

const first = ['Ada', 'Bea', 'Carlo', 'Dario', 'Elena', 'Filippo', 'Giulia', 'Hana', 'Ivo', 'Jade', 'Kai', 'Luca', 'Mia', 'Noah'];
const last = ['Rossi', 'Bianchi', 'Verdi', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno'];

const patients = [
  ...edgeCasePatients,
  ...Array.from({ length: 16 }, () => ({
    name: `${pick(first)} ${pick(last)}`,
    parent_contact: `+39 3${Math.floor(rand() * 1e8).toString().padStart(8, '0')}`,
    notes: rand() < 0.5 ? '' : pick(['Speech therapy', 'Fine motor skills', 'Twice a week', 'Prefers afternoons']),
  })),
].map((p, i) => ({
  id: uuid('aaaaaaaa', i + 1),
  ...p,
  created_at: new Date(Date.UTC(2025, 8, 1) + i * 86400000).toISOString(),
}));

// ---------------------------------------------------------------- sessions
// Edge-case instants (UTC) chosen against Europe/Rome, the zone the tests use.
const edgeInstants = [
  ['2026-03-28T22:30:00.000Z', 'Night before spring DST change'],
  ['2026-03-29T01:30:00.000Z', '03:30 Rome, just after the clocks go forward'],
  ['2026-10-25T00:30:00.000Z', '02:30 Rome, first pass of the repeated hour'],
  ['2026-10-25T01:30:00.000Z', '02:30 Rome, second pass of the repeated hour'],
  ['2026-10-31T23:30:00.000Z', '00:30 on 1 Nov in Rome, 31 Oct in UTC'],
  ['2026-12-31T23:30:00.000Z', 'New Year in Rome, still 2026 in UTC'],
  ['2028-02-29T10:00:00.000Z', 'Leap day'],
  ['2026-11-08T23:00:00.000Z', 'Exactly midnight in Rome'],
  ['2026-11-08T22:59:00.000Z', '23:59 in Rome'],
];

const statuses = ['scheduled', 'completed', 'absent', 'to_recover', 'recovered'];
const sessions = [];
let n = 0;
const add = (patient, date, duration, status, notes = '') =>
  sessions.push({ id: uuid('bbbbbbbb', ++n), patient_id: patient.id, date, duration_minutes: duration, status, notes });

edgeInstants.forEach(([date, notes], i) => add(patients[i % patients.length], date, 60, statuses[i % 5], notes));

// Extreme durations.
add(patients[0], '2026-11-02T08:00:00.000Z', 1, 'completed', 'Shortest session');
add(patients[1], '2026-11-02T08:00:00.000Z', 480, 'completed', 'Longest session (8 h)');

// A group session: three patients in the same slot, one absent.
for (const [i, status] of [[14, 'completed'], [15, 'completed'], [16, 'absent']]) {
  add(patients[i], '2026-11-09T14:00:00.000Z', 45, status, 'Group session');
}

// Notes with special characters.
add(patients[5], '2026-11-03T09:00:00.000Z', 60, 'completed', '<b>bold?</b> & "quotes" \'single\' `ticks`');
add(patients[6], '2026-11-03T10:00:00.000Z', 60, 'absent', '=1+1');

// Regular sessions spread over Sep–Dec 2026, on the half hour.
while (sessions.length < 120) {
  const day = Date.UTC(2026, 8, 1) + Math.floor(rand() * 120) * 86400000;
  const hour = 7 + Math.floor(rand() * 11);
  const date = new Date(day + hour * 3600000 + (rand() < 0.5 ? 0 : 1800000)).toISOString();
  add(pick(patients), date, pick([30, 45, 60, 60, 90]), pick(statuses));
}

// ---------------------------------------------------------------- output
writeFileSync(`${root}src/test/fixtures/dataset.json`, JSON.stringify({ patients, sessions }, null, 2) + '\n');

const q = v => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const insert = (table, rows, cols) =>
  `insert into public.${table} (${cols.join(', ')}) values\n` +
  rows.map(r => `  (${cols.map(c => q(r[c])).join(', ')})`).join(',\n') +
  ';\n';

writeFileSync(
  `${root}supabase/seed/test-data.sql`,
  `-- Invented test data (${patients.length} patients, ${sessions.length} sessions).
-- Generated by scripts/generate-test-data.mjs: do not edit by hand.
-- For local/test databases only: never load it into a real practice.
begin;
${insert('patients', patients, ['id', 'name', 'parent_contact', 'notes', 'created_at'])}
${insert('sessions', sessions, ['id', 'patient_id', 'date', 'duration_minutes', 'status', 'notes'])}commit;
`
);

console.log(`Wrote ${patients.length} patients and ${sessions.length} sessions.`);
