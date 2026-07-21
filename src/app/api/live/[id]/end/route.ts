/** POST /api/live/:id/end — termina la diretta sulla piattaforma. */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { getAccount, getLive, setLiveStatus } from "@/lib/repo";
import { getLiveProvider } from "@/social/live";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>("live", async (_req, { params }, user) => {
  const id = Number((await params).id);
  const live = getLive(id, user.id);
  if (!live) throw new NotFoundError("Diretta non trovata");
  const account = getAccount(user.id, live.platform);
  if (account) {
    await getLiveProvider(live.platform).endLive(account, live.broadcastId).catch(() => {});
  }
  setLiveStatus(id, user.id, "ended");
  logger.info("live", `Diretta #${id} terminata`, undefined, user.id);
  return NextResponse.json({ ok: true });
});
