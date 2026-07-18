/**
 * GET /api/connect/:platform/callback — riceve il code OAuth, verifica lo state,
 * scambia i token, recupera i dati dell'account e lo salva legandolo all'utente
 * loggato (la sessione viaggia nel cookie, SameSite=Lax → presente dopo il redirect).
 * Alla fine reindirizza alle Impostazioni con l'esito nella query string.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/lib/auth";
import { saveAccount } from "@/lib/repo";
import { exchangeCode, expiryIso } from "@/social/oauth";
import { getModule } from "@/social/registry";
import { PLATFORMS, type Platform } from "@/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { platform } = await params;
  const url = new URL(req.url);
  const settingsUrl = (msg: string, ok: boolean) =>
    NextResponse.redirect(
      `${env.appUrl}/settings?${ok ? "connected" : "error"}=${encodeURIComponent(msg)}`
    );

  try {
    const user = getRequestUser(req);
    if (!user) return settingsUrl("Sessione scaduta: accedi e riprova", false);

    if (!PLATFORMS.includes(platform as Platform)) {
      return settingsUrl(`Piattaforma sconosciuta: ${platform}`, false);
    }
    const error = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (error) return settingsUrl(error, false);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = req.headers
      .get("cookie")
      ?.match(new RegExp(`oauth_state_${platform}=([^;]+)`))?.[1];
    if (!code) return settingsUrl("Codice OAuth mancante", false);
    if (!state || state !== cookieState) return settingsUrl("State OAuth non valido", false);

    const mod = getModule(platform as Platform);
    const tokens = await exchangeCode(platform, mod.oauth, code);
    const info = await mod.fetchAccount(tokens); // può aggiornare tokens (es. long-lived FB)

    saveAccount({
      userId: user.id,
      platform: platform as Platform,
      accountName: info.accountName,
      accountId: info.accountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      expiresAt: expiryIso(tokens.expiresIn),
      scopes: tokens.scopes || mod.oauth.scopes.join(" "),
      connectedAt: new Date().toISOString(),
      meta: JSON.stringify(info.meta),
    });
    logger.info(platform, `Account connesso: ${info.accountName}`, undefined, user.id);
    return settingsUrl(platform, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(platform, "Connessione OAuth fallita", message);
    return settingsUrl(message, false);
  }
}
