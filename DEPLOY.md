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

L'immagine Docker **non si compila sulla VM**: la costruisce GitHub Actions a ogni push su
`main` (vedi `.github/workflows/build.yml`) e la pubblica su `ghcr.io`. Alla VM resta solo da
scaricarla.

Prima di questo passo, assicurati che il primo build sia andato a buon fine: apri la tab
**Actions** del tuo repository su GitHub e aspetta il segno di spunta verde (pochi minuti).
Poi, la prima volta, rendi pubblico il pacchetto: pagina del repository -> **Packages** ->
`usocial` -> *Package settings* -> *Change visibility* -> **Public**. (Se preferisci tenerlo
privato, sulla VM serve prima un `docker login ghcr.io` con un token che abbia lo scope
`read:packages`.)

Sulla VM:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Il download dura una trentina di secondi.
Caddy ottiene da solo il certificato HTTPS. Controlla che sia tutto su:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy   # Ctrl+C per uscire
```

Apri nel browser: **https://umaster-social.duckdns.org** → sei online! 🎉
Clicca **Registrati** e crea il tuo account.

> Aggiornare l'app in futuro (dopo aver pushato le modifiche e atteso il verde su Actions):
> ```bash
> cd usocial
> git pull
> docker compose -f docker-compose.prod.yml pull
> docker compose -f docker-compose.prod.yml up -d
> ```
> Trenta secondi in tutto. **Non usare mai `--build` su questa VM**: vedi il riquadro qui sotto.

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

## Il sito dà 502 ma i container sono su

Guarda i log di Caddy:

```bash
docker compose -f docker-compose.prod.yml logs --tail=40 caddy
```

Se vedi `dial tcp: lookup usocial: i/o timeout`, il DNS interno di Docker non ha risposto:
succede quando la VM è sotto pressione di memoria (swap piena). L'app è viva — puoi
verificarlo da dentro la rete Docker:

```bash
docker exec usocial-caddy wget -qO- -S http://172.28.0.10:3000 2>&1 | head -3
```

Le versioni recenti di `Caddyfile` e `docker-compose.prod.yml` usano un **IP fisso**
(`172.28.0.10`) proprio per togliere il DNS dal percorso. Se stai usando una versione
vecchia, aggiorna il codice e ricrea i container.

**Non lanciare `--build` sulla VM, mai**, nemmeno a container fermi. `next build` vuole circa
2 GB di RAM: su una e2-micro finisce tutto in swap, e siccome il disco Always Free e un HDD da
poche decine di IOPS il processo resta ore in attesa di I/O (misurato: 4 ore per soli 3 minuti
di CPU effettiva), con `load average` sopra 14, dockerd bloccato e lo scheduler che manda in
errore le pubblicazioni programmate con `EAI_AGAIN`.

Il build si fa su GitHub Actions, che e gratuito sui repository pubblici. Se ne trovi uno gia
in corso sulla VM, fermalo:

```bash
sudo pkill -9 -f 'next build'
sudo systemctl restart docker      # se `docker ps` resta appeso
sudo docker start usocial          # il container viene ucciso dal riavvio di dockerd
sudo docker builder prune -f       # recupera la cache dei build falliti (spesso alcuni GB)
```

---

## La VM si blocca: `load average` altissimo e `docker ps` appeso

Sintomo: il sito non risponde, `docker ps` resta appeso, `uptime` mostra un `load average`
sopra 10 (misurati anche 48) ma `ps aux` non mostra nessun processo che consuma CPU. Nel
`dmesg` compaiono `blk_mq_run_work_fn hogged CPU` e `Under memory pressure, flushing caches`,
**senza** nessun `Out of memory: Killed process`.

Non e la RAM: e il **disco**. Il persistent disk *standard* del free tier e un HDD di rete le
cui prestazioni scalano con la dimensione: su 30 GB fa circa **20 IOPS in lettura e 3,5 MB/s**.
Basta poco a saturarlo — un riavvio con tutti i servizi che partono insieme, un `apt-get
update` in sottofondo, o anche solo ffmpeg che estrae la miniatura di un video — e da li in
poi ogni processo finisce in coda in stato `D` (I/O wait). Il `load average` conta anche quelli,
per questo esplode senza che nulla stia davvero calcolando.

### Sbloccarla

```bash
sudo pkill -9 ffmpeg; sudo pkill -9 apt-get
sudo systemctl stop apt-daily.timer apt-daily-upgrade.timer unattended-upgrades
uptime; vmstat 1 5     # nella colonna `wa`: sopra 50 sei ancora nel tunnel, sotto 10 e passata
```

Quando `wa` e rientrata:

```bash
sudo systemctl restart docker
sudo docker start usocial       # il riavvio di dockerd uccide il container (exit 137)
sudo docker ps; curl -s -o /dev/null -w '%{http_code}
' http://172.28.0.10:3000
```

### Ridurre la pressione sul disco (una volta sola)

Non elimina il problema — il disco resta quello — ma abbassa parecchio la frequenza degli
episodi.

```bash
# 1) niente aggiornamenti automatici in sottofondo (vedi avvertenza sotto)
sudo systemctl disable --now apt-daily.timer apt-daily-upgrade.timer unattended-upgrades

# 2) swap solo sotto vera pressione, e cache dei metadati tenuta piu a lungo
printf 'vm.swappiness=10
vm.vfs_cache_pressure=50
' | sudo tee /etc/sysctl.d/99-usocial.conf
sudo sysctl --system

# 3) journal di sistema limitato (scriveva in continuazione)
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]
SystemMaxUse=50M
RuntimeMaxUse=16M
' | sudo tee /etc/systemd/journald.conf.d/99-usocial.conf
sudo systemctl restart systemd-journald

# 4) rotazione dei log dei container (altrimenti crescono all'infinito)
printf '{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker && sudo docker start usocial
```

> ⚠️ Il punto 1 disattiva gli **aggiornamenti di sicurezza automatici**, e la VM e esposta su
> internet. Falli a mano una volta al mese, quando puoi tenere d'occhio la macchina:
> ```bash
> sudo apt update && sudo apt upgrade -y && sudo reboot
> ```

### La soluzione definitiva (a pagamento, ~3-4 euro al mese)

Cambiare il disco di boot da *standard* a **balanced** (SSD): stessi 30 GB, ma circa 3.000 IOPS
invece di 20. Si fa dalla console Google Cloud con la VM spenta e non si perdono i dati. Esce
dal free tier, ma elimina in un colpo solo i 502, le miniature che non si generano e questi
blocchi.

---

## Il sito non risponde più dopo aver caricato un video

Su una VM da 1 GB (e2-micro) la causa quasi sempre è la **memoria esaurita**: il kernel
uccide il processo Node e il container resta giù. Verifica:

```bash
docker ps -a
sudo dmesg -T | grep -iE "out of memory|killed process" | tail
free -m
df -h /
```

Se in `dmesg` compare `Killed process … node`, era OOM. Per rimettere in piedi l'app:

```bash
cd ~/usocial && docker compose -f docker-compose.prod.yml up -d
```

Poi assicurati che siano vere entrambe queste cose:

1. **La swap è attiva** (passo 4 di questa guida): `free -m` deve mostrare una riga `Swap`
   diversa da zero.
2. **Il codice è aggiornato**: le versioni recenti caricano, pubblicano **e servono**
   i video in streaming, senza tenerli in RAM. Aggiorna con:

```bash
cd ~/usocial
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

3. **Caddy serve i media da sé**: il `docker-compose.prod.yml` monta `./data/media`
   su `/srv/files` nel container di Caddy, che risponde a `/files/*` senza svegliare
   Node. È una modifica al compose, quindi il container va **ricreato** (non basta
   riavviarlo) — il comando `up -d` qui sopra lo fa. Per controllare che funzioni:

```bash
docker compose -f docker-compose.prod.yml exec caddy ls /srv/files
```

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
