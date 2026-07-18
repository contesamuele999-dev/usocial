/**
 * Helper OAuth2 generico: costruzione URL di autorizzazione e scambio code→token.
 * La configurazione specifica (endpoint, scope) vive nel modulo di ogni piattaforma.
 */
import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { OAuthSpec, TokenSet } from "./types";

export function redirectUri(platform: string): string {
  return `${env.appUrl}/api/connect/${platform}/callback`;
}

export function randomState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** URL a cui mandare l'utente per autorizzare l'app. */
export function buildAuthorizeUrl(platform: string, spec: OAuthSpec, state: string): string {
  const { clientId } = env.oauth(platform);
  if (!clientId) {
    throw new Error(
      `Credenziali OAuth mancanti per ${platform}: compila il file .env (vedi .env.example).`
    );
  }
  const url = new URL(spec.authorizeUrl);
  url.searchParams.set(spec.clientIdParam || "client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(platform));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", spec.scopes.join(spec.scopeSeparator ?? " "));
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(spec.extraAuthParams || {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

/** Scambia l'authorization code con i token. */
export async function exchangeCode(
  platform: string,
  spec: OAuthSpec,
  code: string
): Promise<TokenSet> {
  const { clientId, clientSecret } = env.oauth(platform);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(platform),
    [spec.clientIdParam || "client_id"]: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(spec.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(
      `Scambio token fallito per ${platform}: ${JSON.stringify(json).slice(0, 400)}`
    );
  }
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) || null,
    expiresIn: (json.expires_in as number) || null,
    scopes: (json.scope as string) || "",
  };
}

/** Refresh generico con grant_type=refresh_token. */
export async function refreshWithToken(
  platform: string,
  tokenUrl: string,
  refreshToken: string,
  clientIdParam = "client_id"
): Promise<TokenSet> {
  const { clientId, clientSecret } = env.oauth(platform);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    [clientIdParam]: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(`Refresh token fallito per ${platform}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) || refreshToken,
    expiresIn: (json.expires_in as number) || null,
  };
}

/** Converte expiresIn (secondi) in ISO string di scadenza. */
export function expiryIso(expiresIn?: number | null): string | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}
