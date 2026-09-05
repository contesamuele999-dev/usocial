/**
 * Helper per il frontend: chiamate API tipizzate + tipi condivisi con il backend.
 */
import type { PlatformLimits } from "@/social/types";
import type { MediaItem, Platform } from "@/types";

/** Info piattaforma restituita da GET /api/platforms. */
export interface PlatformInfo {
  platform: Platform;
  displayName: string;
  color: string;
  limits: PlatformLimits;
  connected: boolean;
  accountName: string | null;
  expiresAt: string | null;
  /** true = il token viene rinnovato automaticamente prima della scadenza. */
  autoRenew?: boolean;
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

/**
 * Elenco piattaforme, memorizzato per la durata della sessione di navigazione.
 * Quasi ogni pagina lo richiede: senza cache ogni cambio pagina aggiungeva una
 * chiamata HTTP (e una query per piattaforma) prima di poter disegnare la UI.
 * `getPlatforms(true)` forza il ricaricamento (dopo connessione/disconnessione).
 */
let platformsCache: Promise<PlatformInfo[]> | null = null;
export function getPlatforms(force = false): Promise<PlatformInfo[]> {
  if (force || !platformsCache) {
    platformsCache = api<PlatformInfo[]>("/api/platforms").catch((err) => {
      platformsCache = null; // un errore non deve restare in cache
      throw err;
    });
  }
  return platformsCache;
}

/**
 * Upload di un media con avanzamento reale.
 * Usa XMLHttpRequest perché `fetch` non espone il progresso dell'invio, e manda
 * il file come body raw (il server lo scrive in streaming: niente limiti di RAM).
 */
export function uploadMedia(
  file: File,
  opts?: { folder?: string; onProgress?: (percent: number) => void }
): Promise<MediaItem & { quota?: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    if (opts?.folder) xhr.setRequestHeader("x-folder", opts.folder);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts?.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json: { error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* risposta non JSON: sotto usiamo il codice HTTP */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json as MediaItem);
      else reject(new Error(json.error || `Errore ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Connessione interrotta durante l'upload"));
    xhr.send(file);
  });
}

/**
 * Piattaforme su cui il media non è pubblicabile (tipo di file non accettato,
 * o piattaforma che vuole un video e riceve un'immagine).
 * Ritorna una riga per problema, già pronta da mostrare.
 */
export function mediaWarnings(
  items: { originalName: string; mime: string }[],
  platforms: PlatformInfo[],
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const out: string[] = [];
  const kind = (m: string): "image" | "video" => (m.startsWith("video/") ? "video" : "image");
  const images = items.filter((it) => kind(it.mime) === "image").length;
  const videos = items.length - images;

  for (const p of platforms) {
    for (const it of items) {
      const okType = p.limits.mediaTypes.includes(kind(it.mime));
      const okMime = !p.limits.mimeTypes || p.limits.mimeTypes.includes(it.mime);
      if (!okType || !okMime) {
        out.push(
          t("mediaPicker.warnFormat", {
            file: it.originalName,
            mime: it.mime,
            platform: p.displayName,
          })
        );
      }
    }
    if (items.length > p.limits.maxMedia) {
      out.push(
        t("mediaPicker.warnTooMany", {
          platform: p.displayName,
          max: p.limits.maxMedia,
          n: items.length,
        })
      );
    }
    // Tetto per tipo: TikTok accetta 35 foto ma un solo video, e `maxMedia` da
    // solo lascerebbe passare due video senza dire nulla.
    for (const [k, n, key] of [
      ["image", images, "mediaPicker.warnTooManyImages"],
      ["video", videos, "mediaPicker.warnTooManyVideos"],
    ] as const) {
      const max = p.limits.maxMediaByKind?.[k];
      if (max !== undefined && n > max) {
        out.push(t(key, { platform: p.displayName, max, n }));
      }
    }
    if (p.limits.noMixedMedia && images > 0 && videos > 0) {
      out.push(t("mediaPicker.warnNoMix", { platform: p.displayName }));
    }
    if (p.limits.requiresMedia && items.length === 0) {
      out.push(t("mediaPicker.warnRequired", { platform: p.displayName }));
    }
  }
  return out;
}

/**
 * Accento visivo per stato, usato dal calendario: barra colorata a sinistra,
 * sfondo tenue e un'icona. Serve a distinguere bozza, programmato e pubblicato
 * senza dover aprire il post né leggere il badge.
 *
 * Il colore della barra è un valore, non una classe: `border-l-<colore>`
 * perderebbe contro il `dark:border-gray-700` della chip (due classi contro
 * una) e in tema scuro la barra sparirebbe. Lo sfondo invece è una classe,
 * perché deve cambiare fra tema chiaro e scuro.
 */
export const STATUS_ACCENT: Record<string, { color: string; tint: string; icon: string }> = {
  draft: { color: "#9ca3af", tint: "bg-gray-50 dark:bg-gray-900", icon: "✏️" },
  scheduled: { color: "#3b82f6", tint: "bg-blue-50 dark:bg-blue-950/40", icon: "🕒" },
  publishing: { color: "#f59e0b", tint: "bg-amber-50 dark:bg-amber-950/40", icon: "⏳" },
  published: { color: "#16a34a", tint: "bg-green-50 dark:bg-green-950/40", icon: "✅" },
  partial: { color: "#f97316", tint: "bg-orange-50 dark:bg-orange-950/40", icon: "◑" },
  failed: { color: "#ef4444", tint: "bg-red-50 dark:bg-red-950/40", icon: "⚠️" },
};

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

/** Solo giorno e mese: sull'asse di un grafico l'ora è solo rumore. */
export function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" });
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
