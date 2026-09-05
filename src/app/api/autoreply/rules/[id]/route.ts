/**
 * PUT|DELETE /api/autoreply/rules/:id — modifica o elimina una regola.
 */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { deleteAutoReplyRule, updateAutoReplyRule } from "@/lib/repo";
import { parseRule } from "@/lib/autoreply";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withUser<Ctx>("autoreply", async (req, { params }, user) => {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const rule = updateAutoReplyRule(Number(id), user.id, parseRule(body));
  if (!rule) throw new NotFoundError("Regola non trovata");
  return NextResponse.json(rule);
});

export const DELETE = withUser<Ctx>("autoreply", async (_req, { params }, user) => {
  const { id } = await params;
  if (!deleteAutoReplyRule(Number(id), user.id)) throw new NotFoundError("Regola non trovata");
  return NextResponse.json({ ok: true });
});
