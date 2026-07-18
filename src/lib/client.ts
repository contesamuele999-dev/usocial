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

export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Bozza", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Programmato", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  publishing: { label: "In pubblicazione…", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  published: { label: "Pubblicato", className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  partial: { label: "Parziale", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  failed: { label: "Fallito", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  pending: { label: "In attesa", className: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

/** Formatta una data ISO in stile italiano compatto. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo orario HH:MM. */
export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/** Etichetta per un target fallito con retry programmato (o null se non c'è retry). */
export function retryInfo(target: { status: string; nextRetryAt: string | null }): string | null {
  if (target.status !== "failed" || !target.nextRetryAt) return null;
  if (new Date(target.nextRetryAt).getTime() <= Date.now()) return "Nuovo tentativo a breve…";
  return `Nuovo tentativo alle ${fmtTime(target.nextRetryAt)}`;
}
