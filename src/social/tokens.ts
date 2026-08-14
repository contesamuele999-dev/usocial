/**
 * Rinnovo dei token social.
 *
 * Perché serve: gli access token durano poco (TikTok 24 h, Google 1 h, Meta 60
 * giorni) mentre un post può essere programmato fra mesi. Il token si mantiene
 * vivo usando il refresh token PRIMA della scadenza: lo scheduler chiama
 * `refreshExpiringAccounts()` ogni ora, quindi al momento della pubblicazione
 * l'access token è sempre fresco anche se l'utente non tocca l'app da mesi.
 *
 * Limiti lato piattaforma (vanno rispettati, non aggirati):
 * - TikTok: il refresh token vale 365 giorni → una riconnessione all'anno.
 * - Google/YouTube: il refresh token è permanente SOLO se l'app OAuth è in
 *   stato "In produzione"; in "Testing" scade dopo 7 giorni.
 * - Meta (Facebook/Instagram): il token long-lived dura 60 giorni e si estende
 *   riscambiandolo; i page token derivati non scadono finché il token utente è valido.
 */
import { logger } from "@/lib/logger";
import { allAccountsSystem, saveAccount } from "@/lib/repo";
import type { Account, Platform } from "@/types";
import { getModule } from "./registry";
import { expiryIso } from "./oauth";

/**
 * Quanto prima della scadenza rinnovare, per piattaforma (ore).
 * Token corti → finestra corta (un rinnovo al giorno); token da 60 giorni →
 * finestra larga, così bastano pochi rinnovi l'anno.
 */
const RENEW_BEFORE_HOURS: Record<Platform, number> = {
  tiktok: 12,
  youtube: 12,
  facebook: 24 * 14,
  instagram: 24 * 14,
  linkedin: 24 * 14,
};

/** true se il token va rinnovato adesso (o è già scaduto). */
export function needsRefresh(account: Account, now = Date.now()): boolean {
  if (!account.expiresAt) return false; // token senza scadenza nota
  const windowMs = (RENEW_BEFORE_HOURS[account.platform] ?? 12) * 3600_000;
  return new Date(account.expiresAt).getTime() - now < windowMs;
}

/**
 * Rinnova il token di un account e lo salva. Ritorna true se rinnovato.
 * Non lancia: un fallimento viene loggato e la pubblicazione proverà comunque
 * col token attuale (potrebbe essere ancora valido).
 */
export async function refreshAccount(account: Account): Promise<boolean> {
  const mod = getModule(account.platform);
  if (!mod.refresh) return false;
  try {
    const tokens = await mod.refresh(account);
    if (!tokens?.accessToken) return false;
    account.accessToken = tokens.accessToken;
    account.refreshToken = tokens.refreshToken ?? account.refreshToken;
    account.expiresAt = expiryIso(tokens.expiresIn) ?? account.expiresAt;
    saveAccount(account);
    logger.info(
      account.platform,
      `Token rinnovato automaticamente (valido fino al ${account.expiresAt || "—"})`,
      undefined,
      account.userId
    );
    return true;
  } catch (err) {
    logger.warn(
      account.platform,
      "Rinnovo token fallito: potrebbe servire riconnettere l'account dalle Impostazioni",
      String(err),
      account.userId
    );
    return false;
  }
}

/**
 * Rinnova tutti gli account vicini alla scadenza (chiamato ogni ora dallo
 * scheduler). Ritorna quanti token sono stati rinnovati.
 */
export async function refreshExpiringAccounts(): Promise<number> {
  let renewed = 0;
  for (const account of allAccountsSystem()) {
    if (!needsRefresh(account)) continue;
    if (await refreshAccount(account)) renewed++;
  }
  return renewed;
}
