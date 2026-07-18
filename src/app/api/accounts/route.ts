/**
 * GET /api/accounts — stato connessione degli account social dell'utente
 * (senza mai esporre i token).
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listAccounts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("accounts", async (_req, _ctx, user) => {
  const accounts = listAccounts(user.id).map((a) => ({
    platform: a.platform,
    accountName: a.accountName,
    connectedAt: a.connectedAt,
    expiresAt: a.expiresAt,
    scopes: a.scopes,
  }));
  return NextResponse.json(accounts);
});
