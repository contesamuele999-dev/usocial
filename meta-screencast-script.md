# uSocial — Screencast per la verifica Meta (secondo invio)

## COSA HA DETTO META (feedback del 12 agosto 2026)

Approvati: Live Video API, public_profile. Bocciati tutti gli altri sette, **tutti per lo stesso
motivo**: *"Screencast non in linea con i dettagli del caso d'uso"*. Il caso d'uso è consentito:
il problema è **solo il video**. Meta chiede, per ogni permesso:

1. il **flusso completo di Meta Login**;
2. l'utente che **concede** il permesso;
3. l'**esperienza end-to-end** del caso d'uso descritto nelle note;
4. **interfaccia in inglese**, con **sottotitoli e tooltip** che spiegano pulsanti ed elementi;
5. (non ci riguarda) segnalare se l'app è server-to-server o usa un token di sistema.

In più, "non in linea con i dettagli" vuol dire che il video deve mostrare **quello che c'è scritto
nella descrizione**, né più né meno. Le descrizioni in `meta-app-review-risposte.md` ora citano
solo cose che si vedono nei video qui sotto: se cambi un video, cambia anche la descrizione.

Da qui la scelta: **un video per permesso**, tutto in inglese.

---

## PRIMA DI TUTTO: sistemare la richiesta

- [ ] **Rimettere nella richiesta** i sette permessi bocciati: `pages_show_list`, `pages_read_engagement`,
      `pages_manage_posts`, `publish_video`, `instagram_basic`, `instagram_content_publish`,
      `business_management`. I permessi nuovi dipendono da loro: senza, vengono bocciati anche quelli.
- [ ] Aggiungere `instagram_manage_comments` (il codice lo chiede, la richiesta no).
- [ ] Controllare che nel caso d'uso Threads ci sia `threads_basic`.
- [ ] Sulla VM: `META_SCOPE_MESSAGING=true` nel `.env`, riavviare. Senza, `pages_messaging`,
      `instagram_manage_messages` e `pages_manage_metadata` non compaiono nel consenso.
- [ ] Deploy della versione che chiede `pages_read_user_content` e `publish_video` e mostra il nome della Pagina senza la parola "Pagina".
- [ ] Ricollegare Facebook e controllare **"Edit access"**: ogni permesso deve avere la sua riga.
      Righe verificate il 13/09 (Facebook in inglese), con il permesso corrispondente.
      Nel video il cartello del punto 2 va su **questa** riga:
      - Access your Page and App insights → `read_insights`
      - Publish video to your timeline on your behalf → `publish_video`
      - Manage your business (1 Business selected) → `business_management`
      - Manage and access Page conversations in Messenger → `pages_messaging`
      - Create and manage content on your Page → `pages_manage_posts`
      - Manage comments on your Page → `pages_manage_engagement`
      - Read content posted on the Page → `pages_read_engagement`
      - Read user content on your Page → `pages_read_user_content`
      - Show a list of the Pages you manage → `pages_show_list`
- [ ] Nelle descrizioni incollare il testo **EN**.

## PREPARAZIONE (non va nel video)

- [ ] Account Facebook con ruolo admin/tester dell'app, **una sola** Pagina da selezionare, IG professionale collegato.
- [ ] **Secondo account** (FB + IG + Threads) che commenta e riceve i messaggi, con ruolo di tester nell'app.
- [ ] uSocial su https://usocial.duckdns.org, **Settings → Language → English**.
- [ ] Facebook stesso in inglese: facebook.com → Settings → Language → English (US). La finestra di consenso segue questa lingua.
- [ ] In uSocial **scollegare** Facebook, Instagram e Threads prima di ogni clip di login.
- [ ] Su facebook.com → Settings → Business integrations: **rimuovere uSocial**. Altrimenti Facebook salta
      la schermata dei permessi ("You previously logged in") e il punto 2 di Meta non si vede.
- [ ] Un'immagine JPEG e un .mp4 breve pronti.
- [ ] Una regola in **Auto replies** con parola chiave `GUIDE`, risposta pubblica e messaggio privato.
- [ ] Registratore a schermo intero, cursore visibile, barra degli indirizzi visibile.
- [ ] Un editor per i sottotitoli (CapCut, Clipchamp, DaVinci): servono cartelli sovrapposti e frecce.

---

## REGOLE PER OGNI VIDEO

1. **Login Meta completo, dall'inizio.** Finestra in incognito, uSocial → Settings → Connect →
   **pagina di accesso di Facebook** (email e password; se vuoi, sfoca il campo password in montaggio)
   → schermata dei permessi → **"Edit access"** per mostrare la scelta di Pagina e account →
   **Continue** → ritorno in uSocial collegato.
2. **Il permesso concesso si deve vedere.** Nella schermata di consenso fermati 3 secondi sulla riga
   del permesso di quel video, con un cartello: *"The user grants uSocial permission to …"*.
3. **Sottotitoli su ogni passaggio**, in inglese, che dicono cosa fa l'utente e cosa fa uSocial.
   **Tooltip/frecce sui pulsanti** la prima volta che compaiono: *"Publish now: sends the post to the
   selected channels right away"*.
4. **Chiudi con la prova fuori dall'app**: il risultato visto su facebook.com, instagram.com o threads.net.
5. Da 1 a 3 minuti. Nome file = nome del permesso (`pages_messaging.mp4`).

Le clip di login si registrano una volta per piattaforma e si mettono in testa a ogni video della
stessa piattaforma. Cambia solo il cartello del punto 2, che nomina il permesso di quel video.

### Clip di login

**A — Facebook**
1. *"uSocial lets a business publish to its Facebook Page. First the user connects the Page."*
2. uSocial → Settings → riga Facebook → **Connect** (tooltip: *"Connect: starts Facebook Login"*).
3. Pagina di accesso Facebook, login.
4. Schermata dei permessi: scorri l'elenco, **Edit access**, spunta la Pagina, **Continue**.
5. Ritorno in Settings: riga Facebook con *"Nome → Nome Pagina"*. Cartello: *"The Page is now connected."*

**B — Instagram**
1. *"The user connects the Instagram Business account linked to their Facebook Page."*
2. Settings → riga Instagram → **Connect**.
3. Login Facebook → permessi → **Edit access**: scelta della Pagina e dell'account Instagram → **Continue**.
4. Ritorno in Settings: riga Instagram con `@username`.

**C — Threads**
1. *"The user connects their Threads profile."*
2. Settings → riga Threads → **Connect**.
3. Login su threads.net → schermata dei permessi → **Allow**.
4. Ritorno in Settings: riga Threads con `@username`.

---

## I VIDEO

### Base dell'account

| # | Permesso | Login | Cosa mostrare dopo il login | Prova finale |
|---|---|---|---|---|
| 1 | `pages_show_list` | A | Rallenta su **Edit access**: *"uSocial lists the Pages this user manages; the user picks one"*. Poi Settings con la stessa Pagina | La Pagina su facebook.com ha lo stesso nome |
| 2 | `business_management` | B | In **Edit access**: *"uSocial reads the business assets of this user to find the Instagram account linked to the Page"*. Poi Settings: riga Facebook con la Pagina e riga Instagram con `@username` | In Meta Business Suite → Settings → Accounts: la stessa Pagina con lo stesso Instagram collegato |
| 3 | `pages_read_engagement` | A | Settings: nome della Pagina. Poi **Statistics → 🔄 Refresh from socials**: il post Facebook in classifica con interazioni e visualizzazioni. Tooltip su *Interact.*: *"likes, comments and shares read from the Page"* | Stessi like e commenti sotto il post su facebook.com |
| 4 | `instagram_basic` | B | Settings: riga Instagram con `@username`. *"uSocial reads the Instagram account ID and username to show where posts will be published"* | Profilo instagram.com con lo stesso username |

### Pubblicazione

| # | Permesso | Login | Cosa mostrare dopo il login | Prova finale |
|---|---|---|---|---|
| 5 | `pages_manage_posts` | A | **✍️ New Post** → testo + foto → spunta solo Facebook → **🚀 Publish now** → esito | Post con testo e foto sul feed della Pagina |
| 6 | `publish_video` | A | **✍️ New Post** → testo + file .mp4 → solo Facebook → **🚀 Publish now** | Video sulla Pagina, fai partire la riproduzione |
| 7 | `instagram_content_publish` | B | **✍️ New Post** → caption + foto → solo Instagram → **🚀 Publish now**. Poi un secondo post con un video (reel) | I due post sul profilo instagram.com |
| 8 | `threads_basic` | C | Settings: riga Threads con `@username`. *"uSocial reads the Threads profile ID and username"* | Profilo su threads.net |
| 9 | `threads_content_publish` | C | **✍️ New Post** → testo + immagine → solo Threads → **🚀 Publish now** | Post su threads.net |

### Commenti e messaggi

Prima di registrare: con il **secondo account** commenta `GUIDE` sotto un post pubblicato da uSocial
(uno su Facebook, uno su Instagram, uno su Threads). Nel video mostra anche la regola: apri la regola,
tooltip su *Keyword in the comment*, *Public reply under the comment*, *Private message*.

| # | Permesso | Login | Cosa mostrare dopo il login | Prova finale |
|---|---|---|---|---|
| 10 | `pages_read_user_content` | A | Il commento del secondo account su facebook.com → uSocial **Auto replies → 🧪 Dry run**: l'anteprima mostra quel commento **con il nome dell'autore**. Tooltip: *"Dry run: shows what would be sent, sends nothing"* | – (il commento è mostrato all'inizio) |
| 11 | `pages_manage_engagement` | A | **Auto replies** → la regola → **▶️ Run now** → esito *handled* | Risposta della Pagina sotto il commento su facebook.com |
| 12 | `pages_messaging` | A | Come l'11, cartello sul contatore *private messages* | **Accedi come secondo account**: messaggio della Pagina su Messenger |
| 13 | `instagram_manage_comments` | B | **🧪 Dry run** (commento IG con autore) → **▶️ Run now** | Risposta sotto il commento su Instagram |
| 14 | `instagram_manage_messages` | B | Come il 13, cartello sul contatore *private messages* | **Secondo account**: DM ricevuto su Instagram |
| 15 | `pages_manage_metadata` | B | Stesso filmato del 14, con il cartello: *"Meta requires pages_manage_metadata, with the messaging permissions, to send this private reply through the linked Page"* | DM ricevuto |
| 16 | `threads_manage_replies` | C | **🧪 Dry run** (risposta Threads con autore) → **▶️ Run now** | Risposta sotto il post su threads.net |

### Statistiche

La pagina Statistics mostra **visualizzazioni** e **interazioni** (like, commenti, condivisioni,
salvataggi sommati), per piattaforma e per post. Le descrizioni citano solo questi numeri.

| # | Permesso | Login | Cosa mostrare dopo il login | Prova finale |
|---|---|---|---|---|
| 17 | `read_insights` | A | **Statistics → 🔄 Refresh from socials** → riga Facebook, colonna *Views* e il post in classifica. Tooltip: *"Views: impressions read from Page Insights"* | Stesso post in Meta Business Suite → Insights |
| 18 | `instagram_manage_insights` | B | **Statistics → 🔄 Refresh from socials** → riga Instagram, *Views* e *Interact.*, e il post in classifica | *View insights* del post nell'app Instagram |
| 19 | `threads_manage_insights` | C | **Statistics → 🔄 Refresh from socials** → riga Threads, *Views* e *Interact.* | Contatori del post su threads.net |

`public_profile` e **Live Video API** sono già approvati e vanno solo rinnovati: nessun video nuovo.

---

## ERRORI CHE FANNO RESPINGERE

- Video che parte già collegato, senza la pagina di accesso di Facebook e la schermata dei permessi.
- Facebook che salta i permessi perché l'app era già autorizzata (rimuovila da *Business integrations*).
- Interfaccia di uSocial o di Facebook in italiano.
- Pulsanti cliccati senza didascalia che dica a cosa servono.
- Solo la conferma dentro uSocial, senza aprire FB/IG/Threads.
- Nel video manca qualcosa che la descrizione promette (tipi di post, metriche, programmazione).
- Commento e messaggio fatti dallo **stesso** account della Pagina.
- Video lunghi con più permessi mescolati.
