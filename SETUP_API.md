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

## TikTok (il più lungo da approvare)

1. https://developers.tiktok.com → **Manage apps → Connect an app**.
2. Aggiungi il prodotto **Login Kit** e **Content Posting API**, scope `video.publish`.
3. **Redirect URI**: `{APP_URL}/api/connect/tiktok/callback`
4. Copia **Client Key** e **Client Secret** → `.env`: `TIKTOK_CLIENT_KEY`,
   `TIKTOK_CLIENT_SECRET`.
5. Finché l'app TikTok non è approvata, i video vengono pubblicati come **privati**
   (è una regola di TikTok, non un limite di uSocial).

---

## Riepilogo Redirect URI (copia-incolla)

| Piattaforma | Redirect URI da inserire nel portale developer |
|---|---|
| Facebook | `{APP_URL}/api/connect/facebook/callback` |
| Instagram | `{APP_URL}/api/connect/instagram/callback` |
| LinkedIn | `{APP_URL}/api/connect/linkedin/callback` |
| YouTube | `{APP_URL}/api/connect/youtube/callback` |
| TikTok | `{APP_URL}/api/connect/tiktok/callback` |

Dopo ogni modifica al `.env`, **riavvia** l'app (`npm run dev` o `docker compose up -d`).
Poi ogni utente collega i propri account da **Impostazioni → Connetti**.
