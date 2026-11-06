/**
 * Avviso "contenuti in esaurimento": per ogni account social collegato si
 * guarda l'ultimo post programmato ancora da pubblicare. Se cade entro 7
 * giorni (o non ce n'è nessuno) si manda un'email all'utente, una sola che
 * elenca tutti i suoi account in esaurimento.
 *
 * Dedup: in settings `content_alert:<platform>` tiene la data dell'ultimo post
 * già segnalato. Si riavvisa solo quando cambia (nuovi contenuti programmati
 * e poi di nuovo in esaurimento), non a ogni giro dello scheduler.
 */
import { getDb, getSetting, setSetting } from "./db";
import { env } from "./env";
import { emailUser, mailEnabled } from "./mail";

export const ALERT_WINDOW_MS = 7 * 86400_000;

export interface CoverageRow {
  userId: number;
  platform: string;
  accountName: string;
  /** Ultimo post programmato futuro per questo account; null = nessuno. */
  lastAt: string | null;
}

/** Valore salvato per il dedup: la data coperta, o "none". */
const marker = (r: CoverageRow) => r.lastAt ?? "none";

/** Decide quali account vanno segnalati. Pura: niente DB, niente rete. */
export function pickAlerts(
  rows: CoverageRow[],
  now: Date,
  alreadyAlerted: (r: CoverageRow) => string
): CoverageRow[] {
  const limit = now.getTime() + ALERT_WINDOW_MS;
  return rows.filter(
    (r) =>
      (r.lastAt === null || new Date(r.lastAt).getTime() <= limit) &&
      alreadyAlerted(r) !== marker(r)
  );
}

export function coverage(now: Date): CoverageRow[] {
  return getDb()
    .prepare(
      `SELECT a.user_id AS userId, a.platform, a.account_name AS accountName,
              (SELECT MAX(p.scheduled_at) FROM posts p
                 JOIN post_targets t ON t.post_id = p.id
                WHERE p.user_id = a.user_id AND t.platform = a.platform
                  AND p.status = 'scheduled' AND t.status = 'pending'
                  AND p.scheduled_at > ?) AS lastAt
         FROM accounts a`
    )
    .all(now.toISOString()) as CoverageRow[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  });

/** Giro completo: chiamato dallo scheduler. */
export async function runContentAlerts(now = new Date()): Promise<void> {
  if (!mailEnabled()) return; // non configurato: niente avvisi, niente dedup bruciato
  const key = (r: CoverageRow) => `content_alert:${r.platform}`;
  const due = pickAlerts(coverage(now), now, (r) => getSetting(r.userId, key(r)));

  const byUser = new Map<number, CoverageRow[]>();
  for (const r of due) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);

  for (const [userId, rows] of byUser) {
    const lines = rows.map(
      (r) =>
        `- ${r.platform}${r.accountName ? ` (${r.accountName})` : ""}: ` +
        (r.lastAt ? `ultimo post programmato ${fmt(r.lastAt)}` : "nessun post programmato")
    );
    const text =
      `Fra meno di una settimana questi account resteranno senza contenuti da pubblicare:\n\n` +
      `${lines.join("\n")}\n\nProgramma i prossimi post: ${env.appUrl}/calendar\n`;
    if (await emailUser(userId, "uSocial: contenuti in esaurimento", text)) {
      for (const r of rows) setSetting(r.userId, key(r), marker(r));
    }
  }
}
