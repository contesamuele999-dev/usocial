/**
 * /api/media
 * GET  — lista media dell'utente (filtri: ?q=ricerca&folder=cartella) + cartelle
 * POST — upload multipart (campo "file", opzionali "folder" e "tags")
 */
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { createMedia, listFolders, listMedia } from "@/lib/repo";
import { saveFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm", // registrazioni in-app (MediaRecorder); conversione a mp4 in fase di montaggio
];

export const GET = withUser("media", async (req, _ctx, user) => {
  const url = new URL(req.url);
  const items = listMedia(user.id, {
    q: url.searchParams.get("q") || undefined,
    folder: url.searchParams.get("folder") || undefined,
  });
  return NextResponse.json({ items, folders: listFolders(user.id) });
});

export const POST = withUser("media", async (req, _ctx, user) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Nessun file ricevuto");
  if (!ALLOWED.includes(file.type)) {
    throw new AppError(`Tipo file non supportato: ${file.type}. Ammessi: jpg, png, gif, webp, mp4, mov`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const filename = await saveFile(file.name, buf);
  const item = createMedia(user.id, {
    filename,
    originalName: file.name,
    mime: file.type,
    size: buf.length,
    folder: String(form.get("folder") || ""),
    tags: String(form.get("tags") || ""),
  });
  logger.info("media", `Caricato ${file.name} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`, undefined, user.id);
  return NextResponse.json(item, { status: 201 });
});
