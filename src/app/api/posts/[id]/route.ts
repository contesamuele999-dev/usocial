/**
 * /api/posts/:id — GET dettaglio, PUT aggiornamento, DELETE eliminazione.
 * PATCH — operazioni rapide: { scheduledAt } per il drag&drop del calendario.
 * Tutte le operazioni sono limitate ai post dell'utente loggato.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { deletePost, getPost, reschedulePost, updatePost } from "@/lib/repo";
import { PLATFORMS } from "@/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().default(""),
  body: z.string().default(""),
  hashtags: z.string().default(""),
  scheduledAt: z.string().nullable().default(null),
  status: z.enum(["draft", "scheduled", "publishing", "published", "partial", "failed"]),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  mediaIds: z.array(z.number()).default([]),
  postTypes: z.record(z.enum(PLATFORMS), z.string()).optional(),
});

export const GET = withUser<Ctx>("posts", async (_req, { params }, user) => {
  const { id } = await params;
  const post = getPost(Number(id), user.id);
  if (!post) throw new NotFoundError("Post non trovato");
  return NextResponse.json(post);
});

export const PUT = withUser<Ctx>("posts", async (req, { params }, user) => {
  const { id } = await params;
  const input = updateSchema.parse(await req.json());
  const post = updatePost(Number(id), user.id, input);
  if (!post) throw new NotFoundError("Post non trovato");
  return NextResponse.json(post);
});

export const PATCH = withUser<Ctx>("posts", async (req, { params }, user) => {
  const { id } = await params;
  const { scheduledAt } = z
    .object({ scheduledAt: z.string().nullable() })
    .parse(await req.json());
  reschedulePost(Number(id), user.id, scheduledAt);
  const post = getPost(Number(id), user.id);
  if (!post) throw new NotFoundError("Post non trovato");
  return NextResponse.json(post);
});

export const DELETE = withUser<Ctx>("posts", async (_req, { params }, user) => {
  const { id } = await params;
  if (!deletePost(Number(id), user.id)) throw new NotFoundError("Post non trovato");
  return NextResponse.json({ ok: true });
});
