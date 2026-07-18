/**
 * GET /api/connect/:platform — avvia il flusso OAuth per collegare un account
 * social all'UTENTE loggato: genera lo state, lo salva in un cookie e
 * reindirizza alla pagina di autorizzazione della piattaforma.
 */
import { NextResponse } from "next/server";
import { AppError, withErrorHandling } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { buildAuthorizeUrl, randomState } from "@/social/oauth";
import { getModule } from "@/social/registry";
import { PLATFORMS, type Platform } from "@/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

export const GET = withErrorHandling<Ctx>("oauth", async (req, { params }) => {
  requireUser(req); // deve esserci un utente loggato: l'account si lega a lui al callback
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as Platform)) {
    throw new AppError(`Piattaforma sconosciuta: ${platform}`);
  }
  const mod = getModule(platform as Platform);
  const state = randomState();
  const url = buildAuthorizeUrl(platform, mod.oauth, state);
  const res = NextResponse.redirect(url);
  res.cookies.set(`oauth_state_${platform}`, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
});
