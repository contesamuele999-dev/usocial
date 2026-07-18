import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termini di Servizio — uSocial",
  description: "Termini e condizioni d'uso di uSocial.",
};

const UPDATED = "18 luglio 2026";
const CONTACT = "umasterinfo@gmail.com";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Torna a uSocial
      </Link>

      <h1 className="mt-4 text-3xl font-bold">Termini di Servizio</h1>
      <p className="mt-1 text-sm text-gray-500">Ultimo aggiornamento: {UPDATED}</p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold">1. Accettazione dei termini</h2>
          <p>
            Utilizzando uSocial accetti i presenti Termini di Servizio. Se non li accetti, non
            utilizzare il servizio. uSocial è uno strumento self-hosted per creare, programmare e
            pubblicare contenuti sui social network.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Descrizione del servizio</h2>
          <p>
            uSocial ti consente di redigere post, allegare immagini e video, programmarne la
            pubblicazione e inviarli agli account social che colleghi (Facebook, Instagram,
            LinkedIn, YouTube, TikTok) tramite le loro API ufficiali. Offre inoltre suggerimenti
            di testo generati tramite intelligenza artificiale.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Account e sicurezza</h2>
          <p>
            Sei responsabile della riservatezza delle tue credenziali e di tutte le attività
            svolte tramite il tuo account. Devi fornire informazioni corrette in fase di
            registrazione e mantenere sicura la tua password.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Collegamento agli account social</h2>
          <p>
            Quando colleghi un account social, autorizzi uSocial a pubblicare contenuti per tuo
            conto tramite i token OAuth rilasciati dalla piattaforma. Puoi revocare questa
            autorizzazione in qualsiasi momento, sia da uSocial sia dalle impostazioni della
            piattaforma social. Sei tenuto a rispettare i termini e le policy delle piattaforme
            che utilizzi.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Contenuti e tue responsabilità</h2>
          <p>
            Sei l&apos;unico responsabile dei contenuti che crei e pubblichi tramite uSocial.
            Ti impegni a non pubblicare contenuti illeciti, che violino diritti di terzi (incluso
            il copyright), diffamatori, ingannevoli o che violino le regole delle piattaforme
            social di destinazione. uSocial è un semplice strumento di pubblicazione e non
            controlla né approva i contenuti degli utenti.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Uso accettabile</h2>
          <p>
            Ti impegni a non usare uSocial per inviare spam, contenuti automatizzati abusivi o
            attività che violino le leggi applicabili o i termini delle piattaforme collegate. Un
            uso improprio può compromettere i tuoi account social.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Servizi di terze parti</h2>
          <p>
            uSocial si integra con servizi di terze parti (le API dei social network e il provider
            di AI). L&apos;uso di tali servizi è soggetto ai rispettivi termini. Non siamo
            responsabili di modifiche, malfunzionamenti o interruzioni di questi servizi esterni.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Esclusione di garanzie</h2>
          <p>
            uSocial è fornito &quot;così com&apos;è&quot;, senza garanzie di alcun tipo. Non
            garantiamo che il servizio sia sempre disponibile, privo di errori o che le
            pubblicazioni programmate vadano sempre a buon fine (ad es. per limiti o cambiamenti
            delle API dei social).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Limitazione di responsabilità</h2>
          <p>
            Nei limiti consentiti dalla legge, il titolare di uSocial non è responsabile per danni
            diretti o indiretti derivanti dall&apos;uso o dall&apos;impossibilità di usare il
            servizio, inclusa la perdita di dati o la mancata pubblicazione di contenuti.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Modifiche e cessazione</h2>
          <p>
            Possiamo modificare o interrompere il servizio e aggiornare questi termini in qualsiasi
            momento. Le modifiche saranno pubblicate su questa pagina con la nuova data di
            aggiornamento. L&apos;uso continuato del servizio comporta l&apos;accettazione dei
            termini aggiornati.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11. Contatti</h2>
          <p>
            Per domande su questi Termini scrivi a{" "}
            <a className="text-brand-600 hover:underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm text-gray-500">
        Vedi anche la nostra{" "}
        <Link href="/privacy" className="text-brand-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
