# 🌍 Mettere uSocial online — gratis e 24 ore su 24

Questa guida pubblica uSocial su una **VM gratuita "Always Free" di Oracle Cloud**, con
**Docker** e **HTTPS automatico** (Caddy + dominio gratuito DuckDNS). Risultato: l'app resta
online **gratis, per sempre e sempre accesa** (i post programmati partono anche a PC spento).

> ⏱️ Tempo: ~30-40 minuti, una volta sola. Non serve essere programmatori: sono tutti
> comandi da copiare e incollare. Se ti blocchi su un passo, chiedimi e lo risolviamo.

**Perché non GitHub Pages / Vercel / Render free?** Pages e Vercel non eseguono un server
Node persistente con database e scheduler; i piani free di Render/Koyeb si addormentano e
cancellano i dati (i post programmati non partirebbero). Una piccola VM sempre accesa è
l'unico modo davvero gratis e 24/7 per questa app.

---

## Riepilogo dei passi

1. Mettere il codice su GitHub
2. Creare la VM gratuita su Oracle Cloud
3. Aprire le porte 80 e 443
4. Installare Docker sulla VM
5. Dominio gratuito con DuckDNS
6. Scaricare il codice e creare il file `.env`
7. Avviare l'app (HTTPS automatico)
8. Registrarti e collegare i social

---

## 1) Codice su GitHub

Sul tuo PC, dentro la cartella `uSocial`:

```bash
git init
git add .
git commit -m "uSocial: prima versione"
```

Poi crea un repository su https://github.com/new (chiamalo `usocial`, **Private** va bene) e:

```bash
git remote add origin https://github.com/TUO-UTENTE/usocial.git
git branch -M main
git push -u origin main
```

> Il file `.env` **non** viene caricato (è in `.gitignore`): le tue chiavi restano private.
> Lo ricreerai direttamente sul server al passo 6.

---

## 2) VM gratuita su Oracle Cloud

1. Crea un account su https://www.oracle.com/cloud/free/ (chiede una carta per la verifica,
   ma sulle risorse **"Always Free"** non viene addebitato nulla).
2. Menu → **Compute → Instances → Create Instance**.
3. Impostazioni consigliate:
   - **Image**: Ubuntu 22.04
   - **Shape**: `VM.Standard.A1.Flex` (ARM Ampere, "Always Free") — es. 1-2 OCPU, 6-12 GB RAM.
     Se dice "out of capacity", prova un'altra Availability Domain o riprova più tardi
     (oppure usa lo shape AMD `VM.Standard.E2.1.Micro`, anch'esso Always Free).
   - **SSH keys**: scegli *Generate a key pair for me* e **scarica la chiave privata**.
4. Crea l'istanza e segna il **Public IP address** (es. `152.67.x.x`).

Collegati via SSH (da PowerShell/terminale, con la chiave scaricata):

```bash
ssh -i C:/percorso/della/chiave.key ubuntu@IP_PUBBLICO
```

---

## 3) Aprire le porte 80 e 443

Oracle blocca tutto tranne SSH. Vanno aperte in **due** punti.

**a) Nel pannello Oracle** (Virtual Cloud Network): apri la tua VCN → **Security Lists** →
la default → **Add Ingress Rules**, due regole:
- Source `0.0.0.0/0`, IP Protocol TCP, Destination Port `80`
- Source `0.0.0.0/0`, IP Protocol TCP, Destination Port `443`

**b) Sulla VM** (firewall interno), dopo esserti collegato via SSH:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 4) Installare Docker sulla VM

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

Verifica: `docker --version`.

---

## 5) Dominio gratuito con DuckDNS

OAuth e Instagram richiedono un indirizzo **HTTPS stabile**. DuckDNS regala un
sottodominio gratuito.

1. Vai su https://www.duckdns.org, accedi (con Google/GitHub).
2. Crea un dominio, es. `umaster-social` → ottieni `umaster-social.duckdns.org`.
3. Nel campo **current ip** scrivi il **Public IP** della tua VM e premi *update ip*.

Da ora `umaster-social.duckdns.org` punta al tuo server.

---

## 6) Scaricare il codice e creare `.env`

Sulla VM:

```bash
git clone https://github.com/TUO-UTENTE/usocial.git
cd usocial
nano .env
```

Incolla (adattando il dominio e, più avanti, le chiavi social — vedi `SETUP_API.md`):

```
APP_DOMAIN=umaster-social.duckdns.org
APP_URL=https://umaster-social.duckdns.org
DATA_DIR=/app/data
ALLOW_REGISTRATION=true

# AI gratuita consigliata (chiave: https://aistudio.google.com/apikey)
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
AI_API_KEY=la-tua-chiave-gemini

# Social: lasciali vuoti ora, li aggiungi dopo (SETUP_API.md)
META_CLIENT_ID=
META_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

Salva con `Ctrl+O`, `Invio`, poi `Ctrl+X`.

---

## 7) Avviare l'app (HTTPS automatico)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La prima build dura qualche minuto. Caddy ottiene da solo il certificato HTTPS.
Controlla che sia tutto su:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy   # Ctrl+C per uscire
```

Apri nel browser: **https://umaster-social.duckdns.org** → sei online! 🎉
Clicca **Registrati** e crea il tuo account.

> Aggiornare l'app in futuro:
> ```bash
> cd usocial && git pull && docker compose -f docker-compose.prod.yml up -d --build
> ```

---

## 8) Collegare i social

Ora che hai un URL HTTPS pubblico, segui **[SETUP_API.md](SETUP_API.md)** usando come
`APP_URL` il tuo dominio DuckDNS. I Redirect URI da inserire nei portali developer saranno
del tipo:

```
https://umaster-social.duckdns.org/api/connect/facebook/callback
https://umaster-social.duckdns.org/api/connect/instagram/callback
https://umaster-social.duckdns.org/api/connect/linkedin/callback
https://umaster-social.duckdns.org/api/connect/youtube/callback
https://umaster-social.duckdns.org/api/connect/tiktok/callback
```

Dopo aver messo le chiavi nel `.env`, riavvia:
```bash
docker compose -f docker-compose.prod.yml up -d
```
poi in uSocial: **Impostazioni → Connetti**.

---

## Consigli

- **Backup**: la cartella `data/` sul server contiene database e media. Copiala ogni tanto
  (`scp`) o usa **Impostazioni → Esporta backup JSON**.
- **Chiudere le registrazioni**: dopo aver creato i tuoi account, metti `ALLOW_REGISTRATION=false`
  nel `.env` e riavvia, così nessun altro può registrarsi.
- **Alternativa a Oracle**: se non riesci ad avviare la VM Oracle (capacità esaurita), la
  **e2-micro "Always Free" di Google Cloud** funziona con gli stessi passi (region us-central1/
  us-west1/us-east1). Ha solo 1 GB di RAM: la build va fatta con un po' di swap attiva.
