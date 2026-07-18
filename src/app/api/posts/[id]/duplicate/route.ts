/**
 * POST /api/posts/:id/duplicate — duplica il post dell'utente come nuova bozza.
 */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { duplicatePost } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>("posts", async (_req, { params }, user) => {
  const { id } = await params;
  const copy = duplicatePost(Number(id), user.id);
  if (!copy) throw new NotFoundError("Post non trovato");
  return NextResponse.json(copy, { status: 201 });
});
