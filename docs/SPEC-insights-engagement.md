# Specifica — Statistiche, orari migliori, commenti e risposte automatiche

Documento di lavoro: prende l'idea iniziale ("statistiche di tutti i social, calendario coi
momenti migliori, API per i commenti, risposte automatiche") e la trasforma in una richiesta
implementabile, con i vincoli reali delle piattaforme già verificati.

Da usare come prompt per l'implementazione, una fase alla volta.

---

## Contesto tecnico (già vero nel progetto)

- Next.js 15 (App Router) + SQLite (better-sqlite3) + TypeScript, tutto self-hosted.
- Un modulo per piattaforma in `src/social/<nome>/index.ts` che implementa `SocialModule`;
  registro in `src/social/registry.ts`. Ogni funzionalità nuova va aggiunta al contratto del
  modulo, mai con `if (platform === "instagram")` sparsi nelle pagine.
- Accesso al DB solo da `src/lib/repo.ts`. Ogni riga è legata a `user_id`.
- Lavori periodici in `src/lib/scheduler.ts` (tick 60 s per le pubblicazioni, tick orario per
  i token).
- La VM di produzione ha **1 GB di RAM e ~6 GB di disco liberi**: niente job che tengono in
  memoria interi dataset, niente dipendenze pesanti.
- Le API sono già usabili da agenti IA via `Authorization: Bearer usk_…` e via MCP
  (`scripts/mcp-server.mjs`): ogni cosa nuova deve essere esposta lì.

## Vincoli delle piattaforme (verificare prima di promettere una funzione)

| Cosa | Instagram | Facebook (Pagina) | YouTube | TikTok | LinkedIn |
|---|---|---|---|---|---|
| Metriche | `/{ig-user}/insights`, `/{ig-media}/insights` | `/{page}/insights` | YouTube Analytics API (scope `yt-analytics.readonly`) | metriche video via Display API (scope dedicato) | solo **pagine aziendali** (`r_organization_social`); profili personali: nessuna API |
| Commenti | lettura + risposta (`instagram_manage_comments`) | lettura + risposta (`pages_manage_engagement`) | `commentThreads` (scope `youtube.force-ssl`) | API commenti limitata, richiede approvazione | commenti su post di pagina aziendale |
| Orario migliore | **nessuna API lo fornisce** su nessuna piattaforma |

Conseguenze da accettare nel progetto:

1. L'orario migliore va **calcolato dai propri dati storici**. Prima di avere ~4 settimane di
   pubblicazioni misurate, la funzione non ha nulla da dire: va mostrato esplicitamente
   ("dati insufficienti"), non inventato.
2. Ogni scope nuovo richiede una **nuova autorizzazione dell'account** (e per Meta anche una
   nuova App Review). Va previsto un avviso in Impostazioni: "per le statistiche riconnetti
   l'account".
3. LinkedIn personale e TikTok non approvato resteranno **senza** metriche e commenti: la UI
   deve dirlo, non mostrare zeri.

---

## Fase 1 — Raccolta metriche

**Obiettivo**: sapere come è andato ogni post pubblicato, senza aprire cinque app.

- Estendere `SocialModule` con `fetchMetrics?(target, account): Promise<MetricSet>` dove
  `MetricSet = { impressions?, reach?, likes?, comments?, shares?, saves?, views?, watchTime? }`.
  Chi non può implementarla non la implementa: la UI mostra "non disponibile".
- Nuova tabella `post_metrics(target_id, fetched_at, metrics JSON)`: uno snapshot per
  rilevazione, così si vede anche l'andamento nel tempo. Mai sovrascrivere.
- Job nello scheduler: raccolta a +1 h, +24 h, +7 giorni dalla pubblicazione, poi stop.
  Niente polling continuo (rate limit e RAM).
- Pagina **Statistiche**: tabella dei post pubblicati con le metriche disponibili, filtro per
  piattaforma e periodo, ordinamento per engagement. Un solo grafico, non una dashboard.
- API: `GET /api/metrics?from=&to=&platform=` + tool MCP `usocial_metrics`.

**Fatto quando**: dopo una pubblicazione reale, la pagina mostra i numeri di quel post e li
riaggiorna il giorno dopo senza intervento manuale.

## Fase 2 — Orari migliori, dentro al calendario

**Obiettivo**: mentre programmo, vedere quando conviene pubblicare — senza cambiare pagina.

- Calcolo lato server da `post_metrics`: engagement medio per (piattaforma, giorno della
  settimana, fascia oraria di 2 h), normalizzato sul numero di post di quella fascia.
  Serve un minimo di **5 post per fascia**, altrimenti la fascia è "dati insufficienti".
- `GET /api/best-times?platform=` → griglia 7×12 con punteggio 0-100 e numero di campioni.
- Nel **calendario**: sfondo delle celle colorato in base al punteggio della piattaforma
  filtrata, legenda, e filtri già presenti nella pagina (piattaforma, stato) estesi con
  "mostra orari migliori". Nessuna pagina nuova.
- Fallback onesto quando i dati mancano: mostrare medie di settore **etichettate come tali**,
  oppure niente. Mai spacciare un'euristica per un dato misurato.

**Fatto quando**: con dati sufficienti il calendario evidenzia le fasce buone; con pochi dati
dice chiaramente che non ne ha abbastanza.

## Fase 3 — Commenti e risposte

**Obiettivo**: leggere e rispondere ai commenti di tutte le piattaforme da un posto solo.

- `SocialModule`: `listComments?(target, account)`, `replyComment?(commentId, text, account)`,
  `hideComment?` / `deleteComment?` dove supportati.
- Tabella `comments(id, user_id, target_id, platform, external_id, parent_id, author, text,
  created_at, replied_at, hidden)`; sincronizzazione incrementale nello scheduler (ogni
  15 min sui post degli ultimi 7 giorni, poi ogni ora fino a 30 giorni).
- Pagina **Inbox**: elenco unificato ordinato per data, filtri per piattaforma e "non
  risposti", risposta inline. Contatore dei non letti nella sidebar.
- API + tool MCP: `usocial_list_comments`, `usocial_reply_comment` — così un agente IA può
  proporre le risposte.

**Fatto quando**: un commento lasciato su un post reale compare nell'Inbox entro 15 minuti e
la risposta inviata da uSocial appare sulla piattaforma.

## Fase 4 — Risposte automatiche (con freno a mano)

**Obiettivo**: rispondere in automatico ai commenti ripetitivi, senza figuracce.

- Tabella `autoreply_rules(id, user_id, platform|null, match_type ['keyword'|'regex'|'any'],
  pattern, response_template, use_ai, mode ['draft'|'auto'], active)`.
- Due modalità, con `draft` come **predefinita**: la risposta viene preparata e messa in coda
  per l'approvazione; `auto` invia da sola.
- Limiti obbligatori, non opzionali: massimo N risposte l'ora per piattaforma, mai due
  risposte allo stesso autore nella stessa giornata, mai rispondere a un commento già
  risposto, stop automatico se la piattaforma restituisce errori ripetuti.
- Con `use_ai`: la risposta la genera il provider AI già configurato, con il testo del post
  come contesto. Ogni risposta automatica va registrata nei log con la regola che l'ha
  scatenata.
- Le piattaforme trattano le risposte massive come spam: prevedere un interruttore globale
  "sospendi tutte le risposte automatiche".

**Fatto quando**: una regola in modalità bozza produce risposte sensate per una settimana
prima che si consideri di attivare `auto`.

---

## Cosa NON fare

- Non aggiungere una dipendenza per i grafici finché un `<svg>` scritto a mano basta.
- Non costruire una dashboard "completa": servono i numeri che cambiano una decisione
  (quando pubblicare, cosa ha funzionato), non tutte le metriche esistenti.
- Non promettere in UI metriche o commenti per piattaforme che non li espongono.
- Non far girare i job di raccolta insieme alla pubblicazione: la VM ha 1 GB di RAM.

## Ordine consigliato

Fase 1 → Fase 3 → Fase 2 → Fase 4. Le metriche servono a tutto il resto; i commenti danno
valore subito; gli orari migliori hanno senso solo con settimane di storico; le risposte
automatiche sono le più rischiose e vanno per ultime.
