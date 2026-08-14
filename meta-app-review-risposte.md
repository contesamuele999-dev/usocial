# uSocial — Risposte per la verifica app Meta

> Compilato dalle funzioni realmente presenti nel codice (`src/social/*`).
> ⚠️ = permesso senza codice corrispondente: NON richiederlo finché non è implementato, verrebbe rifiutato.

---

## COSA FA uSocial (contesto generale — utile da riusare in ogni descrizione)

uSocial è uno strumento di gestione e pubblicazione di contenuti social. L'utente collega i propri account professionali (Instagram Business/Creator e Pagina Facebook), compone un contenuto una sola volta (testo + immagini o video) e lo pubblica sui propri canali. L'app permette inoltre di avviare e terminare dirette video sulla propria Pagina Facebook. uSocial agisce sempre e solo sugli account di cui l'utente è titolare o amministratore, dopo consenso OAuth esplicito.

---

## pages_show_list

**Uso previsto:** All'atto della connessione, uSocial chiama `GET /me/accounts` per mostrare all'utente l'elenco delle Pagine Facebook che amministra, così che possa selezionare quella su cui pubblicare e a cui è collegato il suo account Instagram Business.

**Descrizione (da incollare):**
uSocial usa pages_show_list per recuperare l'elenco delle Pagine Facebook amministrate dall'utente subito dopo il login. L'utente seleziona la Pagina che vuole collegare; da quella Pagina l'app ottiene il Page access token necessario per pubblicare post e video e individua l'account Instagram Business associato. Senza questo permesso l'utente non potrebbe scegliere su quale Pagina operare.

**Screencast da mostrare:** login → schermata con la lista delle Pagine dell'utente → selezione di una Pagina → conferma di collegamento riuscito.

---

## pages_read_engagement

**Uso previsto:** Leggere i dati della Pagina selezionata (nome/identità Pagina) per confermare all'utente su quale Pagina sta pubblicando e verificare che il collegamento sia valido.

**Descrizione (da incollare):**
uSocial usa pages_read_engagement per leggere le informazioni della Pagina Facebook collegata (nome e identità della Pagina) e mostrarle nella schermata Impostazioni/Account, così l'utente conferma su quale Pagina l'app pubblicherà i suoi contenuti. Il dato viene usato per l'identificazione della Pagina all'interno dell'interfaccia, non per raccogliere metriche verso terzi.

**Screencast da mostrare:** schermata Account che mostra il nome della Pagina collegata e il suo stato "collegata/verificata".

> Nota Meta: richiede pages_show_list (che stai già richiedendo). ✅

---

## business_management

**Uso previsto:** Necessario per accedere agli asset (Pagine e account Instagram Business) gestiti tramite Business Manager e completare il collegamento account.

**Descrizione (da incollare):**
uSocial usa business_management per accedere agli asset business dell'utente — Pagine Facebook e account Instagram Business associati — durante la fase di collegamento dell'account. Questo consente all'app di individuare correttamente l'account Instagram Business collegato alla Pagina scelta e abilitare la pubblicazione dei contenuti. L'accesso è limitato agli asset di cui l'utente è titolare o amministratore.

**Screencast da mostrare:** flusso di collegamento in cui, scelta la Pagina, l'app individua e mostra l'account Instagram Business collegato.

---

## instagram_basic *(nel codice è questo, NON instagram_business_basic)*

**Uso previsto:** Identificare l'account Instagram Business (id, username) collegato alla Pagina e verificare la validità del token.

**Descrizione (da incollare):**
uSocial usa instagram_basic per leggere l'identità dell'account Instagram Business collegato (ID e username) e mostrarla all'utente come account di destinazione della pubblicazione. Lo stesso permesso serve a verificare periodicamente che il token dell'account sia ancora valido. È il prerequisito per la pubblicazione dei contenuti su Instagram.

**Screencast da mostrare:** schermata Account con lo username Instagram (@nomeutente) mostrato come account collegato.

---

## instagram_content_publish

**Uso previsto:** Pubblicare reel/video, immagini singole e caroselli sull'account Instagram Business dell'utente, tramite creazione di un media container e successiva `media_publish`.

**Descrizione (da incollare):**
uSocial usa instagram_content_publish per pubblicare i contenuti che l'utente crea nell'app direttamente sul proprio account Instagram Business. L'utente compone testo e allega uno o più media (immagine, video/reel o carosello); l'app crea il container tramite l'endpoint /media, attende l'elaborazione dei video e pubblica con /media_publish. La pubblicazione avviene solo su azione esplicita dell'utente e solo sul suo account.

**Screencast da mostrare:** composizione del post → allegato di un video/immagine → tap su "Pubblica" → post visibile sul profilo Instagram.

---

## pages_manage_posts *(usato dal modulo Facebook per pubblicare)*

**Uso previsto:** Pubblicare post di testo, foto, caroselli e video sulla Pagina Facebook dell'utente (`/{page}/feed`, `/photos`, `/videos`).

**Descrizione (da incollare):**
uSocial usa pages_manage_posts per pubblicare sulla Pagina Facebook collegata i contenuti creati dall'utente: post di solo testo, foto singole o multiple e video. La pubblicazione è sempre avviata manualmente dall'utente dalla schermata di composizione dell'app.

**Screencast da mostrare:** composizione → "Pubblica su Facebook" → post visibile sulla Pagina.

---

## publish_video

**Uso previsto:** Pubblicare video sulla Pagina Facebook dell'utente tramite `POST /{page-id}/videos`. È il permesso che Meta richiede specificamente per l'upload di video su Pagina (distinto da pages_manage_posts, che copre testo/foto/caroselli sul feed).

**Descrizione (da incollare):**
uSocial usa publish_video per pubblicare i video che l'utente carica nell'app sulla propria Pagina Facebook. Quando l'utente compone un contenuto con un video allegato e tocca "Pubblica", l'app carica il file sull'endpoint /{page-id}/videos della Pagina collegata usando il page access token. L'upload avviene sempre su azione esplicita dell'utente e solo sulla Pagina di cui è amministratore.

**Screencast da mostrare:** composizione → allegato di un file video → "Pubblica su Facebook" → video visibile sulla Pagina.

---

## Live Video API (Facebook Live)

**Uso previsto:** Creare e terminare una diretta video sulla Pagina dell'utente tramite `POST /{page}/live_videos` (status LIVE_NOW) e `end_live_video`. L'app restituisce URL di ingest RTMP + stream key e il link per gli spettatori.

**Descrizione (da incollare):**
uSocial è uno strumento di gestione dei contenuti social che consente all'utente di trasmettere dirette video sulla propria Pagina Facebook da una fonte diversa dalla fotocamera del telefono (es. software di encoding come OBS). Dopo aver effettuato l'accesso con Facebook Login e selezionato la Pagina che amministra, l'utente avvia una diretta dall'app: uSocial crea un live video sulla Pagina tramite l'endpoint POST /{page-id}/live_videos con stato LIVE_NOW e riceve l'URL di ingest RTMP e la stream key, che l'utente usa nel proprio encoder per trasmettere il flusso video. L'app mostra anche il link pubblico della diretta per gli spettatori. Al termine, l'utente ferma la diretta dall'app e uSocial chiama end_live_video per chiuderla. Questa funzione migliora l'esperienza permettendo all'utente di gestire dirette professionali di alta qualità direttamente dal proprio flusso di lavoro, senza usare la fotocamera del dispositivo mobile. Tutte le dirette avvengono esclusivamente sulla Pagina di cui l'utente è amministratore e solo su sua azione esplicita, dopo consenso OAuth.

**Screencast da mostrare:** avvio diretta dall'app → generazione RTMP/stream key → diretta attiva sulla Pagina → stop diretta dall'app.

---

## public_profile

**Descrizione (da incollare):**
uSocial usa public_profile per identificare l'utente autenticato (nome e ID) al momento del login con Facebook, così da associare la sessione al suo account e mostrare il profilo collegato. È il permesso base del Facebook Login.

*(public_profile richiede solo l'accettazione della conformità, non lo screencast.)*

---

# ⚠️ PERMESSI DA NON RICHIEDERE (nessun codice corrispondente → rifiuto certo)

- **instagram_business_basic** — l'app usa `instagram_basic` (Graph API con Facebook Login), non il flusso Instagram Login diretto. Richiedi instagram_basic.
- **instagram_business_manage_messages** — nessuna gestione di DM Instagram nel codice.
- **instagram_manage_comments** — nessuna lettura/risposta ai commenti nel codice.
**Consiglio:** rimuovi questi 4 permessi dalla richiesta di verifica. Aggiungili in una richiesta futura solo dopo aver implementato le rispettive funzioni (gestione commenti, DM, ecc.), altrimenti l'intera submission rischia di essere respinta.
