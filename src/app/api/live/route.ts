/**
 * /api/live
 * GET  — lista delle dirette dell'utente
 * POST — crea una diretta su una piattaforma { platform, title, description }
 *        e ritorna URL RTMP + stream key + link spettatori.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { createLive, getAccount, listLives } from "@/lib/repo";
import { getLiveProvider, LIVE_PLATFORMS } from "@/social/live";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  platform: z.enum(["youtube", "facebook"]),
  title: z.string().default(""),
  description: z.string().default(""),
});

export const GET = withUser("live", async (_req, _ctx, user) => {
  return NextResponse.json(listLives(user.id));
});

export const POST = withUser("live", async (req, _ctx, user) => {
  const input = schema.parse(await req.json());
  if (!LIVE_PLATFORMS.includes(input.platform)) {
    throw new AppError(`Le dirette non sono supportate per ${input.platform}`);
  }
  const account = getAccount(user.id, input.platform);
  if (!account) throw new NotFoundError(`Account ${input.platform} non connesso`);

  const details = await getLiveProvider(input.platform).createLive(
    account,
    input.title,
    input.description
  );
  const live = createLive(user.id, {
    platform: input.platform,
    title: input.title,
    description: input.description,
    ...details,
  });
  logger.info("live", `Diretta creata su ${input.platform} (#${live.id})`, undefined, user.id);
  return NextResponse.json(live, { status: 201 });
});
