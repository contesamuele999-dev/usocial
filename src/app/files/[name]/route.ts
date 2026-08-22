/**
 * GET|HEAD /files/:name — file binario di un media, indirizzato per NOME su disco.
 *
 * ⚠️ Endpoint PUBBLICO, come /api/media/:id/:filename: Instagram e Facebook
 * scaricano i media senza poter inviare il cookie di sessione. Qui l'indirizzo
 * è però il nome generato all'upload (`<timestamp>-<12 esadecimali>.<ext>`),
 * quindi non enumerabile — a differenza dell'id progressivo dell'altra rotta.
 *
 * Due motivi per questa rotta:
 *  1) il nome su disco è un percorso reale, quindi Caddy può servire il file
 *     da sé senza svegliare Node (vedi Caddyfile: `handle /files/*`);
 *  2) `<nome>.poster.jpg` produce il fotogramma di anteprima di un video,
 *     generandolo la prima volta e riusandolo poi.
 */
import path from "node:path";
import fs from "node:fs";
import { NotFoundError, withErrorHandling } from "@/lib/errors";
import { mimeFromExt, serveFile } from "@/lib/serve";
import { ensureMediaDir, filePath, posterFilename } from "@/lib/storage";
import { extractPoster } from "@/lib/video";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

const POSTER_SUFFIX = ".poster.jpg";

/**
 * Generazioni in corso, per non lanciare due ffmpeg sullo stesso video quando
 * la griglia chiede lo stesso poster più volte in parallelo. Su una VM con 2
 * vCPU condivise questo è ciò che separa un'attesa breve da un blocco.
 */
const generating = new Map<string, Promise<boolean>>();

function posterOnce(source: string, output: string): Promise<boolean> {
  const inFlight = generating.get(output);
  if (inFlight) return inFlight;
  const job = extractPoster(source, output).finally(() => generating.delete(output));
  generating.set(output, job);
  return job;
}

/** Assicura che il poster esista su disco; false se non è producibile. */
async function ensurePoster(name: string): Promise<boolean> {
  const sourceName = name.slice(0, -POSTER_SUFFIX.length);
  const source = filePath(sourceName);
  const output = filePath(posterFilename(sourceName));

  try {
    await fs.promises.access(output);
    return true; // già generato in una richiesta precedente
  } catch {
    /* da generare */
  }
  try {
    await fs.promises.access(source);
  } catch {
    return false; // il video non esiste più
  }

  await ensureMediaDir();
  const ok = await posterOnce(source, output);
  if (!ok) {
    // ffmpeg assente o video illeggibile: la UI ripiega su un riquadro neutro.
    logger.warn("media", `Poster non generato per ${sourceName}`);
  }
  return ok;
}

const handler = withErrorHandling<Ctx>("media", async (req, { params }) => {
  const raw = (await params).name;
  // `path.basename` da solo basta a impedire il path traversal: il nome non può
  // più contenere separatori dopo questa riga.
  const name = path.basename(raw); // Next consegna il parametro già decodificato
  if (!name || name.startsWith(".")) throw new NotFoundError("File non trovato");

  if (name.endsWith(POSTER_SUFFIX) && !(await ensurePoster(name))) {
    throw new NotFoundError("Anteprima non disponibile");
  }

  return serveFile(req, filePath(name), {
    mime: mimeFromExt(name),
    // I nomi sono univoci e i file non vengono mai riscritti: il browser può
    // tenerli per sempre senza rischiare di mostrare contenuto vecchio.
    cacheControl: "public, max-age=31536000, immutable",
  });
});

export const GET = handler;
export const HEAD = handler;
