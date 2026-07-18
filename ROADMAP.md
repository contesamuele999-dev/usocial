# 🗺️ Roadmap uSocial

## ✅ Fase 1 — Fondamenta (fatta)
- Architettura modulare (un modulo per piattaforma + provider AI sostituibili)
- Database SQLite + repository + logging centralizzato
- CRUD post, bozze, programmazione con scheduler integrato
- Dashboard, editor completo (emoji, hashtag, media, piattaforme)
- Calendario mensile con drag & drop, duplicazione e filtro piattaforma
- Libreria media (upload, ricerca, tag, cartelle, anteprima)
- Cronologia pubblicazioni + log errori API
- OAuth per le 5 piattaforme + pubblicazione via API ufficiali
- AI: adatta/accorcia/allunga/titoli/hashtag/CTA/articolo LinkedIn/descrizione YouTube
- Docker + Docker Compose + test Vitest

## ✅ Fase 1.5 — Multi-utente + login (fatta)
- Autenticazione email + password (hashing scrypt) con sessioni su DB (cookie httpOnly)
- Pagine `/login` e `/register` + logout; middleware che protegge tutte le rotte
- Ogni entità (post, media, account social, impostazioni AI, log) collegata all'utente:
  isolamento completo dei dati fra utenti
- Account social **per-utente**: ognuno collega i propri da Impostazioni → Connetti
  (OAuth spostato su `/api/connect/:platform`, l'account si lega all'utente in sessione)
- Migrazione automatica del DB single-user → multi-utente
- Flag `ALLOW_REGISTRATION` per chiudere le registrazioni dopo il setup
- Guida `SETUP_API.md` passo-passo per collegare i social nel modo più semplice
- Nuovi test: hashing/verifica password

## 🔜 Fase 2 — Robustezza pubblicazione
- [x] **Retry automatico con backoff** per i target falliti — fino a 5 tentativi con
  attesa crescente (1→5→15→60 min); lo scheduler li ritenta da solo. Stato "riprova
  alle HH:MM" visibile in editor e cronologia. (`publisher.ts`, `scheduler.ts`)
- [x] **Coda di pubblicazione persistente** — la coda È il database: al riavvio i target
  rimasti "publishing" (interrotti da un crash) vengono recuperati e rimessi in coda
  per un nuovo tentativo. (`recoverInterruptedTargets`)
- [x] **Guardia media in uso** — un media usato da un post ancora in coda (bozza/programmato)
  non si cancella per sbaglio: serve conferma esplicita (409 → force). Così i post
  programmati trovano sempre i loro media al momento della pubblicazione.
- [ ] Anteprima realistica del post per piattaforma nell'editor
- [ ] Prima immagine come thumbnail YouTube (upload thumbnail)
- [ ] Supporto Stories/Reels come formato distinto per Instagram e Facebook

## 🔮 Fase 3 — Qualità della vita
- [ ] Import backup JSON (ripristino completo)
- [ ] Storage S3-compatibile come alternativa al filesystem
- [ ] Notifiche (email/Telegram) su pubblicazione riuscita/fallita
- [ ] Statistiche di base post-pubblicazione (like/view via API dove disponibile)
- [ ] Template di post riutilizzabili
- [ ] Ricerca full-text nei post
- [ ] Reset password via email + ruolo amministratore (gestione utenti)
- [ ] Più account social della stessa piattaforma per utente (es. 2 pagine Facebook)

## 💡 Idee future
- [ ] Nuove piattaforme: Threads, X/Twitter, Mastodon, Bluesky, Pinterest (basta un modulo)
- [ ] Generazione immagini AI per i post
- [ ] Suggerimento automatico del miglior orario di pubblicazione
- [ ] PWA per uso comodo da mobile
