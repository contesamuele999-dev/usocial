# uSocial — Script di registrazione screencast per la verifica Meta

Obiettivo: dimostrare al revisore Meta che ogni permesso richiesto è usato realmente, end-to-end.
Regole d'oro (se non rispettate → richiesta respinta):
- **Ogni screencast deve includere il flusso OAuth** (il momento del login/autorizzazione Facebook).
- Il contenuto pubblicato deve essere **realmente visibile** su Facebook/Instagram, non solo confermato dentro l'app.
- Registra a schermo intero, mostra la **barra degli indirizzi** del browser (le URL provano che è l'app reale).
- Muoviti lentamente, lascia ogni schermata 2-3 secondi.
- App in **modalità sviluppo** va bene: usa un account con ruolo admin/tester dell'app.
- Prima di registrare: `APP_URL` = dominio pubblico HTTPS (per Instagram serve URL pubblico raggiungibile da Meta).

Puoi caricare **un unico video completo** su tutte le schede, oppure 3 video tematici (IG / FB post+video / Live). Sotto trovi la sequenza unica completa; i marcatori [PERMESSO] indicano quale scheda copre ogni segmento.

---

## PRE-REGISTRAZIONE (checklist, non nel video)

- [ ] Account Facebook usato = admin o tester dell'app.
- [ ] Pagina Facebook "Metodo di Studio Strategico" amministrata dall'utente.
- [ ] Account Instagram professionale collegato alla Pagina (verificato: me/accounts mostra instagram_business_account).
- [ ] `APP_URL` = https://usocial.duckdns.org (o dominio pubblico), e i 4 redirect URI in whitelist su Facebook Login.
- [ ] App avviata e raggiungibile in HTTPS.
- [ ] Un'immagine, un video breve (.mp4) e OBS (o encoder) pronti per la diretta.
- [ ] Software di cattura schermo pronto (registra anche il cursore).

---

## SEQUENZA DI REGISTRAZIONE

### Segmento 1 — Login e collegamento account  [public_profile, pages_show_list, business_management, instagram_basic, pages_read_engagement]
1. Apri uSocial nel browser (URL visibile). Mostra la schermata iniziale/login.
2. Clicca "Accedi con Facebook" / "Collega Facebook".
3. **Mostra tutta la finestra OAuth di Facebook**: la richiesta di permessi, la schermata "Quali Pagine vuoi usare" con la Pagina selezionata, e il pulsante di conferma. → questo prova public_profile + pages_show_list + business_management.
4. Torna nell'app: mostra la schermata Account con **il nome della Pagina** collegata (→ pages_read_engagement) e **lo username Instagram @...** collegato (→ instagram_basic).
5. Sosta 3 secondi su questa schermata di conferma.

### Segmento 2 — Pubblicazione su Instagram  [instagram_content_publish]
1. Vai alla schermata di composizione.
2. Scrivi una caption, allega un'immagine o un reel/video.
3. Seleziona Instagram come destinazione e clicca "Pubblica".
4. Mostra il messaggio di successo nell'app.
5. **Apri Instagram** (app o instagram.com) e mostra il post appena pubblicato, visibile sul profilo. ← passaggio obbligatorio.

### Segmento 3 — Post di testo/foto sulla Pagina Facebook  [pages_manage_posts]
1. Torna alla composizione, scrivi un testo, allega una foto.
2. Seleziona Facebook come destinazione, clicca "Pubblica".
3. Mostra il successo nell'app.
4. **Apri la Pagina Facebook** e mostra il post visibile sul feed della Pagina. ← obbligatorio.

### Segmento 4 — Upload video sulla Pagina Facebook  [publish_video]
1. Componi un nuovo contenuto, allega un **file video** (.mp4).
2. Pubblica su Facebook.
3. **Apri la Pagina** e mostra il video pubblicato e riproducibile. ← obbligatorio.

### Segmento 5 — Diretta video sulla Pagina  [Live Video API]
1. Nell'app, avvia una diretta ("Vai in diretta" / "Crea live").
2. Mostra che l'app genera **URL di ingest RTMP + stream key**.
3. Incolla RTMP URL e stream key in **OBS** (visibile a schermo) e avvia la trasmissione.
4. **Apri la Pagina Facebook** e mostra la **diretta attiva e in riproduzione**. ← obbligatorio.
5. Torna nell'app e clicca "Termina diretta"; mostra che la live si è chiusa sulla Pagina.

---

## MAPPA SEGMENTO → SCHEDA DEL PORTALE

| Scheda (permesso)         | Segmento che lo dimostra           |
|---------------------------|------------------------------------|
| public_profile            | 1 (finestra OAuth)                 |
| pages_show_list           | 1 (selezione Pagina nel dialog)    |
| business_management       | 1 (collegamento asset business)    |
| instagram_basic           | 1 (username IG mostrato)           |
| pages_read_engagement     | 1 (nome Pagina mostrato)           |
| instagram_content_publish | 2 (post IG reale)                  |
| pages_manage_posts        | 3 (post FB reale)                  |
| publish_video             | 4 (video su Pagina)                |
| Live Video API            | 5 (diretta su Pagina)              |

Se carichi un solo video completo, va bene ripeterlo su ogni scheda: ognuna deve solo poter "vedere" il proprio segmento.

---

## ERRORI CHE FANNO RESPINGERE (evitali)
- Screencast senza il flusso OAuth iniziale.
- Mostrare solo la conferma nell'app senza aprire FB/IG per provare la pubblicazione reale.
- Video sfocato, veloce, o senza barra degli indirizzi.
- Pubblicare con un account che NON ha un ruolo nell'app (in dev fallisce).
- Instagram: `APP_URL` su localhost → la pubblicazione IG fallisce perché Meta non scarica il media.
