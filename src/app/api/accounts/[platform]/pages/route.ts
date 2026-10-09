/**
 * /api/accounts/:platform/pages — solo Facebook e Instagram.
 * GET — Pagine (o account Instagram) concesse al login, con quella in uso
 * PUT — { pageId } punta l'account su un'altra di queste Pagine
 *
 * Serve quando lo stesso profilo Facebook gestisce più brand: il consenso Meta
 * è uno solo e contiene le Pagine di tutti, la scelta la fa l'utente qui.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getAccount } from "@/lib/repo";
import { listPages, selectPage } from "@/social/meta-pages";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

async function metaAccount(params: Ctx["params"], userId: number) {
  const { platform } = await params;
  if (platform !== "facebook" && platform !== "instagram") {
    throw new AppError("La scelta della Pagina vale solo per Facebook e Instagram.");
  }
  const account = getAccount(userId, platform);
  if (!account) throw new NotFoundError("Account non connesso");
  return account;
}

export const GET = withUser<Ctx>("accounts", async (_req, { params }, user) => {
  return NextResponse.json(await listPages(await metaAccount(params, user.id)));
});

export const PUT = withUser<Ctx>("accounts", async (req, { params }, user) => {
  const { pageId } = (await req.json()) as { pageId?: string };
  if (!pageId) throw new AppError("Manca la Pagina da collegare.");
  const account = await selectPage(await metaAccount(params, user.id), pageId);
  logger.info(account.platform, `Pagina scelta: ${account.accountName}`, undefined, user.id);
  return NextResponse.json({ ok: true, accountName: account.accountName });
});
