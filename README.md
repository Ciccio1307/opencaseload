<div align="center">

# 🗓️ Sedute

**L'agenda di chi lavora con le persone.**

Pazienti, sedute, ore da recuperare e resoconti mensili.
Tutto in un posto, sul telefono, senza fogli di calcolo sparsi.

[![License: MIT](https://img.shields.io/badge/Licenza-MIT-7c1034?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![PRs welcome](https://img.shields.io/badge/PR-benvenute-ff7a59?style=for-the-badge)](#-contribuire)

</div>

---

## 👋 Perché Sedute

Chi fa terapia — logopedisti, psicologi, fisioterapisti, educatori — passa le
giornate tra sedute, spostamenti e genitori da richiamare. Il foglio ore, però,
spesso resta un quaderno o un file Excel che si aggiorna la sera, di fretta.

**Sedute** nasce per togliere quel peso: un'app che sta nella tasca, si installa
sulla home del telefono e risponde a una domanda sola — *quante ore ho fatto, e
quante ne devo ancora recuperare?*

È pensata per essere **tua**: la installi sul tuo spazio, i dati restano tuoi, e
nessuno ti chiede un abbonamento.

> Progetto piccolo e in evoluzione (v0.1). Se ti serve qualcosa che manca,
> [apri una issue](../../issues/new): è il modo migliore per farlo crescere.

## ✨ Cosa sa fare

| | |
| :-- | :-- |
| 📅 **Agenda di oggi** | Le sedute del giorno in ordine di orario, con un tocco per segnare *presente* o *assente*. |
| 👥 **Pazienti** | Contatti, note e ore totali per ogni persona che segui. |
| 🔁 **Recuperi** | Le assenze diventano un monte ore per paziente: sai sempre chi ti deve delle ore. |
| 📄 **Resoconti** | PDF o Excel del mese, pronti da inviare o archiviare. |
| 📱 **PWA** | Si aggiunge alla schermata Home e si apre come un'app vera. |
| 🔒 **A prova di sguardo** | Accesso con password, sessione firmata, dati letti solo dal server. |
| 🎨 **Un po' tuo** | Nome, saluto e colori si cambiano dalle variabili d'ambiente. |

## 🚀 In cinque minuti

Ti servono [Node 20+](https://nodejs.org) e un progetto
[Supabase](https://supabase.com) gratuito.

**1. Prepara il database**

Nel SQL Editor di Supabase esegui una volta
[`supabase/schema.sql`](supabase/schema.sql): crea le tabelle e attiva la Row
Level Security.

**2. Configura l'ambiente**

```bash
cp .env.example .env.local
```

| Variabile | Obbligatoria | A cosa serve |
| :-- | :--: | :-- |
| `SUPABASE_URL` | ✅ | URL del progetto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Chiave service role (solo server) |
| `SESSION_SECRET` | ✅ | Stringa casuale per firmare i cookie (`openssl rand -base64 32`) |
| `APP_INITIAL_PASSWORD` | primo avvio | Password finché non la cambi dalle Impostazioni |
| `NEXT_PUBLIC_APP_NAME` | — | Nome dell'app (default `Sedute`) |
| `NEXT_PUBLIC_APP_SHORT_NAME` | — | Nome breve per l'icona sulla Home |
| `NEXT_PUBLIC_APP_DESCRIPTION` | — | Descrizione per manifest e SEO |
| `NEXT_PUBLIC_THERAPIST_NAME` | — | Il tuo nome, mostrato nel saluto |

**3. Avvia**

```bash
npm install
npm run dev
```

Apri <http://localhost:3000>, entra con `APP_INITIAL_PASSWORD` e cambiala subito
da **Impostazioni**. Fatto.

## ☁️ Metterla online

**Netlify** è la strada più corta: importa il repository, aggiungi le variabili
d'ambiente e pubblica. `netlify.toml` è già pronto e il runtime Next.js viene
rilevato in automatico.

Va bene anche qualsiasi host Node: `npm run build && npm start`.

> Le variabili `NEXT_PUBLIC_*` vengono lette in fase di build: se le cambi,
> serve un nuovo deploy.

## 🔐 Privacy, detta semplice

Sedute conserva nomi e contatti di persone reali, spesso minori. Per questo:

- **Chi installa l'istanza è il titolare del trattamento.** Il maintainer non
  gestisce un servizio hosted e non vede i tuoi dati.
- Il database non è raggiungibile dal browser: l'app parla con Supabase solo dal
  server, con la service role key.
- La Row Level Security è attiva e senza policy pubbliche: la chiave anon non
  può leggere nulla.
- Per screenshot, demo e bug report usa **solo dati inventati**.

Fai backup regolari e conserva i dati secondo le normative che ti riguardano
(GDPR in Italia).

## 🎨 Personalizzala

Tutto il branding vive in [`src/lib/branding.ts`](src/lib/branding.ts) e arriva
da variabili d'ambiente: non serve toccare i componenti per cambiare nome o
saluto. I colori sono variabili CSS in
[`src/app/globals.css`](src/app/globals.css): il tema bordeaux è solo il punto
di partenza.

## 🧱 Come è fatta

```
src/
  app/                 pagine, Server Component e Server Action
  components/          interfaccia (shadcn/ui + shell dell'app)
  lib/                 auth, sessione, Supabase, export, branding
  types/               tipi condivisi
supabase/schema.sql    schema del database
```

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript ·
Tailwind CSS v4 · shadcn/ui · Supabase (PostgreSQL) · jsPDF · SheetJS.

## 🗺️ Dove sta andando

- [ ] Flusso di stato esplicito: `programmata → completata | assente → recuperata`
- [ ] Escludere le assenze dai totali esportati
- [ ] Filtro mese corretto rispetto al fuso orario
- [ ] Supabase Auth con procedura guidata al primo avvio
- [ ] Limite ai tentativi di accesso
- [ ] Export CSV e sostituzione di `xlsx`
- [ ] Test automatici e CI
- [ ] Docker Compose per l'auto-hosting

Le priorità non sono scolpite nella pietra: se una ti interessa, dillo.

## 🤝 Contribuire

Che tu abbia trovato un bug, voglia tradurre l'interfaccia o aggiungere un
pezzo, sei benvenuto. Leggi [CONTRIBUTING.md](CONTRIBUTING.md): è corto.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Per problemi di sicurezza scrivi in privato, non aprire una issue pubblica:
vedi [SECURITY.md](SECURITY.md).

## 📄 Licenza

[MIT](LICENSE). Usala, modificala, ospitala: se ti è utile, una stella ⭐ fa
sempre piacere.

---

<details>
<summary><strong>🇬🇧 English</strong></summary>

**Sedute** is a self-hosted, mobile-first PWA for independent therapists:
patient list, daily agenda, no-show tracking, recovery hours and monthly
PDF/Excel reports.

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase.

```bash
# 1. run supabase/schema.sql in your Supabase project
cp .env.example .env.local   # fill in the values
npm install && npm run dev
```

Set `APP_INITIAL_PASSWORD`, log in, then change it from Settings. Whoever
deploys an instance is the data controller: the maintainer runs no hosted
service and never sees your data.

MIT licensed. Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

</details>
