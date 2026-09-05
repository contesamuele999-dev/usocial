# 🔌 Guida al setup delle API social (versione semplice)

Questa guida ti porta dal "l'app funziona ma non pubblica" a "pubblico davvero sui
social", nel modo più semplice possibile.

## Come funziona (in 30 secondi)

- **Tu (amministratore)** registri **una app developer per ogni social**, una volta
  sola. Ottieni due valori: **Client ID** e **Client Secret**. Li incolli nel file
  `.env` di uSocial.
- **Ogni utente** (anche tu) poi entra in uSocial → **Impostazioni → Connetti** e
  autorizza il **proprio** account. Non deve toccare nessuna chiave: fa tutto dal browser.
- Quindi: le chiavi nel `.env` sono dell'app, **non** del singolo account. Un solo set di
  chiavi serve tutti gli utenti.

## Passo 0 — L'URL pubblico (`APP_URL`)

I social devono poter reindirizzare al tuo sito dopo il login. In locale va bene
`http://localhost:3000` **per LinkedIn e YouTube**. Per **Instagram e Facebook** (che
oltre al redirect scaricano anche le immagini/video da un URL pubblico) ti serve un
indirizzo raggiungibile da internet. Il modo più semplice, gratis:

```bash
# in un terminale a parte, con l'app già avviata su :3000
npx cloudflared tunnel --url http://localhost:3000
```

Cloudflare ti dà un URL tipo `https://qualcosa.trycloudflare.com`. Mettilo in `.env`:

```
APP_URL=https://qualcosa.trycloudflare.com
```

Ogni **Redirect URI** qui sotto usa questo `APP_URL`. Il formato è sempre:
`{APP_URL}/api/connect/<piattaforma>/callback`

---

## LinkedIn (il più facile — inizia da qui)

1. Vai su https://developer.linkedin.com → **Create app**.
2. Collega una tua Pagina aziendale (richiesta da LinkedIn, anche una di prova).
3. Tab **Products** → aggiungi **"Sign In with LinkedIn using OpenID Connect"** e
   **"Share on LinkedIn"**.
4. Tab **Auth**:
   - copia **Client ID** e **Client Secret** → in `.env`: `LINKEDIN_CLIENT_ID`,
     `LINKEDIN_CLIENT_SECRET`;
   - in **Authorized redirect URLs** aggiungi: `{APP_URL}/api/connect/linkedin/callback`
5. Salva, riavvia uSocial, poi **Impostazioni → Connetti** su LinkedIn.

## YouTube (Google)

1. https://console.cloud.google.com → crea un progetto.
2. **API e servizi → Libreria** → abilita **YouTube Data API v3**.
3. **Schermata consenso OAuth** → tipo *Esterno* → compila i campi minimi → in
   **Utenti di test** aggiungi la tua email (finché l'app non è verificata).
4. **Credenziali → Crea credenziali → ID client OAuth → Applicazione web**:
   - **URI di reindirizzamento autorizzati**: `{APP_URL}/api/connect/youtube/callback`
   - copia **Client ID** e **Client Secret** → `.env`: `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`
5. Riavvia, poi **Connetti** su YouTube. (Carica video: serve un video nel post.)

## Facebook + Instagram (stessa app Meta)

Servono: una **Pagina Facebook** e, per Instagram, un account **Instagram
Business/Creator** collegato a quella Pagina.

1. https://developers.facebook.com → **Le mie app → Crea app** → tipo **Business**.
2. Aggiungi il prodotto **Facebook Login**.
3. **Impostazioni → Base**: copia **ID app** e **Chiave segreta** → `.env`:
   `META_CLIENT_ID`, `META_CLIENT_SECRET` (valgono sia per Facebook che per Instagram).
4. **Facebook Login → Impostazioni → URI di reindirizzamento OAuth validi**, aggiungi
   entrambi:
   - `{APP_URL}/api/connect/facebook/callback`
   - `{APP_URL}/api/connect/instagram/callback`
5. Riavvia. **Impostazioni → Connetti** su Facebook e su Instagram.
   - In fase di sviluppo, aggiungi il tuo utente come **tester** dell'app (Ruoli app).
   - Ricorda: per Instagram `APP_URL` deve essere l'URL pubblico del Passo 0.

## Threads (Meta, ma credenziali separate)

Threads usa un'API sua (`graph.threads.net`) e **credenziali diverse** da quelle di
Facebook/Instagram, anche se l'app è la stessa. Serve un profilo Threads (basta quello
personale, non serve un account business).

1. https://developers.facebook.com → apri la **stessa app** di Facebook/Instagram (o
   creane una nuova di tipo *Business*).
2. **Casi d'uso → Aggiungi caso d'uso → Threads API** (in inglese: *Use cases → Threads
   API*). Attiva le autorizzazioni:
   - `threads_basic` (obbligatoria),
   - `threads_content_publish` (per pubblicare),
   - `threads_manage_insights` (per la pagina Statistiche).
3. Nelle **impostazioni del caso d'uso Threads** copia **Threads App ID** e **Threads App
   Secret** → in `.env`:
   ```
   THREADS_CLIENT_ID=...
   THREADS_CLIENT_SECRET=...
   ```
   ⚠️ Non sono l'ID e la chiave che hai messo in `META_CLIENT_ID`: quelli non funzionano
   con `graph.threads.net`.
4. Sempre lì compila i tre indirizzi:

   | Campo | Valore |
   |---|---|
   | URL di callback di reindirizzamento | `{APP_URL}/api/connect/threads/callback` |
   | Disinstalla URL di callback | `{APP_URL}/api/meta/deauthorize` |
   | Elimina URL di callback | `{APP_URL}/api/meta/data-deletion` |

   Devono essere **https**: Threads rifiuta `http://localhost`, quindi in locale serve il
   tunnel del Passo 0. Gli stessi due indirizzi di disinstallazione e cancellazione
   valgono anche per l'app Facebook/Instagram.
5. In **Ruoli app** aggiungi il tuo account Threads come tester finché l'app è in
   sviluppo, e accetta l'invito dall'app Threads (Impostazioni → Sito web → Inviti).
6. Riavvia uSocial, poi **Impostazioni → Connetti** su Threads.

Da sapere:
- il testo è limitato a **500 caratteri**;
- come Instagram, Threads **scarica i media da un URL pubblico**: `APP_URL` deve essere
  raggiungibile da internet, altrimenti la pubblicazione con foto o video fallisce;
- il token dura 60 giorni e uSocial lo rinnova da solo prima della scadenza.

## TikTok (il più lungo da approvare)

1. https://developers.tiktok.com → **Manage apps → Connect an app**.
2. Aggiungi il prodotto **Login Kit** e **Content Posting API**, scope `video.publish` (pubblicazione diretta) e `video.upload` (caricamento in bozza).
   In Content Posting API il **Direct Post** va anche auditato ("Apply"): senza audit TikTok
   accetta la pubblicazione diretta solo su account privati, e sugli altri risponde
   `403 unaudited_client_can_only_post_to_private_accounts`. Nel frattempo si usa il tipo
   di post "Carica come bozza", che non richiede l'audit.
3. **Redirect URI**: `{APP_URL}/api/connect/tiktok/callback`
4. Copia **Client Key** e **Client Secret** → `.env`: `TIKTOK_CLIENT_KEY`,
   `TIKTOK_CLIENT_SECRET`.
5. Finché l'app TikTok non è approvata, i video vengono pubblicati come **privati**
   (è una regola di TikTok, non un limite di uSocial).

---

## I due callback di Meta (disinstallazione e cancellazione dati)

Nella configurazione delle app Meta — Facebook, Instagram e Threads — ci sono altri due
campi oltre al redirect. Non servono a far entrare l'utente: li chiama **Meta**, dai suoi
server, quando succede qualcosa dalla parte sua.

| Campo nella console Meta | Indirizzo da mettere | Quando viene chiamato |
|---|---|---|
| **Disinstalla URL di callback** *(Deauthorize)* | `{APP_URL}/api/meta/deauthorize` | qualcuno toglie l'autorizzazione a uSocial dalle impostazioni del proprio profilo |
| **Elimina URL di callback** *(Data Deletion Request)* | `{APP_URL}/api/meta/data-deletion` | qualcuno chiede la cancellazione dei dati che uSocial ha ottenuto dalla piattaforma |

Sono gli stessi per tutte e tre le piattaforme: uSocial riconosce da sé con quale app è
stata firmata la richiesta.

Cosa fanno:
- **verificano la firma** (`signed_request`) con la chiave segreta dell'app, così nessuno
  può scollegare l'account di un altro conoscendone l'id;
- **cancellano il collegamento social**: token, id e nome profilo ricevuti da Meta;
- **non toccano** post, media e account uSocial, che non appartengono a Meta. Per
  cancellare anche quelli restano la pagina `/data-deletion` e *Impostazioni → Elimina il
  mio account*.

Il secondo risponde a Meta con un **codice di riscontro** e un link alla pagina
`/data-deletion`, che mostra la conferma: è il formato che Meta pretende, ed è il motivo
per cui in quel campo non basta mettere l'indirizzo di una pagina normale.

Sono **facoltativi** per usare l'app, ma Meta li chiede in fase di revisione — e senza il
primo un utente che revoca l'accesso continuerebbe a vedere l'account "connesso" in
uSocial, con un token ormai morto.

---

## Riepilogo Redirect URI (copia-incolla)

| Piattaforma | Redirect URI da inserire nel portale developer |
|---|---|
| Facebook | `{APP_URL}/api/connect/facebook/callback` |
| Instagram | `{APP_URL}/api/connect/instagram/callback` |
| LinkedIn | `{APP_URL}/api/connect/linkedin/callback` |
| Threads | `{APP_URL}/api/connect/threads/callback` |
| YouTube | `{APP_URL}/api/connect/youtube/callback` |
| TikTok | `{APP_URL}/api/connect/tiktok/callback` |

E i due callback che Meta chiama da sé (Facebook, Instagram e Threads, gli stessi per tutte):

| Campo | Indirizzo |
|---|---|
| Disinstalla URL di callback | `{APP_URL}/api/meta/deauthorize` |
| Elimina URL di callback | `{APP_URL}/api/meta/data-deletion` |

Dopo ogni modifica al `.env`, **riavvia** l'app (`npm run dev` o `docker compose up -d`).
Poi ogni utente collega i propri account da **Impostazioni → Connetti**.

---

## Statistiche: permessi in più

La pagina **Statistiche** rilegge visualizzazioni e interazioni dei post già pubblicati.
Le piattaforme non le danno con gli stessi permessi della pubblicazione:

| Piattaforma | Cosa serve | Cosa si ottiene |
|---|---|---|
| Instagram | scope `instagram_manage_insights` (già richiesto: **ricollega l'account**) | visualizzazioni, copertura, like, commenti, salvataggi, condivisioni |
| Facebook | scope `read_insights` (già richiesto: **ricollega l'account**) | impression, copertura, click, like, commenti, condivisioni |
| Threads | scope `threads_manage_insights` | visualizzazioni, like, risposte, repost e citazioni |
| YouTube | niente in più (basta `youtube.readonly`) | visualizzazioni, like, commenti, iscritti |
| TikTok | scope `video.list`, da abilitare **prima** nell'app su developers.tiktok.com, poi `TIKTOK_SCOPE_VIDEO_LIST=true` nel `.env` e **ricollega l'account** | visualizzazioni, like, commenti, condivisioni |
| LinkedIn | niente in più | solo reazioni e commenti: le impression di un profilo personale non sono esposte da nessuna API pubblica |

Dopo aver cambiato gli scope, gli account **già collegati continuano a usare i vecchi
permessi**: vanno disconnessi e ricollegati da *Impostazioni*, altrimenti le statistiche
restano vuote e la pagina lo segnala con "permessi mancanti".

I numeri si aggiornano da soli ogni 6 ore; il pulsante **Aggiorna dai social** li rilegge
subito.
