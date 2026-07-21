/**
 * POST /api/repurpose — trasforma un video lungo in più clip pronte:
 * split, hook testuale, sottotitoli (Whisper), descrizione AI per clip,
 * copertina, e b-roll stock opzionali. Salva tutto in libreria e (opz.) crea
 * una bozza di post per clip.
 *
 * Operazione pesante e sincrona: ffmpeg + Whisper girano sul server.
 */
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { createMedia, createPost, getMedia } from "@/lib/repo";
import { ensureMediaDir, filePath, newFilePath } from "@/lib/storage";
import { probeDuration, planClips, renderClip, extractCover, tmpWorkDir, type HookStyle } from "@/lib/repurpose";
import { transcribe, sliceSrt, readSrtText } from "@/lib/whisper";
import { fetchBroll } from "@/lib/broll";
import { getAiConfig, getAiProvider } from "@/ai/index";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 800;

const hookSchema = z.object({
  text: z.string().default(""),
  fontSize: z.number().default(64),
  color: z.string().default("#ffffff"),
  bg: z.string().default("#000000"),
  position: z.enum(["top", "center", "bottom"]).default("top"),
  seconds: z.number().default(3),
});

const schema = z.object({
  mediaId: z.number(),
  clipSeconds: z.number().min(5).max(180).default(30),
  maxClips: z.number().min(1).max(20).default(5),
  ratio: z.enum(["9:16", "1:1", "4:5", "keep"]).default("9:16"),
  hook: hookSchema.default({}),
  subtitles: z.boolean().default(true),
  describe: z.boolean().default(true),
  broll: z.boolean().default(false),
  createPosts: z.boolean().default(true),
});

async function describeClip(userId: number, transcript: string, hook: string): Promise<string> {
  const provider = getAiProvider(getAiConfig(userId));
  const system =
    "Sei un social media manager esperto. Scrivi in italiano una didascalia breve, con hook e CTA, " +
    "ottimizzata per follower e vendite. Rispondi solo con la didascalia seguita da 6-10 hashtag.";
  const prompt =
    `Contenuto della clip (trascrizione): ${transcript || "(non disponibile)"}\n` +
    (hook ? `Hook in sovrimpressione: ${hook}\n` : "") +
    "Scrivi la didascalia.";
  try {
    return (await provider.complete(system, prompt)).trim();
  } catch {
    return "";
  }
}

function sizeOf(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

export const POST = withUser("repurpose", async (req, _ctx, user) => {
  const input = schema.parse(await req.json());
  const source = getMedia(input.mediaId, user.id);
  if (!source) throw new NotFoundError("Video sorgente non trovato");
  if (!source.mime.startsWith("video/")) throw new AppError("Il media selezionato non è un video");

  await ensureMediaDir();
  const inPath = filePath(source.filename);
  const duration = await probeDuration(inPath);
  if (!duration) throw new AppError("Impossibile leggere la durata del video");

  const clips = planClips(duration, input.clipSeconds, input.maxClips);
  const work = tmpWorkDir();

  // Trascrizione globale (una volta) se servono sottotitoli o descrizioni.
  const transcript =
    input.subtitles || input.describe ? await transcribe(inPath) : null;

  const baseName = source.originalName.replace(/\.[^.]+$/, "");
  const results: {
    index: number;
    clipMediaId: number;
    coverMediaId: number | null;
    description: string;
    brollMediaIds: number[];
    postId: number | null;
  }[] = [];

  for (let i = 0; i < clips.length; i++) {
    const { start, end } = clips[i];

    // sottotitoli ritagliati alla finestra
    let srtPath: string | undefined;
    if (transcript && sliceSrt(transcript.srtPath, start, end, path.join(work, `clip-${i}.srt`))) {
      srtPath = path.join(work, `clip-${i}.srt`);
    }

    // render clip
    const { filename: clipName, path: clipPath } = newFilePath("mp4");
    await renderClip({
      input: inPath,
      start,
      end,
      out: clipPath,
      ratio: input.ratio,
      hook: input.hook.text.trim() ? (input.hook as HookStyle) : undefined,
      srtPath: input.subtitles ? srtPath : undefined,
    });
    const clipMedia = createMedia(user.id, {
      filename: clipName,
      originalName: `${baseName}-clip${i + 1}.mp4`,
      mime: "video/mp4",
      size: sizeOf(clipPath),
      folder: "repurpose",
      tags: "repurpose,clip",
    });

    // copertina (frame a metà clip)
    let coverMediaId: number | null = null;
    try {
      const { filename: covName, path: covPath } = newFilePath("jpg");
      await extractCover(inPath, start + (end - start) / 2, covPath);
      const cov = createMedia(user.id, {
        filename: covName,
        originalName: `${baseName}-clip${i + 1}-cover.jpg`,
        mime: "image/jpeg",
        size: sizeOf(covPath),
        folder: "repurpose",
        tags: "repurpose,cover",
      });
      coverMediaId = cov.id;
    } catch {
      /* copertina opzionale */
    }

    // descrizione AI
    const clipText = srtPath ? readSrtText(srtPath) : "";
    const description = input.describe ? await describeClip(user.id, clipText, input.hook.text) : "";

    // b-roll stock (query = hook o prime parole della trascrizione)
    const brollMediaIds: number[] = [];
    if (input.broll) {
      const query = (input.hook.text || clipText).split(/\s+/).slice(0, 5).join(" ");
      const clips2 = await fetchBroll(query, 2);
      for (const b of clips2) {
        const { filename, path: bp } = newFilePath("mp4");
        fs.writeFileSync(bp, b.data);
        const bm = createMedia(user.id, {
          filename,
          originalName: b.name,
          mime: b.mime,
          size: sizeOf(bp),
          folder: "repurpose/broll",
          tags: "repurpose,broll",
        });
        brollMediaIds.push(bm.id);
      }
    }

    // bozza post
    let postId: number | null = null;
    if (input.createPosts) {
      const post = createPost(user.id, {
        title: "",
        body: description,
        hashtags: "",
        scheduledAt: null,
        status: "draft",
        platforms: [],
        mediaIds: [clipMedia.id],
      });
      postId = post.id;
    }

    results.push({ index: i + 1, clipMediaId: clipMedia.id, coverMediaId, description, brollMediaIds, postId });
  }

  fs.rmSync(work, { recursive: true, force: true });
  logger.info("repurpose", `Repurpose #${input.mediaId}: ${results.length} clip create`, undefined, user.id);
  return NextResponse.json({
    clips: results,
    transcribed: !!transcript,
    duration,
  });
});
