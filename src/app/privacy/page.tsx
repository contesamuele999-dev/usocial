import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — uSocial",
  description: "Informativa sulla privacy di uSocial.",
};

const UPDATED = "18 luglio 2026";
const CONTACT = "umasterinfo@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Torna a uSocial
      </Link>

      <h1 className="mt-4 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-1 text-sm text-gray-500">Ultimo aggiornamento: {UPDATED}</p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold">1. Chi siamo</h2>
          <p>
            uSocial è uno strumento self-hosted per la creazione, programmazione e
            pubblicazione di contenuti sui social network (Facebook, Instagram, LinkedIn,
            YouTube e TikTok). Questa istanza è gestita in autonomia dal titolare
            dell&apos;account e i dati risiedono sul server da lui controllato. Per qualsiasi
            richiesta relativa alla privacy puoi scrivere a{" "}
            <a className="text-brand-600 hover:underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
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
              <strong>Contenuti che crei:</strong> testi, immagini, video e didascalie dei post
              che redigi e programmi, insieme alle relative date di pubblicazione.
            </li>
            <li>
              <strong>Credenziali di collegamento ai social:</strong> i token di accesso (OAuth)
              rilasciati da Facebook, Instagram, LinkedIn, YouTube e TikTok quando colleghi i tuoi
              account. Servono esclusivamente a pubblicare per tuo conto.
            </li>
            <li>
              <strong>Dati tecnici minimi:</strong> log operativi necessari al funzionamento e
              alla sicurezza (ad es. esito delle pubblicazioni programmate).
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
              pubblicare i post sui social network che hai collegato, tramite le loro API
              ufficiali e nei limiti dei permessi che hai concesso;
            </li>
            <li>
              generare, su tua richiesta, suggerimenti di testo tramite un servizio di
              intelligenza artificiale (vedi punto 5).
            </li>
          </ul>
          <p className="mt-2">
            Non vendiamo i tuoi dati e non li usiamo per pubblicità o profilazione.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Dati provenienti dalle piattaforme social</h2>
          <p>
            Quando colleghi un account (ad esempio TikTok), la piattaforma ci fornisce un token e
            le informazioni minime necessarie a pubblicare per tuo conto (ad es. identificativo
            del profilo/canale). Usiamo questi dati solo per l&apos;operazione di pubblicazione da
            te richiesta. Non accediamo ai tuoi contenuti privati oltre a quanto strettamente
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
            trasmesso al provider di AI configurato (ad es. Google Gemini) al solo scopo di
            generare la risposta. Ti invitiamo a non inserire dati personali sensibili nei prompt.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Conservazione dei dati</h2>
          <p>
            I dati restano memorizzati finché mantieni attivo il tuo account e i collegamenti ai
            social. Puoi eliminare i contenuti, scollegare un social (revocando così il relativo
            token) o richiedere la cancellazione dell&apos;account in qualsiasi momento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Condivisione con terze parti</h2>
          <p>
            Condividiamo dati solo con i servizi indispensabili al funzionamento: le API dei social
            network che colleghi e il provider di AI che scegli. Non trasferiamo i tuoi dati ad
            altri soggetti per finalità commerciali.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. I tuoi diritti</h2>
          <p>
            Hai diritto di accedere, correggere ed eliminare i tuoi dati, di esportarli e di
            revocare i consensi ai collegamenti social. Per esercitare questi diritti usa le
            funzioni presenti in <em>Impostazioni</em> oppure scrivi a{" "}
            <a className="text-brand-600 hover:underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Modifiche</h2>
          <p>
            Potremmo aggiornare questa informativa. Le modifiche saranno pubblicate su questa
            pagina con la nuova data di aggiornamento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Contatti</h2>
          <p>
            Per domande su questa Privacy Policy scrivi a{" "}
            <a className="text-brand-600 hover:underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm text-gray-500">
        Vedi anche i nostri{" "}
        <Link href="/terms" className="text-brand-600 hover:underline">
          Termini di Servizio
        </Link>
        .
      </p>
    </div>
  );
}
