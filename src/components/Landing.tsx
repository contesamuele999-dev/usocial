"use client";
/**
 * Landing pubblica mostrata su "/" agli utenti NON autenticati.
 * Deve essere una pagina "reale" e completa (requisito review TikTok:
 * il sito pubblico non può essere una semplice pagina di login).
 * Include icona + nome app, selettore lingua e link a Privacy/Termini.
 */
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LegalHeader } from "@/components/LegalHeader";

export function Landing() {
  const { lang } = useI18n();
  const en = lang === "en";

  const features = en
    ? [
        { icon: "✍️", title: "Write once, publish everywhere", body: "Compose a post a single time and publish it to Facebook, Instagram, LinkedIn, YouTube and TikTok." },
        { icon: "🗓️", title: "Schedule ahead", body: "Plan your content on a calendar and let uSocial publish automatically at the right time." },
        { icon: "🤖", title: "AI assistant", body: "Generate captions, hashtags and subtitles with the built-in AI assistant." },
        { icon: "🔒", title: "Self-hosted & private", body: "Runs on your own server. Your data and social tokens never leave your instance." },
      ]
    : [
        { icon: "✍️", title: "Scrivi una volta, pubblica ovunque", body: "Componi un post una sola volta e pubblicalo su Facebook, Instagram, LinkedIn, YouTube e TikTok." },
        { icon: "🗓️", title: "Programma in anticipo", body: "Pianifica i contenuti su un calendario e lascia che uSocial li pubblichi automaticamente al momento giusto." },
        { icon: "🤖", title: "Assistente AI", body: "Genera didascalie, hashtag e sottotitoli con l'assistente AI integrato." },
        { icon: "🔒", title: "Self-hosted e privato", body: "Gira sul tuo server. I tuoi dati e i token social non lasciano mai la tua istanza." },
      ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <LegalHeader />

        <section className="mt-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
            uSocial
          </h1>
          <p className="mt-3 text-xl text-gray-600 dark:text-gray-300">
            {en ? "Social Publisher AI" : "Social Publisher AI"}
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-700 dark:text-gray-300">
            {en
              ? "uSocial is a tool to create, schedule and publish content across your social networks from one place — with an AI assistant to help you write."
              : "uSocial è uno strumento per creare, programmare e pubblicare contenuti su tutti i tuoi social da un unico posto — con un assistente AI che ti aiuta a scrivere."}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="btn-primary">
              {en ? "Log in" : "Accedi"}
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
            >
              {en ? "Create an account" : "Crea un account"}
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{f.title}</h3>
              <p className="mt-1 text-gray-600 dark:text-gray-300">{f.body}</p>
            </div>
          ))}
        </section>

        <footer className="mt-20 border-t border-gray-200 pt-8 text-center text-sm text-gray-500 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/privacy" className="text-brand-600 hover:underline">
              {en ? "Privacy Policy" : "Privacy Policy"}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="text-brand-600 hover:underline">
              {en ? "Terms of Service" : "Termini di Servizio"}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/data-deletion" className="text-brand-600 hover:underline">
              {en ? "Data deletion" : "Cancellazione dati"}
            </Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} uSocial</p>
        </footer>
      </div>
    </div>
  );
}
