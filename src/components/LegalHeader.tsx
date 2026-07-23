"use client";
/**
 * Intestazione condivisa per le pagine legali pubbliche (privacy, termini,
 * cancellazione dati), che sono renderizzate SENZA la sidebar/Shell.
 *
 * - Mostra l'icona e il nome "uSocial" (richiesto dalla review TikTok).
 * - Include un selettore di lingua inline (it/en).
 * - Default INGLESE su queste pagine: se l'utente non ha ancora scelto
 *   esplicitamente una lingua in questa sessione, forza "en".
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";

export function LegalHeader() {
  const { lang, setLang } = useI18n();
  const forced = useRef(false);

  // Default inglese: solo al primo mount e solo se l'utente non ha già
  // salvato una preferenza esplicita in localStorage.
  useEffect(() => {
    if (forced.current) return;
    forced.current = true;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("lang");
    } catch {}
    if (saved !== "it" && saved !== "en") {
      setLang("en");
    }
  }, [setLang]);

  return (
    <div className="flex items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/icon.png" alt="uSocial" width={40} height={40} className="rounded-lg" priority />
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">uSocial</span>
      </Link>

      <label className="shrink-0">
        <span className="sr-only">Language</span>
        <select
          className="input text-sm"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          title="Language"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
