/**
 * /api/templates/:id
 * PUT    — aggiorna { name, data }
 * DELETE — elimina il template
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { deleteTemplate, getTemplate, updateTemplate } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export const PUT = withUser<Ctx>("templates", async (req, { params }, user) => {
  const id = Number((await params).id);
  const input = updateSchema.parse(await req.json());
  const tpl = updateTemplate(id, user.id, input.name, input.data as never);
  if (!tpl) throw new NotFoundError("Template non trovato");
  return NextResponse.json(tpl);
});

export const DELETE = withUser<Ctx>("templates", async (_req, { params }, user) => {
  const id = Number((await params).id);
  if (!getTemplate(id, user.id)) throw new NotFoundError("Template non trovato");
  deleteTemplate(id, user.id);
  return NextResponse.json({ ok: true });
});
