/**
 * Invio di file al browser senza caricarli in RAM, con supporto delle richieste
 * parziali (`Range`).
 *
 * Perché: la rotta dei media faceva `fs.readFile` + `new Uint8Array(buf)`, cioè
 * DUE copie intere del file in memoria a ogni richiesta. È lo stesso errore già
 * corretto in `storage.saveStream` (ingresso) e in `social/upload.fileBody`
 * (invio ai social), ma sulla via d'uscita era rimasto: su una VM da 1 GB una
 * libreria con qualche video mandava il processo in swap e l'app smetteva di
 * rispondere.
 *
 * Il supporto `Range` è altrettanto importante: il tag <video> chiede sempre
 * intervalli parziali e, senza, il browser riceve 200 con il file intero — cioè
 * scarica tutto anche solo per disegnare l'anteprima.
 */
import fs from "node:fs";
import { Readable } from "node:stream";
import { NotFoundError } from "./errors";

export interface ServeOptions {
  mime: string;
  /** Default: cache privata di un'ora. I file sono immutabili: si può alzare. */
  cacheControl?: string;
}

/** `bytes=0-1023`, `bytes=1024-` oppure `bytes=-500` (ultimi 500 byte). */
const RANGE_RE = /^bytes=(\d*)-(\d*)$/;

/** Intervallo richiesto, già normalizzato su `size`. null = intervallo assurdo. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = RANGE_RE.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;

  // suffisso "-N": gli ultimi N byte
  if (rawStart === "") {
    const len = Number(rawEnd);
    if (!Number.isFinite(len) || len <= 0) return null;
    return { start: Math.max(0, size - len), end: size - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start >= size) return null;
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

/**
 * Risposta per un file su disco. Gestisce 200, 206 (parziale), 304 (non
 * modificato) e 416 (intervallo non soddisfacibile).
 * Con `req.method === "HEAD"` risponde con i soli header.
 */
export async function serveFile(req: Request, absPath: string, opts: ServeOptions): Promise<Response> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(absPath);
  } catch {
    throw new NotFoundError("File non trovato");
  }
  if (!stat.isFile()) throw new NotFoundError("File non trovato");

  const size = stat.size;
  // Dimensione + data di modifica bastano: i file dei media non vengono mai
  // riscritti in place (ogni upload genera un nome nuovo).
  const etag = `"${size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": opts.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cacheControl ?? "private, max-age=3600",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
  });

  // Già in cache nel browser: nessun byte trasferito.
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const rangeHeader = req.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : null;

  if (rangeHeader && !range) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : size - 1;
  const length = end - start + 1;

  headers.set("Content-Length", String(length));
  if (range) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  // HEAD: solo header, nessun corpo (il browser lo usa per sondare il file).
  if (req.method === "HEAD") {
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  const stream = Readable.toWeb(
    fs.createReadStream(absPath, { start, end })
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(stream, { status: range ? 206 : 200, headers });
}

/** MIME dedotto dall'estensione: i file su disco non portano con sé il tipo. */
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

export function mimeFromExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  const ext = i >= 0 ? filename.slice(i).toLowerCase() : "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}
