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

## Quale famiglia di permessi Instagram (la trappola dei nomi)

Meta ha **due** API Instagram diverse, con nomi di permesso quasi identici:

| | Come si accede | Nomi dei permessi |
|---|---|---|
| **Instagram API con Facebook Login** ← *quella che usa uSocial* | consenso su facebook.com, account IG Business collegato a una Pagina, chiamate su `graph.facebook.com` | `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_comments`, `instagram_manage_messages` |
| Instagram API con Instagram Login | consenso su instagram.com, senza Pagina, chiamate su `graph.instagram.com` | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `instagram_business_manage_comments`, … |

uSocial manda l'utente su `facebook.com/…/dialog/oauth` e ricava l'account IG da
`me/accounts → instagram_business_account`: è la **prima** riga. Quindi servono i nomi
**senza** il prefisso `business`. Quelli con `instagram_business_*` appartengono all'altra
API e con questo flusso non fanno niente.

### `pages_messaging` non compare nell'elenco

È normale: non sta fra i permessi delle Pagine. Compare solo dopo aver aggiunto all'app il
prodotto **Messenger** (o il caso d'uso *Messaggistica*), perché è lì che vive. Stessa cosa
per `instagram_manage_messages`, che arriva con **Messenger → Impostazioni Instagram**.

Se non vuoi (o non puoi) aggiungere Messenger: lascia vuoto il campo «messaggio privato»
nella regola e usa la sola risposta pubblica. Il risponditore tratta le due azioni come
indipendenti, quindi il permesso mancante sul DM **non** blocca la risposta pubblica.

---

## Risponditore automatico ai commenti

La pagina **Risposte automatiche** riconosce una parola chiave nei commenti (il classico
«commenta PAUSA e ti mando la guida») e risponde da sola.

| Piattaforma | Risposta pubblica | Messaggio privato | Permessi da aggiungere |
|---|---|---|---|
| Instagram | ✅ | ✅ | `instagram_manage_comments`, `instagram_manage_messages` |
| Facebook | ✅ | ✅ | `pages_manage_engagement`, `pages_messaging` |
| Threads | ✅ | ❌ non esiste una API DM | `threads_manage_replies` |
| YouTube | ✅ | ❌ | `youtube.force-ssl` |
| TikTok, LinkedIn | ❌ | ❌ | — |

Sono già richiesti al consenso: basta **ricollegare** gli account.

Limiti che vengono da Meta, non da uSocial:
- il messaggio privato agganciato a un commento si può mandare **entro 7 giorni** e **una
  volta sola per commento**. Passata la finestra, uSocial usa la sola risposta pubblica
  invece di collezionare errori;
- il motore controlla i post degli **ultimi 7 giorni ogni 5 minuti**, con un tetto di 30
  risposte per giro perché un post virale non svuoti la quota di chiamate.

Ogni regola nasce **spenta**, e il pulsante «Prova a vuoto» mostra cosa verrebbe mandato
senza mandarlo: qui in fondo si scrive a persone vere.

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
| Instagram | scope `instagram_manage_insights` (già richiesto: **ricollega l'account**) | visualizzazioni, copertura, like, commenti, salvataggi, condivisioni. ⚠️ Le **storie** hanno metriche loro e spariscono dall'API dopo 24 ore: passato quel tempo restano senza numeri, ed è normale |
| Facebook | scope `read_insights` (già richiesto: **ricollega l'account**) | impression, copertura, click, like, commenti, condivisioni |
| Threads | scope `threads_manage_insights` | visualizzazioni, like, risposte, repost e citazioni |
| YouTube | niente in più (basta `youtube.readonly`) | visualizzazioni, like, commenti, iscritti |
| TikTok | scope `video.list`, da abilitare **prima** nell'app su developers.tiktok.com, poi `TIKTOK_SCOPE_VIDEO_LIST=true` nel `.env` e **ricollega l'account** | visualizzazioni, like, commenti, condivisioni |
| LinkedIn | non ottenibili su un profilo personale | `socialActions` risponde 403 con i permessi di un profilo (`w_member_social` serve a pubblicare, non a rileggere) e le impression esistono solo per le Pagine aziendali, con il prodotto "Community Management API". La pagina lo segnala come «statistiche non disponibili», non come permesso mancante |

Dopo aver cambiato gli scope, gli account **già collegati continuano a usare i vecchi
permessi**: vanno disconnessi e ricollegati da *Impostazioni*, altrimenti le statistiche
restano vuote.

La pagina distingue i due casi, perché il rimedio è diverso:
- «manca il permesso, ricollega l'account» → c'è qualcosa da fare;
- «statistiche non disponibili» → la piattaforma quei numeri non li dà (LinkedIn su
  profilo personale, storie Instagram scadute) e la connessione è a posto.

Se Facebook risponde `(#10) requires the 'pages_read_engagement' permission` anche dopo
aver ricollegato, controlla che quel permesso risulti concesso in *developers.facebook.com
→ Revisione dell'app → Autorizzazioni*: al consenso si possono deselezionare le Pagine.

I numeri si aggiornano da soli ogni 6 ore; il pulsante **Aggiorna dai social** li rilegge
subito.
