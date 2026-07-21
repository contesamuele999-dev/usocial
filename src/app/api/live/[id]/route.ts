/** DELETE /api/live/:id — rimuove il record della diretta. */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { deleteLive, getLive } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withUser<Ctx>("live", async (_req, { params }, user) => {
  const id = Number((await params).id);
  if (!getLive(id, user.id)) throw new NotFoundError("Diretta non trovata");
  deleteLive(id, user.id);
  return NextResponse.json({ ok: true });
});
