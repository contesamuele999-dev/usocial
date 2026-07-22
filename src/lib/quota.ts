/**
 * Quota di spazio per utente.
 *
 * Contesto: l'app gira su una VM Google Cloud con un disco condiviso (~30 GB).
 * Video e clip di repurpose pesano molto, quindi ogni utente ha un tetto
 * (default 2 GB, vedi USER_QUOTA_MB nel .env) per evitare che un solo account
 * riempia il disco e blocchi il servizio per tutti.
 */
import fs from "node:fs";
import { env } from "./env";
import { mediaUsage, mediaCount } from "./repo";
import { AppError } from "./errors";

export interface QuotaInfo {
  /** Byte occupati dai media dell'utente. */
  used: number;
  /** Byte totali concessi all'utente. */
  limit: number;
  /** Byte ancora disponibili (mai negativo). */
  free: number;
  /** Percentuale di utilizzo, 0-100 arrotondata a 1 decimale. */
  percent: number;
  /** Numero di file. */
  files: number;
  /** true oltre l'80%: la UI mostra un avviso. */
  warning: boolean;
  /** true a quota piena: nuovi caricamenti bloccati. */
  full: boolean;
  /** Spazio libero reale sul disco della VM, se leggibile. */
  diskFree: number | null;
  /** Spazio totale del disco della VM, se leggibile. */
  diskTotal: number | null;
}

/** Spazio libero/totale del filesystem che ospita i media (null se non leggibile). */
function diskStats(): { free: number | null; total: number | null } {
  try {
    // statfsSync è disponibile da Node 18.15+; se manca si degrada a null.
    const st = (fs as unknown as {
      statfsSync?: (p: string) => { bsize: number; blocks: number; bavail: number };
    }).statfsSync?.(env.dataDir);
    if (!st) return { free: null, total: null };
    return { free: st.bsize * st.bavail, total: st.bsize * st.blocks };
  } catch {
    return { free: null, total: null };
  }
}

/** Stato corrente della quota per un utente. */
export function getQuota(userId: number): QuotaInfo {
  const used = mediaUsage(userId);
  const limit = env.userQuotaBytes;
  const free = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;
  const disk = diskStats();
  return {
    used,
    limit,
    free,
    percent,
    files: mediaCount(userId),
    warning: percent >= 80,
    full: used >= limit,
    diskFree: disk.free,
    diskTotal: disk.total,
  };
}

/** Formatta byte in modo leggibile (per i messaggi d'errore). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  // niente decimale superfluo: "2 GB" invece di "2.0 GB"
  const dec = v >= 10 || i === 0 || Number.isInteger(v) ? 0 : 1;
  return `${v.toFixed(dec)} ${units[i]}`;
}

/**
 * Verifica che ci sia spazio per `incoming` byte, altrimenti lancia un errore
 * 413 con un messaggio comprensibile. Da chiamare PRIMA di scrivere su disco.
 */
export function assertQuota(userId: number, incoming: number): QuotaInfo {
  const q = getQuota(userId);
  if (incoming > q.free) {
    throw new AppError(
      `Spazio insufficiente: hai usato ${formatBytes(q.used)} di ${formatBytes(q.limit)}. ` +
        `Questo file occupa ${formatBytes(incoming)}, liberi solo ${formatBytes(q.free)}. ` +
        `Elimina qualche file dalla Libreria per fare spazio.`,
      413
    );
  }
  return q;
}
