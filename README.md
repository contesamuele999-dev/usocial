# 🚀 uSocial — Social Publisher AI

Strumento per scrivere un contenuto una sola volta e pubblicarlo contemporaneamente su
**Facebook, Instagram, TikTok, YouTube e LinkedIn** usando esclusivamente le API ufficiali.

**Multi-utente con login**: ogni utente ha i propri post, media e account social, che
collega da sé con un click dalla web app. Niente abbonamenti, niente ruoli, niente
enterprise: solo un software leggero, veloce e facilmente estendibile.

> 📎 Per collegare i social segui **[SETUP_API.md](SETUP_API.md)** — guida passo-passo
> nel modo più semplice possibile.

---

## Funzionalità

- **Login** — registrazione e accesso con email + password (sessioni sicure httpOnly).
  Ogni utente vede solo i propri dati.
- **Dashboard** — calendario editoriale, post programmati, bozze, ultimi pubblicati.
- **Editor** — titolo, testo, hashtag, emoji, media (immagini/video/caroselli), data e ora,
  checkbox piattaforme, pubblicazione in un click.
- **AI integrata** — adatta il testo a ogni piattaforma, versioni corte/lunghe, titoli,
  hashtag, CTA, articoli LinkedIn, descrizioni YouTube. Provider sostituibile:
  **mock** (default, senza API key), **Google Gemini** (`gemini-2.5-flash`, gratis con
  [Google AI Studio](https://aistudio.google.com/apikey)), **Anthropic**, **OpenAI**,
  **Ollama** (locale).
- **Calendario** — vista mensile, drag & drop per riprogrammare, duplicazione, filtro piattaforma.
- **Libreria media** — upload drag & drop, ricerca, tag, cartelle, anteprima.
- **Cronologia** — storico pubblicazioni, errori API, tentativi, log completi.
- **Impostazioni** — connessione OAuth degli account, verifica token, disconnessione,
  configurazione AI, backup/esportazione JSON.
- **Scheduler integrato** — i post programmati partono da soli (controllo ogni 60 secondi).

## Stack

| Livello | Tecnologia |
|---|---|
| Frontend | React 19 + Next.js 15 (App Router) + Tailwind CSS |
| Backend | Next.js Route Handlers (API REST, Node.js) |
| Database | SQLite (better-sqlite3, file in `data/usocial.db`) |
| Storage | Filesystem locale (`data/media`) — astrazione pronta per S3 |
| Login utenti | Email + password (scrypt) + sessioni su DB (cookie httpOnly) |
| Auth social | OAuth 2.0 ufficiale di ogni piattaforma, per-utente |
| Container | Docker + Docker Compose |
| Test | Vitest |

---

## Installazione

### Sviluppo locale

```bash
git clone <repo> && cd uSocial
cp .env.example .env      # compila quello che ti serve (funziona anche vuoto)
npm install
npm run dev               # → http://localhost:3000
```

Al primo avvio apri http://localhost:3000: verrai mandato su **/login** →
**Registrati** per creare il tuo account. Da lì hai accesso a tutta l'app.

### Docker (consigliato per l'uso quotidiano)

```bash
cp .env.example .env
docker compose up -d      # → http://localhost:3000
```

I dati (database + media) restano in `./data` sull'host.

### 🌍 Metterla online 24/7 (gratis)

Per pubblicarla su internet, sempre accesa e gratis (VM Always Free + HTTPS automatico),
segui **[DEPLOY.md](DEPLOY.md)**. Usa `docker-compose.prod.yml` + `Caddyfile` (già inclusi).

### Test

```bash
npm test
```

---

## Connessione degli account social

L'app funziona subito per registrazione, bozze, calendario, media e AI (provider mock).
Per **pubblicare** l'amministratore crea **una app developer per piattaforma** (una volta
sola) e mette **Client ID/Secret** nel `.env`; poi **ogni utente** collega il proprio
account da **Impostazioni → Connetti**.

👉 Procedura passo-passo, semplice, in **[SETUP_API.md](SETUP_API.md)**.

| Piattaforma | Dove creare l'app | Redirect URI |
|---|---|---|
| Facebook | [developers.facebook.com](https://developers.facebook.com) | `{APP_URL}/api/connect/facebook/callback` |
| Instagram | stessa app Meta | `{APP_URL}/api/connect/instagram/callback` |
| LinkedIn | [developer.linkedin.com](https://developer.linkedin.com) | `{APP_URL}/api/connect/linkedin/callback` |
| YouTube | [console.cloud.google.com](https://console.cloud.google.com) | `{APP_URL}/api/connect/youtube/callback` |
| TikTok | [developers.tiktok.com](https://developers.tiktok.com) | `{APP_URL}/api/connect/tiktok/callback` |

Le credenziali nel `.env` sono a livello di **app**: un solo set serve tutti gli utenti,
e ciascuno autorizza il proprio account dal browser (nessuna chiave da condividere).

### ⚠️ Nota su Instagram e i media

Instagram (e in parte Facebook) **scarica i media da un URL pubblico**: per pubblicare
immagini/video su Instagram, `APP_URL` deve essere raggiungibile da internet
(es. reverse proxy, Cloudflare Tunnel, ngrok). Testo, bozze e tutto il resto funzionano
anche in locale.

---

## Architettura

```
src/
├── app/                  # pagine (App Router) + API REST in app/api/
│   ├── login/  register/ # pagine di autenticazione
│   └── api/auth/         # register | login | logout | me
│       api/connect/      # OAuth social per-utente ([platform] + callback)
├── middleware.ts         # protezione rotte (redirect a /login senza sessione)
├── components/           # componenti React riutilizzabili
├── lib/                  # db, auth, api(withUser), repository, storage, logger, scheduler
├── ai/                   # modulo AI: actions + provider sostituibili
│   └── providers/        # mock | gemini | anthropic | openai | ollama
├── social/               # UN MODULO PER PIATTAFORMA (indipendenti)
│   ├── types.ts          # contratto SocialModule
│   ├── registry.ts       # registro dei moduli
│   ├── oauth.ts          # helper OAuth2 generico
│   ├── publisher.ts      # orchestratore di pubblicazione
│   ├── facebook/  instagram/  tiktok/  youtube/  linkedin/
└── types/                # tipi condivisi
```

### Aggiungere una nuova piattaforma

1. Crea `src/social/<nome>/index.ts` che esporta un `SocialModule` (vedi `types.ts`);
2. registralo in `src/social/registry.ts`;
3. aggiungi il nome a `PLATFORMS` in `src/types/index.ts` e le credenziali in `env.ts`.

Fine: UI, API, calendario e scheduler la vedono automaticamente.

### Sostituire il provider AI

Impostazioni → Configurazione AI, oppure `.env` (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`).
Per un provider nuovo: implementa l'interfaccia `AiProvider` (una sola funzione `complete`)
in `src/ai/providers/` e mappalo in `src/ai/index.ts`.

---

## API principali

Tutte le API (tranne login/registrazione e il file media pubblico) richiedono la sessione
utente e operano **solo** sui dati dell'utente loggato.

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` | account utente |
| GET | `/api/auth/me` | utente corrente |
| GET/POST | `/api/posts` | lista / crea post |
| GET/PUT/PATCH/DELETE | `/api/posts/:id` | dettaglio / modifica / riprogramma / elimina |
| POST | `/api/posts/:id/publish` | pubblica subito |
| POST | `/api/posts/:id/duplicate` | duplica |
| POST | `/api/posts/:id/adapt` | adatta il testo con l'AI per ogni piattaforma |
| GET/POST | `/api/media` | libreria / upload |
| POST | `/api/ai` | azioni AI ad hoc |
| GET | `/api/platforms` | piattaforme + stato connessione |
| GET | `/api/connect/:platform` | avvia OAuth per collegare un account all'utente |
| POST/DELETE | `/api/accounts/:platform` | verifica token / disconnetti |
| GET | `/api/logs` | log applicativi |
| GET | `/api/export` | backup JSON |

---

## Sicurezza

- Password salvate con **scrypt** (salt casuale per utente); mai in chiaro.
- Sessioni con token casuale in **cookie httpOnly** (SameSite=Lax), scadenza 30 giorni,
  `Secure` in produzione. Validate lato server a ogni richiesta.
- Ogni query è **filtrata per utente**: un utente non può leggere/modificare i dati altrui.
- I token OAuth restano nel DB locale e **non vengono mai inviati al frontend** né esportati.
- Unico endpoint pubblico: il file media (`/api/media/:id/:file`), necessario perché
  Instagram/Facebook scaricano i media da un URL. Metti l'app dietro HTTPS in produzione.

Vedi anche [ROADMAP.md](ROADMAP.md) per gli sviluppi futuri.
