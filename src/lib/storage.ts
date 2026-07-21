/**
 * Storage dei media su filesystem locale (DATA_DIR/media).
 * L'astrazione è minima: per passare a S3 basta reimplementare
 * queste quattro funzioni mantenendo le stesse firme.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env";

/** Salva un file e ritorna il filename univoco su disco. */
export async function saveFile(originalName: string, data: Buffer): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || "";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  await fs.promises.mkdir(env.mediaDir, { recursive: true });
  await fs.promises.writeFile(path.join(env.mediaDir, filename), data);
  return filename;
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
