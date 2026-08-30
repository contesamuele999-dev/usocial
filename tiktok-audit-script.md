# uSocial — Script di registrazione per l'audit TikTok (Direct Post)

Obiettivo: dimostrare al revisore che la UI di pubblicazione rispetta le
[Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines).
L'audit non giudica il codice, giudica **cosa si vede a schermo**.

Vincoli del form: fino a 3 file MP4, massimo 50 MB ciascuno. Registra a schermo
intero con la barra degli indirizzi visibile, muoviti lentamente, lascia ogni
schermata 2-3 secondi. Se il video supera i 50 MB, taglialo nei tre segmenti qui sotto.

Prima di registrare, verifica che siano vere tutte queste cose — sono i punti su
cui l'audit boccia:

- [ ] il nome dell'account TikTok su cui si pubblica è visibile nella schermata di pubblicazione
- [ ] il selettore "Chi può vedere questo video" parte **vuoto** (nessun default preselezionato)
- [ ] commenti / duetto / stitch sono mostrati, e quelli disattivati sul profilo TikTok appaiono spenti e non cliccabili
- [ ] è presente la dichiarazione di contenuto promozionale (il tuo brand / sponsorizzato)
- [ ] è visibile la riga di consenso con il link alla Music Usage Confirmation
- [ ] il video pubblicato compare davvero sul profilo TikTok a fine flusso

---

## Segmento 1 — Autorizzazione (obbligatorio)

1. Parti da uSocial **disconnesso** da TikTok: Impostazioni → TikTok non collegato.
2. Clicca **Collega TikTok**. Mostra per intero la pagina di autorizzazione di
   TikTok: nome dell'app, elenco dei permessi richiesti, pulsante Authorize.
3. Autorizza. Torna su uSocial e inquadra l'account collegato con il suo nome.

Questo copre il punto 1 richiesto dal form ("User flow of TikTok authorization page").

## Segmento 2 — La schermata di pubblicazione (è quella che decide l'esito)

4. Vai su **Nuovo post**, scrivi un testo e allega un video.
5. Spunta **TikTok**. Inquadra il pannello che compare e fermati su ogni elemento:
   - "Pubblichi come" con avatar e nome dell'account;
   - **Chi può vedere questo video**: apri la tendina mostrando che è vuota e che
     i valori arrivano dall'account (Tutti / Amici / Solo io), poi scegli;
   - **Consenti agli utenti di**: commentare, duetto, stitch. Se sul profilo ne hai
     disattivato uno, mostralo spento e prova a cliccarlo per far vedere che è bloccato;
   - **Dichiara contenuto promozionale**: attiva "Contenuto sponsorizzato" e mostra
     che "Solo io" diventa non selezionabile, poi decidi se lasciarlo attivo;
   - la riga di consenso in fondo, con il link alla Music Usage Confirmation.

Questo copre il punto 2 ("User flow to the Export/Post-to-TikTok page").

## Segmento 3 — Pubblicazione ed esito

6. Clicca **Pubblica ora** e conferma. Mostra lo stato che passa a "Pubblicazione…".
7. Attendi l'esito e inquadra la sezione **Esiti** con TikTok su "pubblicato".
8. Apri l'app o il sito TikTok sul profilo e mostra **il video effettivamente online**,
   con la privacy che avevi scelto al passo 5.

Questo copre i punti 3 e 4 ("User flow after the Export/Post-to-TikTok action is triggered").

---

## Campo "API response data fields saved in its database"

```
Access credentials, from /v2/oauth/token/:
- access_token, refresh_token, scope
- expires_in (converted to and stored as an absolute expiry timestamp)

Creator identity, from /v2/user/info/:
- open_id — stored as the identifier of the linked account
- display_name — shown in the UI so the user knows which account is connected

Publishing, from /v2/post/publish/video/init/ and /v2/post/publish/inbox/video/init/:
- publish_id — stored to track the outcome of each publication
- error.code, error.message and log_id — stored as plain text only when a request
  fails, for troubleshooting

Not stored: upload_url (kept in memory for the duration of the upload only), any
creator_info field, and the video file itself, which is deleted from disk after a
successful publication.

All data is kept in a self-hosted single-user SQLite database, is never shared with
third parties, and every token is deleted when the user disconnects the account.
```

## Nota sul momento in cui registrare

Finché l'audit non è approvato, il Direct Post su un account **pubblico** risponde
`403 unaudited_client_can_only_post_to_private_accounts`: il segmento 3 non si
riesce a girare. Per registrarlo metti temporaneamente l'account TikTok su
**privato** — il Direct Post passa, il video finisce online come "Solo io" e il
flusso mostrato è esattamente quello che il revisore deve vedere.
