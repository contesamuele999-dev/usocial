/**
 * Storage dei media su filesystem locale (DATA_DIR/media).
 * L'astrazione è minima: per passare a S3 basta reimplementare
 * queste quattro funzioni mantenendo le stesse firme.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "./env";
import { AppError } from "./errors";

/** Salva un file e ritorna il filename univoco su disco. */
export async function saveFile(originalName: string, data: Buffer): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || "";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  await fs.promises.mkdir(env.mediaDir, { recursive: true });
  await fs.promises.writeFile(path.join(env.mediaDir, filename), data);
  return filename;
}

/**
 * Salva uno stream direttamente su disco (nessun buffer in RAM): è così che
 * arrivano i video grossi, che con `Buffer.from(await file.arrayBuffer())`
 * facevano esplodere la memoria della VM (errore 500 su file da >100 MB).
 * Se lo stream supera `maxBytes` l'upload viene interrotto e il parziale rimosso.
 */
export async function saveStream(
  originalName: string,
  stream: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<{ filename: string; size: number }> {
  const ext = path.extname(originalName).toLowerCase() || "";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  await ensureMediaDir();
  let size = 0;
  try {
    await pipeline(
      (async function* () {
        for await (const chunk of Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0])) {
          const buf = chunk as Buffer;
          size += buf.length;
          if (size > maxBytes) {
            throw new AppError(
              "Spazio insufficiente: il file supera la quota disponibile. Elimina qualche media dalla Libreria.",
              413
            );
          }
          yield buf;
        }
      })(),
      fs.createWriteStream(path.join(env.mediaDir, filename))
    );
  } catch (err) {
    await deleteFile(filename); // niente file parziali sul disco
    throw err;
  }
  return { filename, size };
}

export function filePath(filename: string): string {
  // impedisce path traversal
  const safe = path.basename(filename);
  return path.join(env.mediaDir, safe);
}

/** Genera un filename univoco e il relativo percorso (senza scrivere nulla). */
export function newFilePath(ext: string): { filename: string; path: string } {
  const clean = ext.replace(/^\./, "").toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${clean}`;
  return { filename, path: path.join(env.mediaDir, filename) };
}

/** Assicura che la cartella dei media esista. */
export async function ensureMediaDir(): Promise<void> {
  await fs.promises.mkdir(env.mediaDir, { recursive: true });
}

export async function readFile(filename: string): Promise<Buffer> {
  return fs.promises.readFile(filePath(filename));
}

export async function deleteFile(filename: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath(filename));
  } catch {
    // già assente: ignora
  }
}

export function fileSize(filename: string): number {
  return fs.statSync(filePath(filename)).size;
}
