# uSocial — Risposte per la verifica app Meta (secondo invio)

> Compilato dalle funzioni presenti nel codice (`src/social/*`, `src/lib/autoreply.ts`).
> **Nel modulo di Meta incolla il testo EN.** Meta ha chiesto interfaccia in inglese (feedback del
> 12 agosto) e il revisore deve ritrovare nel testo le etichette del video. L'IT serve solo a rileggerlo.
> Ogni descrizione promette **solo quello che si vede nel video**: le bocciature di agosto dicevano
> "screencast non in linea con i dettagli del caso d'uso". Se cambi un video, cambia la descrizione.
> Il numero `[#n]` rimanda al video corrispondente in `meta-screencast-script.md`.

Nella richiesta devono esserci **tutti** questi permessi, compresi i sette bocciati il 12 agosto:
i permessi nuovi dipendono da quelli di base.

---

## CONTESTO GENERALE (da riusare in ogni descrizione)

**EN** — uSocial is a social media management tool. A business owner connects their own professional
accounts (Facebook Page, Instagram Business account, Threads profile), writes a post once and
publishes it to those channels. uSocial also shows post statistics and runs keyword-based auto
replies to comments on the user's own posts. uSocial only acts on accounts the user owns or
administers, after explicit consent through Facebook Login or Threads Login.

**IT** — uSocial è uno strumento di gestione dei social. Chi ha un'attività collega i propri account
professionali (Pagina Facebook, account Instagram Business, profilo Threads), scrive un post una
volta sola e lo pubblica su quei canali. uSocial mostra anche le statistiche dei post e risponde in
automatico, in base a una parola chiave, ai commenti sui post dell'utente. uSocial agisce solo sugli
account di cui l'utente è titolare o amministratore, dopo il consenso esplicito dato con Facebook
Login o Threads Login.

---

# ACCOUNT

## pages_show_list  [#1]

**Uso:** `GET /me/accounts` subito dopo il login, per elencare le Pagine amministrate e ottenere il Page token.

**EN** — uSocial uses pages_show_list right after Facebook Login to retrieve the Pages the user
administers. The user selects the Page to connect in the Facebook dialog; uSocial reads that
Page's access token, which is needed to publish posts and videos, and finds the Instagram
Business account linked to it. Without this permission the user could not choose which Page
uSocial works on.

**IT** — uSocial usa pages_show_list subito dopo il login con Facebook per recuperare le Pagine
amministrate dall'utente. L'utente sceglie la Pagina da collegare nella finestra di Facebook;
uSocial legge il token di accesso di quella Pagina, necessario per pubblicare post e video, e
individua l'account Instagram Business collegato. Senza questo permesso l'utente non potrebbe
scegliere su quale Pagina lavora uSocial.

## business_management  [#2]

**Uso:** accesso alle Pagine e agli account Instagram gestiti tramite un portafoglio business.

**EN** — uSocial uses business_management during account connection to access the business assets the
user manages: the Facebook Page and the Instagram Business account linked to it. Many Pages and
Instagram accounts are owned through a business portfolio, and without this permission uSocial
cannot find the Instagram account connected to the selected Page. Access is limited to assets the
user owns or administers.

**IT** — uSocial usa business_management durante il collegamento dell'account per accedere agli asset
business gestiti dall'utente: la Pagina Facebook e l'account Instagram Business collegato. Molte
Pagine e molti account Instagram appartengono a un portafoglio business, e senza questo permesso
uSocial non riesce a trovare l'account Instagram collegato alla Pagina scelta. L'accesso è limitato
agli asset di cui l'utente è titolare o amministratore.

## pages_read_engagement  [#3]

**Uso:** nome della Pagina in Settings; contatori like/commenti/condivisioni dei post nella pagina Statistiche.

**EN** — uSocial uses pages_read_engagement to read the connected Page's name, shown in Settings as the
publishing destination, and the public engagement counters (likes, comments, shares) of the
posts the user published through uSocial. After "Refresh from socials", these counters are shown
as interactions on the Statistics page, only to the Page owner, so they can see which posts
performed best.

**IT** — uSocial usa pages_read_engagement per leggere il nome della Pagina collegata, mostrato in
Impostazioni come destinazione della pubblicazione, e i contatori pubblici (like, commenti,
condivisioni) dei post che l'utente ha pubblicato con uSocial. Dopo "Aggiorna dai social" questi
contatori compaiono come interazioni nella pagina Statistiche, visibili solo al titolare della
Pagina, per capire quali post sono andati meglio.

## instagram_basic  [#4]

**Uso:** id e username dell'account IG; verifica periodica del token. *(Non instagram_business_basic.)*

**EN** — uSocial uses instagram_basic to read the ID and username of the Instagram Business account linked
to the selected Page and show it in Settings as the account where posts will be published. It is
required before uSocial can publish content or read comments on the account.

**IT** — uSocial usa instagram_basic per leggere l'ID e lo username dell'account Instagram Business
collegato alla Pagina scelta e mostrarlo in Impostazioni come account su cui verranno pubblicati i
post. È necessario prima che uSocial possa pubblicare contenuti o leggere i commenti dell'account.

## public_profile  (rinnovo)

**EN** — uSocial uses public_profile to identify the logged-in user (name and ID) during Facebook Login and
associate the connection with their uSocial account.

**IT** — uSocial usa public_profile per identificare l'utente (nome e ID) durante il login con Facebook
e associare il collegamento al suo account uSocial.

---

# PUBBLICAZIONE

## pages_manage_posts  [#5]

**Uso:** `POST /{page}/feed` e `/{page}/photos` per testo, foto e caroselli.

**EN** — uSocial uses pages_manage_posts to publish on the connected Facebook Page the posts the user
creates in the app: posts with text and a photo. The user writes the post in "New Post",
selects Facebook and clicks "Publish now". uSocial never publishes
without an explicit action by the user.

**IT** — uSocial usa pages_manage_posts per pubblicare sulla Pagina Facebook collegata i post che
l'utente crea nell'app: post con testo e una foto. L'utente scrive il post in "Nuovo Post",
sceglie Facebook e clicca "Pubblica ora". uSocial non pubblica
mai senza un'azione esplicita dell'utente.

## publish_video  [#6]

**Uso:** `POST /{page-id}/videos`.

**EN** — uSocial uses publish_video to upload the videos the user attaches to a post to their Facebook
Page. When the user attaches a video file in "New Post", selects Facebook and clicks "Publish
now", uSocial uploads it to the /{page-id}/videos endpoint of the connected Page with the Page
access token. Uploads happen only on the user's explicit action and only on Pages they administer.

**IT** — uSocial usa publish_video per caricare sulla Pagina Facebook i video che l'utente allega a un
post. Quando l'utente allega un file video in "Nuovo Post", sceglie Facebook e clicca "Pubblica
ora", uSocial lo carica sull'endpoint /{page-id}/videos della Pagina collegata con il token della
Pagina. Il caricamento avviene solo su azione esplicita dell'utente e solo sulle Pagine che
amministra.

## instagram_content_publish  [#7]

**Uso:** container `/media` + `/media_publish` (il codice gestisce anche caroselli e storie; nel video: foto + reel).

**EN** — uSocial uses instagram_content_publish to publish the content the user creates in the app to their
own Instagram Business account: photo posts and video posts (reels). The user writes the caption in
"New Post", attaches the media, selects Instagram and clicks "Publish now". uSocial creates the
media container through the /media endpoint, waits for video processing and publishes with
/media_publish. Publishing happens only on the user's explicit action.

**IT** — uSocial usa instagram_content_publish per pubblicare sul proprio account Instagram Business i
contenuti che l'utente crea nell'app: post con foto e post video (reel). L'utente scrive la caption
in "Nuovo Post", allega il media, sceglie Instagram e clicca "Pubblica ora". uSocial crea il
contenitore del media con l'endpoint /media, attende l'elaborazione dei video e pubblica con
/media_publish. La pubblicazione avviene solo su azione esplicita dell'utente.

## Live Video API  (rinnovo)

**EN** — uSocial lets the user broadcast live video to their Facebook Page from an external encoder such as
OBS. After Facebook Login and Page selection, the user starts a live broadcast in uSocial: the app
creates a live video with POST /{page-id}/live_videos (status LIVE_NOW) and shows the RTMP ingest
URL, the stream key and the public link for viewers. When the user stops the broadcast, uSocial
calls end_live_video. Broadcasts happen only on Pages the user administers and only on their
explicit action.

**IT** — uSocial permette all'utente di trasmettere dirette video sulla propria Pagina Facebook da un
encoder esterno come OBS. Dopo il login con Facebook e la scelta della Pagina, l'utente avvia la
diretta in uSocial: l'app crea un live video con POST /{page-id}/live_videos (stato LIVE_NOW) e
mostra l'URL di ingest RTMP, la stream key e il link pubblico per gli spettatori. Quando l'utente
ferma la diretta, uSocial chiama end_live_video. Le dirette avvengono solo sulle Pagine che l'utente
amministra e solo su sua azione esplicita.

---

# THREADS

## threads_basic  [#8]

**EN** — uSocial uses threads_basic to read the ID and username of the Threads profile the user connects,
and show it in Settings as the profile where posts will be published. It is required by every
other Threads feature in the app.

**IT** — uSocial usa threads_basic per leggere l'ID e lo username del profilo Threads che l'utente
collega e mostrarlo in Impostazioni come profilo su cui verranno pubblicati i post. Serve a tutte
le altre funzioni Threads dell'app.

## threads_content_publish  [#9]

**Uso:** container + `/threads_publish` per testo, immagine, video e carosello.

**EN** — uSocial uses threads_content_publish to publish the posts the user creates in "New Post" to their
own Threads profile: posts with text and an image. The user selects Threads and clicks "Publish
now"; uSocial creates the media container and publishes it with /threads_publish, only on the
user's explicit action.

**IT** — uSocial usa threads_content_publish per pubblicare sul proprio profilo Threads i post che
l'utente crea in "Nuovo Post": post con testo e un'immagine. L'utente sceglie Threads e clicca
"Pubblica ora"; uSocial crea il contenitore del media e lo pubblica con /threads_publish, solo su
azione esplicita dell'utente.

## threads_manage_replies  [#16]

**Uso:** `GET /{post}/replies` e risposta alle risposte dei post pubblicati.

**EN** — uSocial uses threads_manage_replies for its Auto replies feature. The user creates a rule with a
keyword (for example "GUIDE") and a reply text. uSocial reads the replies to the posts the user
published and, when a reply contains the keyword, answers it publicly on the user's behalf. The
user can preview what would be sent with "Dry run" before activating the rule. uSocial never
replies to its own replies and handles each reply only once.

**IT** — uSocial usa threads_manage_replies per la funzione Risposte automatiche. L'utente crea una
regola con una parola chiave (per esempio "GUIDA") e un testo di risposta. uSocial legge le
risposte ai post pubblicati dall'utente e, quando una risposta contiene la parola chiave, risponde
pubblicamente per conto dell'utente. Con "Prova a vuoto" l'utente vede in anteprima cosa verrebbe
inviato prima di attivare la regola. uSocial non risponde mai alle proprie risposte e tratta ogni
risposta una sola volta.

## threads_manage_insights  [#19]

**Uso:** `GET /{post}/insights` (views, likes, replies, reposts, quotes, shares).

**EN** — uSocial uses threads_manage_insights to show the owner of the Threads profile the performance of
the posts they published through the app. After "Refresh from socials", the Statistics page shows
views and interactions (likes, replies, reposts and quotes added together) next to the other
connected channels, visible only to the account owner.

**IT** — uSocial usa threads_manage_insights per mostrare al titolare del profilo Threads i risultati dei
post pubblicati con l'app. Dopo "Aggiorna dai social", la pagina Statistiche mostra
visualizzazioni e interazioni (like, risposte, repost e citazioni sommati) accanto agli altri
canali collegati, visibili solo al titolare dell'account.

---

# COMMENTI E MESSAGGI (Auto replies)

Promemoria: la funzione è **Auto replies / Risposte automatiche**. L'utente crea una regola con una
parola chiave, una risposta pubblica e/o un messaggio privato. uSocial legge i commenti ai post
dell'utente e, se un commento contiene la parola chiave, risponde. "Dry run" mostra l'anteprima
senza inviare nulla. Ogni commento è trattato una sola volta, al massimo un messaggio privato per
commento, entro 7 giorni dal commento.

## pages_read_user_content  [#10]

**Uso:** `GET /{post}/comments?fields=id,message,created_time,from{id,name}`.

**EN** — uSocial uses pages_read_user_content to read the comments that other people leave on the posts
of the user's Facebook Page, including the commenter's name. The Auto replies feature checks each
comment for the keyword set by the Page owner, and the "Dry run" preview shows the Page owner which
comment, from whom, would receive a reply. Comment data is used only to decide and send the reply
and is not shared with third parties.

**IT** — uSocial usa pages_read_user_content per leggere i commenti che altre persone lasciano sui post
della Pagina Facebook dell'utente, compreso il nome di chi commenta. La funzione Risposte
automatiche controlla se ogni commento contiene la parola chiave scelta dal titolare della Pagina,
e l'anteprima "Prova a vuoto" gli mostra quale commento, e di chi, riceverebbe una risposta. I dati
dei commenti servono solo a decidere e inviare la risposta e non vengono condivisi con terzi.

## pages_manage_engagement  [#11]

**Uso:** `POST /{comment-id}/comments`.

**EN** — uSocial uses pages_manage_engagement to reply publicly, as the Page, to comments on the Page's
posts. When a comment matches a keyword rule created by the Page owner in Auto replies (for example
"comment GUIDE and I'll send you the guide"), uSocial posts the reply text the owner wrote under
that comment. Replies are sent only for rules the owner explicitly enabled.

**IT** — uSocial usa pages_manage_engagement per rispondere pubblicamente, come Pagina, ai commenti sui
post della Pagina. Quando un commento corrisponde a una regola con parola chiave creata dal
titolare in Risposte automatiche (per esempio "commenta GUIDA e ti mando la guida"), uSocial
pubblica sotto quel commento il testo di risposta scritto dal titolare. Le risposte partono solo
per le regole che il titolare ha attivato esplicitamente.

## pages_messaging  [#12]

**Uso:** `POST /{page-id}/messages` con `recipient: { comment_id }` (private reply).

**EN** — uSocial uses pages_messaging to send a single private reply from the Page to a person who
commented on the Page's post with the keyword of an Auto replies rule, for example to deliver the
guide they asked for in the comment. The message is sent through the private replies flow, tied to
that comment, at most once per comment and within 7 days of the comment. uSocial does not send
promotional or unsolicited messages.

**IT** — uSocial usa pages_messaging per inviare, dalla Pagina, un'unica risposta privata a chi ha
commentato un post della Pagina con la parola chiave di una regola di Risposte automatiche, per
esempio per consegnare la guida richiesta nel commento. Il messaggio passa dal flusso delle
risposte private, è legato a quel commento, parte al massimo una volta per commento ed entro 7
giorni dal commento. uSocial non invia messaggi promozionali o non richiesti.

## pages_manage_metadata  [#15]

**EN** — uSocial requests pages_manage_metadata because Meta requires it, together with the messaging
permissions, to send private replies from the Page connected to an Instagram account. It is used
only as a prerequisite of the private reply feature described under instagram_manage_messages; no
Page settings are changed.

**IT** — uSocial richiede pages_manage_metadata perché Meta lo esige, insieme ai permessi sui
messaggi, per inviare risposte private dalla Pagina collegata a un account Instagram. Viene usato
solo come prerequisito della funzione di risposta privata descritta in instagram_manage_messages;
nessuna impostazione della Pagina viene modificata.

## instagram_manage_comments  [#13]

**Uso:** `GET /{media}/comments` e risposta ai commenti.

**EN** — uSocial uses instagram_manage_comments to read comments on the posts of the user's Instagram
Business account and reply to them publicly. When a comment contains the keyword of an Auto
replies rule the owner enabled, uSocial posts the owner's reply text under that comment. The "Dry
run" preview lets the owner check the matched comments before anything is sent.

**IT** — uSocial usa instagram_manage_comments per leggere i commenti ai post dell'account Instagram
Business dell'utente e rispondere pubblicamente. Quando un commento contiene la parola chiave di
una regola di Risposte automatiche attivata dal titolare, uSocial pubblica sotto quel commento il
testo di risposta scritto dal titolare. L'anteprima "Prova a vuoto" permette di controllare i
commenti individuati prima che venga inviato qualcosa.

## instagram_manage_messages  [#14]

**Uso:** `POST /{ig-user-id}/messages` con `recipient: { comment_id }`, tramite il token della Pagina.

**EN** — uSocial uses instagram_manage_messages to send one private reply (Direct message) to a person who
commented on the user's Instagram post with the keyword of an Auto replies rule, for example to
send the resource they asked for. The message is linked to that comment, sent at most once per
comment and within 7 days of it. uSocial does not start conversations with people who did not
comment.

**IT** — uSocial usa instagram_manage_messages per inviare un'unica risposta privata (messaggio Direct)
a chi ha commentato un post Instagram dell'utente con la parola chiave di una regola di Risposte
automatiche, per esempio per mandare la risorsa richiesta. Il messaggio è legato a quel commento,
parte al massimo una volta per commento ed entro 7 giorni dal commento. uSocial non avvia
conversazioni con persone che non hanno commentato.

---

# STATISTICHE

## read_insights  [#17]

**Uso:** `GET /{post}/insights?metric=post_impressions,post_impressions_unique,post_clicks`.

**EN** — uSocial uses read_insights to show the Page owner how the posts they published through uSocial
performed on their Facebook Page. uSocial reads each post's impressions from Page Insights and,
after "Refresh from socials", shows them as views on the Statistics page, per channel and per
post, visible only to the owner of the account.

**IT** — uSocial usa read_insights per mostrare al titolare della Pagina come sono andati sulla Pagina
Facebook i post pubblicati con uSocial. uSocial legge le impression di ogni post dagli Insights
della Pagina e, dopo "Aggiorna dai social", le mostra come visualizzazioni nella pagina
Statistiche, per canale e per post, visibili solo al titolare dell'account.

## instagram_manage_insights  [#18]

**Uso:** `GET /{media}/insights?metric=views,reach,saved,shares` (storie: views, reach, replies).

**EN** — uSocial uses instagram_manage_insights to show the owner of the Instagram Business account the
performance of the posts they published through uSocial. After "Refresh from socials", the
Statistics page shows each post's views and interactions (likes, comments, saves and shares added
together), visible only to the account owner.

**IT** — uSocial usa instagram_manage_insights per mostrare al titolare dell'account Instagram Business
i risultati dei post pubblicati con uSocial. Dopo "Aggiorna dai social", la pagina Statistiche
mostra visualizzazioni e interazioni di ogni post (like, commenti, salvataggi e condivisioni
sommati), visibili solo al titolare dell'account.
