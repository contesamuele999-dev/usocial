/**
 * Invio di file alle API social senza caricarli in RAM.
 *
 * Perché: `fs.readFile` + `new Uint8Array(buf)` teneva in memoria due copie del
 * video (un reel da 114 MB ≈ 230 MB di RAM) e sulla VM faceva uccidere il
 * processo dal kernel (OOM) — l'app diventava irraggiungibile.
 */
import fs from "node:fs";
import { Readable } from "node:stream";

/**
 * Parte di `RequestInit` che manda il contenuto di un file come body in
 * streaming. Da usare con lo spread: `fetch(url, { method: "PUT", headers, ...fileBody(path) })`.
 * `duplex: "half"` è richiesto da Node quando il body è uno stream.
 */
export function fileBody(path: string): RequestInit {
  return {
    body: Readable.toWeb(fs.createReadStream(path)) as unknown as BodyInit,
    duplex: "half",
  } as RequestInit;
}

/** Blob agganciato al file su disco (per i FormData multipart), senza leggerlo tutto. */
export function fileBlob(path: string, type: string): Promise<Blob> {
  return fs.openAsBlob(path, { type });
}
