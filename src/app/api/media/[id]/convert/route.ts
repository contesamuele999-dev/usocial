/**
 * POST /api/media/:id/convert — monta/converte un video in MP4 pubblicabile.
 * Body: { start?, end?, ratio?, muted? }. Crea un NUOVO media MP4 (l'originale
 * resta). Usato per trasformare le registrazioni WebN in MP4 per TikTok/Instagram.
 */
import fs from "node:fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { createMedia, getMedia } from "@/lib/repo";
import { ensureMediaDir, filePath, newFilePath } from "@/lib/storage";
import { convertToMp4 } from "@/lib/video";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // conversione: fino a 5 min

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  start: z.number().min(0).optional(),
  end: z.number().min(0).optional(),
  ratio: z.enum(["keep", "9:16", "1:1", "4:5", "16:9"]).optional(),
  muted: z.boolean().optional(),
});

export const POST = withUser<Ctx>("video", async (req, { params }, user) => {
  const id = Number((await params).id);
  const item = getMedia(id, user.id);
  if (!item) throw new NotFoundError("Media non trovato");
  if (!item.mime.startsWith("video/")) throw new AppError("Il media non è un video");

  const opts = schema.parse(await req.json().catch(() => ({})));

  await ensureMediaDir();
  const input = filePath(item.filename);
  const { filename: outName, path: outPath } = newFilePath("mp4");

  await convertToMp4(input, outPath, opts);

  const size = fs.statSync(outPath).size;
  const baseName = item.originalName.replace(/\.[^.]+$/, "");
  const created = createMedia(user.id, {
    filename: outName,
    originalName: `${baseName}.mp4`,
    mime: "video/mp4",
    size,
    folder: item.folder || "mp4",
    tags: item.tags ? `${item.tags},mp4` : "mp4",
  });

  logger.info("video", `Convertito media #${id} → MP4 (#${created.id}, ${(size / 1024 / 1024).toFixed(1)} MB)`, undefined, user.id);
  return NextResponse.json(created, { status: 201 });
});
