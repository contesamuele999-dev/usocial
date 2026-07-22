/**
 * GET /api/storage — stato della quota di spazio dell'utente corrente.
 * Usato dalla barra di memoria nella sidebar e nella pagina Libreria.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getQuota } from "@/lib/quota";
import { mediaUsageByFolder } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("storage", async (_req, _ctx, user) => {
  const quota = getQuota(user.id);
  return NextResponse.json({
    ...quota,
    byFolder: mediaUsageByFolder(user.id),
  });
});
