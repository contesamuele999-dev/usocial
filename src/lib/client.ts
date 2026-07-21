/**
 * Helper per il frontend: chiamate API tipizzate + tipi condivisi con il backend.
 */
import type { PlatformLimits } from "@/social/types";
import type { Platform } from "@/types";

/** Info piattaforma restituita da GET /api/platforms. */
export interface PlatformInfo {
  platform: Platform;
  displayName: string;
  color: string;
  limits: PlatformLimits;
  connected: boolean;
  accountName: string | null;
  expiresAt: string | null;
}

/** fetch con gestione errori uniforme: lancia Error con il messaggio del server. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });
  // Sessione scaduta/assente: torna al login (tranne che sulle pagine pubbliche)
  if (res.status === 401 && typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path !== "/login" && path !== "/register") {
      window.location.href = "/login";
    }
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || `Errore ${res.status}`);
  }
  return json as T;
}

/** Classi CSS del badge per ogni stato. L'etichetta testuale è tradotta via i18n (`status.<stato>`). */
export const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  publishing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  published: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  partial: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  pending: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

/** Locale corrente per la formattazione di date/ore, aggiornato dal LanguageProvider. */
let dateLocale = "it-IT";
export function setDateLocale(locale: string): void {
  dateLocale = locale;
}

/** Formatta una data ISO in stile compatto secondo la lingua attiva. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(dateLocale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo orario HH:MM. */
export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Etichetta per un target fallito con retry programmato (o null se non c'è retry).
 * `t` è la funzione di traduzione (i18n); se omessa usa un fallback neutro.
 */
export function retryInfo(
  target: { status: string; nextRetryAt: string | null },
  t?: (key: string, vars?: Record<string, string | number>) => string
): string | null {
  if (target.status !== "failed" || !target.nextRetryAt) return null;
  const soon = new Date(target.nextRetryAt).getTime() <= Date.now();
  if (!t) return soon ? "…" : fmtTime(target.nextRetryAt);
  return soon ? t("retry.soon") : t("retry.at", { time: fmtTime(target.nextRetryAt) });
}
