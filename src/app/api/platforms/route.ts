/**
 * GET /api/platforms — elenco piattaforme con limiti e stato connessione
 * per l'utente loggato.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { platformInfo } from "@/social/registry";
import { getAccount } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("platforms", async (_req, _ctx, user) => {
  const info = platformInfo().map((p) => {
    const account = getAccount(user.id, p.platform);
    return {
      ...p,
      connected: !!account,
      accountName: account?.accountName || null,
      expiresAt: account?.expiresAt || null,
    };
  });
  return NextResponse.json(info);
});
