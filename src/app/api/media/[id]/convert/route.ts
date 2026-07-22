/**
 * POST /api/media/:id/convert — monta/converte un video in MP4 pubblicabile.
 * Body: { start?, end?, ratio?, muted? }. Crea un NUOVO media MP4 (l'originale
 * resta). Usato per trasformare le registrazioni WebN in MP4 per TikTok/Instagram.
 */
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { createMedia, getMedia } from "@/lib/repo";
import { ensureMediaDir, filePath, newFilePath } from "@/lib/storage";
import { convertToMp4 } from "@/lib/video";
import { transcribe, whisperAvailable } from "@/lib/whisper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// conversione + eventuale trascrizione Whisper: fino a 10 min
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  start: z.number().min(0).optional(),
  end: z.number().min(0).optional(),
  ratio: z.enum(["keep", "9:16", "1:1", "4:5", "16:9"]).optional(),
  muted: z.boolean().optional(),
  /** Sottotitoli automatici bruciati nel video (Whisper). */
  subtitles: z.boolean().optional(),
  subtitleSize: z.number().min(20).max(120).optional(),
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

  // Sottotitoli automatici: trascriviamo con Whisper e passiamo l'SRT a ffmpeg
  // che lo "brucia" nel video. Se Whisper non è disponibile la conversione
  // prosegue senza sottotitoli, segnalandolo nella risposta.
  let srtPath: string | undefined;
  let subtitlesNote: string | null = null;
  if (opts.subtitles && !opts.muted) {
    if (!(await whisperAvailable())) {
      subtitlesNote =
        "Sottotitoli saltati: Whisper non è installato sul server " +
        "(installalo con `pip install -U openai-whisper` o imposta WHISPER_PATH).";
      logger.info("video", subtitlesNote, undefined, user.id);
    } else {
      const tr = await transcribe(input);
      if (tr) {
        srtPath = tr.srtPath;
      } else {
        subtitlesNote =
          "Sottotitoli saltati: non è stato riconosciuto parlato nell'audio del video.";
        logger.info("video", subtitlesNote, undefined, user.id);
      }
    }
  }

  // Errori di ffmpeg (binario assente, codec non supportato) devono arrivare
  // all'utente come messaggio leggibile, non come 500 "Errore interno".
  try {
    await convertToMp4(input, outPath, { ...opts, srtPath });
  } catch (e) {
    try {
      fs.unlinkSync(outPath);
    } catch {
      /* file parziale già assente */
    }
    throw new AppError(
      e instanceof Error ? `Conversione MP4 fallita. ${e.message}` : "Conversione MP4 fallita",
      500
    );
  }

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    throw new AppError("Conversione MP4 fallita: il file prodotto è vuoto.", 500);
  }

  const size = fs.statSync(outPath).size;
  const baseName = item.originalName.replace(/\.[^.]+$/, "");
  const withSubs = !!srtPath;
  const created = createMedia(user.id, {
    filename: outName,
    originalName: `${baseName}.mp4`,
    mime: "video/mp4",
    size,
    folder: item.folder || "mp4",
    tags: [item.tags, "mp4", withSubs ? "sottotitoli" : null].filter(Boolean).join(","),
  });

  // pulizia della cartella temporanea di Whisper
  if (srtPath) {
    try {
      fs.rmSync(path.dirname(srtPath), { recursive: true, force: true });
    } catch {
      /* già rimossa */
    }
  }

  logger.info(
    "video",
    `Convertito media #${id} → MP4 (#${created.id}, ${(size / 1024 / 1024).toFixed(1)} MB` +
      `${withSubs ? ", con sottotitoli" : ""})`,
    undefined,
    user.id
  );
  return NextResponse.json({ ...created, subtitles: withSubs, subtitlesNote }, { status: 201 });
});
