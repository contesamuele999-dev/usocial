# 🌍 Mettere uSocial online — gratis e 24 ore su 24

Questa guida pubblica uSocial su una **VM gratuita "Always Free" di Google Cloud**, con
**Docker** e **HTTPS automatico** (Caddy + dominio gratuito DuckDNS). Risultato: l'app resta
online **gratis, per sempre e sempre accesa** (i post programmati partono anche a PC spento).

> ⏱️ Tempo: ~30-40 minuti, una volta sola. Non serve essere programmatori: sono tutti
> comandi da copiare e incollare. Se ti blocchi su un passo, chiedimi e lo risolviamo.

**Perché Google Cloud e non Oracle?** Oracle è famoso per rifiutare carte e bloccare gli
account nuovi, ed è la causa più comune di blocco a metà setup. Google Cloud accetta le carte
molto più facilmente e la registrazione è più liscia. La sua **e2-micro "Always Free"** resta
gratis per sempre. (Se preferisci Oracle, trovi i passi in fondo alla guida.)

**Perché non GitHub Pages / Vercel / Render free?** Pages e Vercel non eseguono un server
Node persistente con database e scheduler; i piani free di Render/Koyeb si addormentano e
cancellano i dati (i post programmati non partirebbero). Una piccola VM sempre accesa è
l'unico modo davvero gratis e 24/7 per questa app.

---

## Riepilogo dei passi

1. Mettere il codice su GitHub
2. Creare la VM gratuita su Google Cloud
3. Aprire le porte 80 e 443 (firewall)
4. Attivare la swap (la e2-micro ha solo 1 GB di RAM)
5. Installare Docker sulla VM
6. Dominio gratuito con DuckDNS
7. Scaricare il codice e creare il file `.env`
8. Avviare l'app (HTTPS automatico)
9. Registrarti e collegare i social

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
> Lo ricreerai direttamente sul server al passo 7.

---

## 2) VM gratuita su Google Cloud

1. Crea un account su https://cloud.google.com → **Inizia gratuitamente**. Serve una carta
   **solo per la verifica**: sulle risorse **Always Free** non viene addebitato nulla, e ricevi
   anche 300$ di credito prova che **non sei obbligato a spendere**.
   > 💳 Consiglio: usa una **carta di credito classica** (Visa/Mastercard), niente VPN e dati
   > anagrafici veri e coerenti con la carta. Così l'account non viene bloccato.
2. Nella console, in alto, assicurati di avere un **progetto** selezionato (ne crea uno di
   default, va benissimo).
3. Menu ☰ → **Compute Engine → VM instances** → attiva l'API se richiesto → **Create Instance**.
4. Impostazioni **importanti** per restare nel gratis:
   - **Name**: `usocial`
   - **Region**: una tra `us-central1` (Iowa), `us-west1` (Oregon), `us-east1` (South Carolina).
     ⚠️ La e2-micro è Always Free **solo** in queste tre region.
   - **Machine type**: serie **E2**, tipo **`e2-micro`** (2 vCPU, 1 GB RAM).
   - **Boot disk**: clicca **Change** → **Ubuntu** → **Ubuntu 22.04 LTS** → dimensione **30 GB**
     Standard persistent disk (fino a 30 GB è gratis).
   - **Firewall**: spunta **Allow HTTP traffic** e **Allow HTTPS traffic**.
5. Clicca **Create**. Dopo qualche secondo vedrai la VM con il suo **External IP** (es. `34.x.x.x`).
   Segnatelo.

Collegati via SSH (il modo più facile): nella riga della tua VM, clicca il pulsante **SSH** →
si apre un terminale nel browser, già collegato. (In alternativa puoi usare il tuo terminale
con `gcloud compute ssh usocial`.)

---

## 3) Aprire le porte 80 e 443

Se al passo 4 hai spuntato **Allow HTTP/HTTPS traffic**, le porte 80 e 443 sono **già aperte**
e puoi saltare questo passo.

Se te ne sei dimenticato: menu ☰ → **VPC network → Firewall → Create firewall rule**, crea due
regole (o una sola con entrambe le porte):
- Name `allow-http`, Targets **All instances**, Source `0.0.0.0/0`, Protocols/ports: TCP `80`
- Name `allow-https`, Targets **All instances**, Source `0.0.0.0/0`, Protocols/ports: TCP `443`

> Su Google Cloud **non** serve toccare il firewall interno della VM (a differenza di Oracle):
> Ubuntu su GCP non ha iptables che bloccano queste porte.

---

## 4) Attivare la swap (memoria virtuale)

La e2-micro ha solo **1 GB di RAM**: senza swap la build di Docker può fallire. Crea 2 GB di
swap una volta sola (dal terminale SSH della VM):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verifica: `free -h` deve mostrare `Swap: 2.0Gi`.

---

## 5) Installare Docker sulla VM

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

Verifica: `docker --version`.

---

## 6) Dominio gratuito con DuckDNS

OAuth e Instagram richiedono un indirizzo **HTTPS stabile**. DuckDNS regala un
sottodominio gratuito.

1. Vai su https://www.duckdns.org, accedi (con Google/GitHub).
2. Crea un dominio, es. `umaster-social` → ottieni `umaster-social.duckdns.org`.
3. Nel campo **current ip** scrivi l'**External IP** della tua VM e premi *update ip*.

Da ora `umaster-social.duckdns.org` punta al tuo server.

---

## 7) Scaricare il codice e creare `.env`

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

## 8) Avviare l'app (HTTPS automatico)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La prima build dura qualche minuto (con la swap attiva la e2-micro ce la fa senza problemi).
Caddy ottiene da solo il certificato HTTPS. Controlla che sia tutto su:

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

## 9) Collegare i social

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
- **IP fisso (consigliato)**: su Google Cloud l'External IP di default può cambiare al riavvio.
  Per bloccarlo: menu ☰ → **VPC network → IP addresses**, trova l'IP della VM e imposta il tipo
  su **Static** (un IP statico in uso su una VM Always Free è gratuito). Poi aggiorna DuckDNS.

---

## Alternative a Google Cloud

Se preferisci non usare Google Cloud, gli stessi passi (Ubuntu 22.04 + Docker) funzionano su:

- **VPS a pagamento, molto semplice (~4€/mese)**: **Hetzner Cloud**, **Contabo**, **DigitalOcean**
  o **Hostinger**. Nessun problema di carta o di "capacità esaurita", più RAM, nessuna swap
  necessaria. Spesso è la scelta più tranquilla se i free tier ti danno problemi.
- **Oracle Cloud (Always Free)**: gratis ma più ostico (carte spesso rifiutate, VM "out of
  capacity", account bloccati). Se vuoi provarci comunque:
  1. Account su https://www.oracle.com/cloud/free/ → **Compute → Instances → Create Instance**.
  2. Image Ubuntu 22.04; Shape `VM.Standard.A1.Flex` (ARM, 1-2 OCPU, 6-12 GB RAM) oppure, se
     "out of capacity", `VM.Standard.E2.1.Micro` (AMD). Scegli *Generate a key pair for me* e
     **scarica la chiave privata**.
  3. Su Oracle le porte vanno aperte in **due** punti: nel pannello **VCN → Security Lists →
     default → Add Ingress Rules** (TCP 80 e 443, source `0.0.0.0/0`) **e** sulla VM col firewall
     interno:
     ```bash
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```
  4. Da qui in poi segui i passi 5-9 di questa guida (Docker, DuckDNS, `.env`, avvio). Con lo
     shape ARM hai 6+ GB di RAM, quindi la swap non serve.
- **AWS EC2 t3.micro**: gratis solo i primi **12 mesi**, poi si paga. Ok per una prova temporanea.
