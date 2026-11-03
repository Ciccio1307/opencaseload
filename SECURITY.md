# Security

## Segnalare una vulnerabilità

Non aprire una issue pubblica. Scrivi in privato al maintainer indicando:

- versione o commit interessato
- passi per riprodurre il problema
- impatto stimato

Riceverai una risposta appena possibile; il fix verrà pubblicato insieme a un
avviso, se necessario.

## Note per chi ospita l'app

- Tieni `SUPABASE_SERVICE_ROLE_KEY` e `SESSION_SECRET` solo nelle variabili
  d'ambiente dell'host, mai nel repository.
- Cambia `APP_INITIAL_PASSWORD` al primo accesso dalle Impostazioni.
- Non disabilitare la Row Level Security: l'app usa la service role key lato
  server e non ha bisogno di policy pubbliche.
- Fai backup periodici del database e conserva i dati dei pazienti secondo le
  normative applicabili.
