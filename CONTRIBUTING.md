# Contributing

Grazie per l'interesse! Questo progetto è piccolo e volutamente semplice: le
contribuzioni più utili sono bug fix, test e miglioramenti alla documentazione.

## Setup locale

1. Crea un progetto Supabase e esegui `supabase/schema.sql` nel SQL Editor.
2. `cp .env.example .env.local` e compila i valori.
3. `npm install && npm run dev`.

## Prima di aprire una pull request

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- Mantieni le modifiche piccole e con un solo scopo.
- Scrivi i messaggi di commit in forma imperativa (es. `Fix month filter in
  patient export`).
- Non inserire dati reali di pazienti: usa dati inventati.
- Per modifiche grandi, apri prima una issue per discuterne.

## Segnalazioni

Quando apri una issue, non includere nomi, contatti o altri dati personali.
Per problemi di sicurezza usa le indicazioni in `SECURITY.md`.
