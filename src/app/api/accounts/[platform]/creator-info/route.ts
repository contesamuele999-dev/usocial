/**
 * GET /api/accounts/:platform/creator-info
 * Opzioni di pubblicazione che la piattaforma impone di far scegliere all'utente
 * (oggi solo TikTok). Sono dati vivi — dipendono dalle impostazioni dell'account
 * e cambiano senza preavviso — quindi si leggono al momento, non si salvano.
 */
import { NextResponse } from "next/server";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { getAccount } from "@/lib/repo";
import { getModule } from "@/social/registry";
import { PLATFORMS, type Platform } from "@/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

export const GET = withUser<Ctx>("accounts", async (_req, { params }, user) => {
  const p = (await params).platform;
  if (!PLATFORMS.includes(p as Platform)) throw new AppError(`Piattaforma sconosciuta: ${p}`);
  const platform = p as Platform;

  const account = getAccount(user.id, platform);
  if (!account) throw new NotFoundError("Account non connesso");

  const mod = getModule(platform);
  if (!mod.creatorInfo) throw new AppError(`${mod.displayName} non richiede opzioni di pubblicazione`);

  return NextResponse.json(await mod.creatorInfo(account));
});
