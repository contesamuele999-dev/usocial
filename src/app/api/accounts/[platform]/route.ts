/**
 * /api/accounts/:platform
 * POST   — verifica il token dell'account dell'utente (chiama l'API della piattaforma)
 * DELETE — disconnette l'account (rimuove i token dal DB)
 */
import { NextResponse } from "next/server";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { deleteAccount, getAccount } from "@/lib/repo";
import { getModule } from "@/social/registry";
import { PLATFORMS, type Platform } from "@/types";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

function parsePlatform(p: string): Platform {
  if (!PLATFORMS.includes(p as Platform)) throw new AppError(`Piattaforma sconosciuta: ${p}`);
  return p as Platform;
}

export const POST = withUser<Ctx>("accounts", async (_req, { params }, user) => {
  const platform = parsePlatform((await params).platform);
  const account = getAccount(user.id, platform);
  if (!account) throw new NotFoundError("Account non connesso");
  const result = await getModule(platform).verifyToken(account);
  return NextResponse.json(result);
});

export const DELETE = withUser<Ctx>("accounts", async (_req, { params }, user) => {
  const platform = parsePlatform((await params).platform);
  if (!deleteAccount(user.id, platform)) throw new NotFoundError("Account non connesso");
  logger.info(platform, "Account disconnesso", undefined, user.id);
  return NextResponse.json({ ok: true });
});
