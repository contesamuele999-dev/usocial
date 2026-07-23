"use client";
/**
 * Informativa privacy, bilingue (it/en) in base alla lingua scelta nell'app.
 */
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const UPDATED_IT = "18 luglio 2026";
const UPDATED_EN = "July 18, 2026";
const CONTACT = "umasterinfo@gmail.com";

export function PrivacyContent() {
  const { lang } = useI18n();
  const en = lang === "en";
  const mail = (
    <a className="text-brand-600 hover:underline" href={`mailto:${CONTACT}`}>
      {CONTACT}
    </a>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/icon.png" alt="uSocial" width={40} height={40} className="rounded-lg" priority />
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">uSocial</span>
      </Link>

      <Link href="/" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
        {en ? "← Back to uSocial" : "← Torna a uSocial"}
      </Link>

      <h1 className="mt-4 text-3xl font-bold">uSocial Privacy Policy</h1>
      <p className="mt-1 text-sm text-gray-500">
        {en ? `Last updated: ${UPDATED_EN}` : `Ultimo aggiornamento: ${UPDATED_IT}`}
      </p>

      <div className="mt-8 space-y-6 leading-relaxed">
        {en ? (
          <>
            <section>
              <h2 className="text-xl font-semibold">1. Who we are</h2>
              <p>
                uSocial is a self-hosted tool for creating, scheduling and publishing content to
                social networks (Facebook, Instagram, LinkedIn, YouTube and TikTok). This instance is
                run independently by the account owner and the data resides on the server they
                control. For any privacy request you can write to {mail}.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">2. Data we collect</h2>
              <p>To run the service we process:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>uSocial account data:</strong> the name, email address and password (stored
                  hashed) you provide when registering.
                </li>
                <li>
                  <strong>Content you create:</strong> the text, images, videos and captions of the
                  posts you write and schedule, along with their publish dates.
                </li>
                <li>
                  <strong>Social connection credentials:</strong> the access (OAuth) tokens issued by
                  Facebook, Instagram, LinkedIn, YouTube and TikTok when you connect your accounts.
                  They are used solely to publish on your behalf.
                </li>
                <li>
                  <strong>Minimal technical data:</strong> operational logs needed for functioning and
                  security (e.g. the outcome of scheduled publications).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">3. How we use the data</h2>
              <p>We use the data only to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>authenticate you and let you access your account;</li>
                <li>create, save and schedule your content;</li>
                <li>
                  publish posts to the social networks you connected, through their official APIs and
                  within the permissions you granted;
                </li>
                <li>
                  generate, at your request, text suggestions via an artificial intelligence service
                  (see point 5).
                </li>
              </ul>
              <p className="mt-2">We do not sell your data and do not use it for advertising or profiling.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">4. Data from the social platforms</h2>
              <p>
                When you connect an account (for example TikTok), the platform provides us with a token
                and the minimum information needed to publish on your behalf (e.g. profile/channel
                identifier). We use this data only for the publishing operation you requested. We do
                not access your private content beyond what is strictly necessary and we comply with
                the terms of the respective platforms, including the{" "}
                <a
                  className="text-brand-600 hover:underline"
                  href="https://developers.tiktok.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  TikTok Developer Policy
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">5. Artificial intelligence</h2>
              <p>
                If you use the AI assistant feature, the text you submit to get suggestions is sent to
                the configured AI provider (e.g. Google Gemini) for the sole purpose of generating the
                response. Please do not enter sensitive personal data in the prompts.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">6. Data retention</h2>
              <p>
                Data is kept as long as you keep your account and social connections active. You can
                delete content, disconnect a social (thereby revoking its token) or request account
                deletion at any time. See the{" "}
                <Link href="/data-deletion" className="text-brand-600 hover:underline">
                  data deletion instructions
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">7. Sharing with third parties</h2>
              <p>
                We share data only with the services essential to functioning: the APIs of the social
                networks you connect and the AI provider you choose. We do not transfer your data to
                other parties for commercial purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">8. Your rights</h2>
              <p>
                You have the right to access, correct and delete your data, to export it and to revoke
                consents to social connections. To exercise these rights use the features in{" "}
                <em>Settings</em> or write to {mail}.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">9. Changes</h2>
              <p>
                We may update this policy. Changes will be posted on this page with the new update
                date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">10. Contact</h2>
              <p>For questions about this Privacy Policy write to {mail}.</p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 className="text-xl font-semibold">1. Chi siamo</h2>
              <p>
                uSocial è uno strumento self-hosted per la creazione, programmazione e pubblicazione
                di contenuti sui social network (Facebook, Instagram, LinkedIn, YouTube e TikTok).
                Questa istanza è gestita in autonomia dal titolare dell&apos;account e i dati risiedono
                sul server da lui controllato. Per qualsiasi richiesta relativa alla privacy puoi
                scrivere a {mail}.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">2. Dati che raccogliamo</h2>
              <p>Per far funzionare il servizio trattiamo:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Dati dell&apos;account uSocial:</strong> nome, indirizzo email e password
                  (memorizzata in forma cifrata) che fornisci in fase di registrazione.
                </li>
                <li>
                  <strong>Contenuti che crei:</strong> testi, immagini, video e didascalie dei post che
                  redigi e programmi, insieme alle relative date di pubblicazione.
                </li>
                <li>
                  <strong>Credenziali di collegamento ai social:</strong> i token di accesso (OAuth)
                  rilasciati da Facebook, Instagram, LinkedIn, YouTube e TikTok quando colleghi i tuoi
                  account. Servono esclusivamente a pubblicare per tuo conto.
                </li>
                <li>
                  <strong>Dati tecnici minimi:</strong> log operativi necessari al funzionamento e alla
                  sicurezza (ad es. esito delle pubblicazioni programmate).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">3. Come usiamo i dati</h2>
              <p>Utilizziamo i dati unicamente per:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>autenticarti e permetterti di accedere al tuo account;</li>
                <li>creare, salvare e programmare i tuoi contenuti;</li>
                <li>
                  pubblicare i post sui social network che hai collegato, tramite le loro API ufficiali
                  e nei limiti dei permessi che hai concesso;
                </li>
                <li>
                  generare, su tua richiesta, suggerimenti di testo tramite un servizio di intelligenza
                  artificiale (vedi punto 5).
                </li>
              </ul>
              <p className="mt-2">Non vendiamo i tuoi dati e non li usiamo per pubblicità o profilazione.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">4. Dati provenienti dalle piattaforme social</h2>
              <p>
                Quando colleghi un account (ad esempio TikTok), la piattaforma ci fornisce un token e le
                informazioni minime necessarie a pubblicare per tuo conto (ad es. identificativo del
                profilo/canale). Usiamo questi dati solo per l&apos;operazione di pubblicazione da te
                richiesta. Non accediamo ai tuoi contenuti privati oltre a quanto strettamente
                necessario e rispettiamo i termini delle rispettive piattaforme, tra cui la{" "}
                <a
                  className="text-brand-600 hover:underline"
                  href="https://developers.tiktok.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  TikTok Developer Policy
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">5. Intelligenza artificiale</h2>
              <p>
                Se usi la funzione di assistenza AI, il testo che invii per ottenere suggerimenti viene
                trasmesso al provider di AI configurato (ad es. Google Gemini) al solo scopo di generare
                la risposta. Ti invitiamo a non inserire dati personali sensibili nei prompt.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">6. Conservazione dei dati</h2>
              <p>
                I dati restano memorizzati finché mantieni attivo il tuo account e i collegamenti ai
                social. Puoi eliminare i contenuti, scollegare un social (revocando così il relativo
                token) o richiedere la cancellazione dell&apos;account in qualsiasi momento. Vedi le{" "}
                <Link href="/data-deletion" className="text-brand-600 hover:underline">
                  istruzioni per la cancellazione dei dati
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">7. Condivisione con terze parti</h2>
              <p>
                Condividiamo dati solo con i servizi indispensabili al funzionamento: le API dei social
                network che colleghi e il provider di AI che scegli. Non trasferiamo i tuoi dati ad altri
                soggetti per finalità commerciali.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">8. I tuoi diritti</h2>
              <p>
                Hai diritto di accedere, correggere ed eliminare i tuoi dati, di esportarli e di revocare
                i consensi ai collegamenti social. Per esercitare questi diritti usa le funzioni presenti
                in <em>Impostazioni</em> oppure scrivi a {mail}.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">9. Modifiche</h2>
              <p>
                Potremmo aggiornare questa informativa. Le modifiche saranno pubblicate su questa pagina
                con la nuova data di aggiornamento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">10. Contatti</h2>
              <p>Per domande su questa Privacy Policy scrivi a {mail}.</p>
            </section>
          </>
        )}
      </div>

      <p className="mt-10 text-sm text-gray-500">
        {en ? "See also our " : "Vedi anche i nostri "}
        <Link href="/terms" className="text-brand-600 hover:underline">
          {en ? "Terms of Service" : "Termini di Servizio"}
        </Link>
        .
      </p>
    </div>
  );
}
