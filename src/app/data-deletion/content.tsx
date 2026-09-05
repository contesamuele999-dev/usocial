"use client";
/**
 * Contenuto (client) della pagina di cancellazione dati: usa l'i18n per
 * mostrare le istruzioni in italiano o inglese secondo la lingua scelta.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { LegalHeader } from "@/components/LegalHeader";

const UPDATED = "21 luglio 2026";
const CONTACT = "umasterinfo@gmail.com";

export function DataDeletionContent() {
  const { t } = useI18n();
  /**
   * Codice di riscontro con cui Meta rimanda qui chi ha chiesto la
   * cancellazione dei dati (vedi /api/meta/data-deletion). Letto da
   * `location` e non con `useSearchParams` per non dover avvolgere la pagina
   * in un <Suspense>: qui serve solo a mostrare una riga di conferma.
   */
  const [code, setCode] = useState("");
  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get("code") || "");
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-gray-800 dark:text-gray-200">
      <LegalHeader />

      <Link href="/" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
        {t("dataDeletion.back")}
      </Link>

      <h1 className="mt-4 text-3xl font-bold">{t("dataDeletion.title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("dataDeletion.updated", { date: UPDATED })}</p>

      <div className="mt-8 space-y-6 leading-relaxed">
        {code && (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950/40">
            <p className="font-semibold">{t("dataDeletion.requestReceived")}</p>
            <p className="mt-1">{t("dataDeletion.requestDone")}</p>
            <p className="mt-1 text-gray-500">
              {t("dataDeletion.requestCode")} <code className="font-mono">{code}</code>
            </p>
          </div>
        )}

        <p>{t("dataDeletion.intro")}</p>

        <section>
          <h2 className="text-xl font-semibold">{t("dataDeletion.optionAppTitle")}</h2>
          <p className="mt-1">{t("dataDeletion.optionAppDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t("dataDeletion.optionEmailTitle")}</h2>
          <p className="mt-1">
            {t("dataDeletion.optionEmailDesc", { email: CONTACT })
              .split(CONTACT)
              .flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      <a key="mail" className="text-brand-600 hover:underline" href={`mailto:${CONTACT}`}>
                        {CONTACT}
                      </a>,
                      part,
                    ]
              )}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t("dataDeletion.whatTitle")}</h2>
          <p className="mt-1">{t("dataDeletion.whatList")}</p>
        </section>

        <p className="text-sm text-gray-500">{t("dataDeletion.metaNote")}</p>
      </div>

      <p className="mt-10 text-sm text-gray-500">
        <Link href="/privacy" className="text-brand-600 hover:underline">
          {t("auth.privacy")}
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="text-brand-600 hover:underline">
          {t("auth.terms")}
        </Link>
      </p>
    </div>
  );
}
