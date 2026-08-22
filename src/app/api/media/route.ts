/**
 * /api/media
 * GET  — lista media dell'utente (filtri: ?q=ricerca&folder=cartella) + cartelle
 * POST — upload. Due modalità:
 *   - multipart/form-data (campo "file", opzionali "folder" e "tags");
 *   - body raw in streaming (header x-filename, x-folder, x-tags e Content-Type
 *     del file): usato dalla UI e dalla CLI/MCP perché non carica il file in RAM.
 */
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { createMedia, listFolders, listMedia, mediaPendingUsage } from "@/lib/repo";
import { saveFile, saveStream } from "@/lib/storage";
import { assertQuota, getQuota } from "@/lib/quota";
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

/** Elementi per pagina se il client non chiede diversamente. */
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

export const GET = withUser("media", async (req, _ctx, user) => {
  const url = new URL(req.url);
  // La lista è paginata: senza limite la Libreria restituiva l'intero archivio
  // e il browser apriva una richiesta per ogni file presente.
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const { items, total } = listMedia(user.id, {
    q: url.searchParams.get("q") || undefined,
    folder: url.searchParams.get("folder") || undefined,
    limit,
    offset,
  });
  // `pending` dice, per ogni media, quali post in coda lo useranno: la Libreria
  // segnala così cosa è in attesa di pubblicazione e cosa si può cancellare.
  return NextResponse.json({
    items,
    total,
    folders: listFolders(user.id),
    pending: mediaPendingUsage(user.id),
  });
});

/** Registra il media a DB e risponde con quota aggiornata. */
function respond(
  userId: number,
  data: { filename: string; originalName: string; mime: string; size: number; folder: string; tags: string }
) {
  const item = createMedia(userId, data);
  logger.info(
    "media",
    `Caricato ${data.originalName} (${(data.size / 1024 / 1024).toFixed(1)} MB)`,
    undefined,
    userId
  );
  // la quota aggiornata torna insieme al media: la UI aggiorna la barra senza
  // dover fare una seconda richiesta
  return NextResponse.json({ ...item, quota: getQuota(userId) }, { status: 201 });
}

export const POST = withUser("media", async (req, _ctx, user) => {
  const contentType = req.headers.get("content-type") || "";

  // --- upload in streaming (nessun buffer in RAM: ok anche per video da 1 GB) ---
  if (!contentType.startsWith("multipart/form-data")) {
    const originalName = req.headers.get("x-filename") || "upload";
    const mime = contentType.split(";")[0].trim();
    if (!ALLOWED.includes(mime)) {
      throw new AppError(`Tipo file non supportato: ${mime || "sconosciuto"}. Ammessi: jpg, png, gif, webp, mp4, mov`);
    }
    if (!req.body) throw new AppError("Nessun file ricevuto");

    // Se il client dichiara la dimensione, la quota si controlla subito (errore
    // immediato invece di trasferire 100 MB per poi rifiutarli).
    const declared = Number(req.headers.get("content-length") || 0);
    const quota = declared > 0 ? assertQuota(user.id, declared) : getQuota(user.id);

    const { filename, size } = await saveStream(decodeURIComponent(originalName), req.body, quota.free);
    return respond(user.id, {
      filename,
      originalName: decodeURIComponent(originalName),
      mime,
      size,
      folder: req.headers.get("x-folder") || "",
      tags: req.headers.get("x-tags") || "",
    });
  }

  // --- upload multipart (compatibilità con client esistenti / curl -F) ---
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Nessun file ricevuto");
  if (!ALLOWED.includes(file.type)) {
    throw new AppError(`Tipo file non supportato: ${file.type}. Ammessi: jpg, png, gif, webp, mp4, mov`);
  }
  const buf = Buffer.from(await file.arrayBuffer());

  // Controllo quota PRIMA di scrivere su disco: su una VM condivisa un upload
  // fuori quota riempirebbe il disco per tutti gli utenti.
  assertQuota(user.id, buf.length);

  const filename = await saveFile(file.name, buf);
  return respond(user.id, {
    filename,
    originalName: file.name,
    mime: file.type,
    size: buf.length,
    folder: String(form.get("folder") || ""),
    tags: String(form.get("tags") || ""),
  });
});
