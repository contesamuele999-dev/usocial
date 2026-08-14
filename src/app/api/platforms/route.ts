/**
 * GET /api/platforms — elenco piattaforme con limiti e stato connessione
 * per l'utente loggato.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getModule, platformInfo } from "@/social/registry";
import { listAccounts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("platforms", async (_req, _ctx, user) => {
  const accounts = new Map(listAccounts(user.id).map((a) => [a.platform, a]));
  const info = platformInfo().map((p) => {
    const account = accounts.get(p.platform);
    const mod = getModule(p.platform);
    return {
      ...p,
      connected: !!account,
      accountName: account?.accountName || null,
      expiresAt: account?.expiresAt || null,
      /**
       * true = lo scheduler rinnova il token da solo prima della scadenza,
       * quindi si può programmare un post anche a mesi di distanza.
       */
      autoRenew: !!account && !!mod.refresh && (!!account.refreshToken || p.platform === "facebook" || p.platform === "instagram"),
    };
  });
  return NextResponse.json(info);
});
