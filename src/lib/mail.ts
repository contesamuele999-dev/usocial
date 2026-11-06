/**
 * Invio email di servizio (avvisi all'utente) via API HTTP di Maileroo.
 * Senza MAILEROO_API_KEY o ALERT_FROM gli avvisi sono semplicemente spenti.
 */
import { getDb } from "./db";
import { env } from "./env";
import { logger } from "./logger";

export const mailEnabled = () => !!(env.mailerooApiKey && env.alertFrom);

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const res = await fetch("https://smtp.maileroo.com/api/v2/emails", {
    method: "POST",
    headers: { "X-Api-Key": env.mailerooApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { address: env.alertFrom, display_name: "uSocial" },
      to: [{ address: to }],
      subject,
      plain: text,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
  if (!res.ok || !body.success) throw new Error(`Maileroo ${res.status}: ${body.message ?? ""}`);
}

/**
 * Email all'utente uSocial. Non lancia mai: chi chiama è a metà di una
 * pubblicazione o di un rinnovo token. Ritorna true se l'email è partita.
 */
export async function emailUser(userId: number, subject: string, text: string): Promise<boolean> {
  if (!mailEnabled()) return false;
  const user = getDb().prepare("SELECT email FROM users WHERE id = ?").get(userId) as
    | { email: string }
    | undefined;
  if (!user) return false;
  try {
    await sendEmail(user.email, subject, text);
    logger.info("mail", `Avviso "${subject}" inviato a ${user.email}`, undefined, userId);
    return true;
  } catch (err) {
    logger.error("mail", `Invio avviso "${subject}" fallito`, String(err), userId);
    return false;
  }
}
