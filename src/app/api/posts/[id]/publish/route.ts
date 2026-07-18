/**
 * POST /api/posts/:id/publish — pubblica subito su tutte le piattaforme selezionate.
 * Verifica che il post appartenga all'utente prima di pubblicarlo.
 */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { getPost } from "@/lib/repo";
import { publishPost } from "@/social/publisher";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>("publish", async (_req, { params }, user) => {
  const { id } = await params;
  if (!getPost(Number(id), user.id)) throw new NotFoundError("Post non trovato");
  const post = await publishPost(Number(id));
  return NextResponse.json(post);
});
