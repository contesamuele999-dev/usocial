/**
 * Trascrizione audio con Whisper LOCALE (offline). Estrae l'audio con ffmpeg e
 * chiama la CLI di Whisper (openai-whisper) per produrre un file SRT + testo.
 *
 * Configurazione (.env):
 *   WHISPER_PATH   percorso/comando della CLI whisper (default: "whisper")
 *   WHISPER_MODEL  modello (default: "base"); es. tiny, base, small, medium
 *   WHISPER_LANG   lingua forzata opzionale (es. "it"); vuoto = autodetect
 *
 * Se la CLI non è disponibile, `transcribe` ritorna null (degradazione morbida:
 * niente sottotitoli/descrizioni-da-parlato, il resto della pipeline continua).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ffmpegPath } from "./video";

export interface Transcript {
  srtPath: string; // file .srt (per bruciare i sottotitoli)
  text: string; // testo semplice (per la descrizione AI)
}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
    p.on("error", () => resolve({ code: -1, stderr: "spawn error" }));
    p.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

/** Legge un file SRT e ne ritorna il solo testo (o "" se assente). */
export function readSrtText(srtPath: string): string {
  try {
    return srtToText(fs.readFileSync(srtPath, "utf8"));
  } catch {
    return "";
  }
}

/** SRT → testo semplice (rimuove indici e timestamp). */
function srtToText(srt: string): string {
  return srt
    .split(/\r?\n\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((l) => !/^\d+$/.test(l) && !/-->/.test(l))
        .join(" ")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trascrive un file video/audio. Ritorna { srtPath, text } o null se Whisper
 * non è configurato/disponibile.
 */
export async function transcribe(inputPath: string): Promise<Transcript | null> {
  const ff = ffmpegPath();
  if (!ff) return null;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-whisper-"));
  const wav = path.join(workDir, "audio.wav");

  // 1) estrai audio mono 16kHz (formato atteso da whisper)
  const ex = await run(ff, ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wav]);
  if (ex.code !== 0 || !fs.existsSync(wav)) return null;

  // 2) trascrivi
  const whisperBin = process.env.WHISPER_PATH || "whisper";
  const model = process.env.WHISPER_MODEL || "base";
  const args = [wav, "--model", model, "--output_format", "srt", "--output_dir", workDir, "--task", "transcribe"];
  if (process.env.WHISPER_LANG) args.push("--language", process.env.WHISPER_LANG);

  const res = await run(whisperBin, args);
  if (res.code !== 0) return null;

  const srtPath = path.join(workDir, "audio.srt");
  if (!fs.existsSync(srtPath)) return null;
  const srt = fs.readFileSync(srtPath, "utf8");
  return { srtPath, text: srtToText(srt) };
}

/** Ritaglia un SRT a una finestra temporale [startSec, endSec] e riazzera i tempi. */
export function sliceSrt(srtPath: string, startSec: number, endSec: number, outPath: string): boolean {
  if (!fs.existsSync(srtPath)) return false;
  const toMs = (t: string) => {
    const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) return 0;
    return (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4];
  };
  const fmt = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const mn = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mm = ms % 1000;
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(h)}:${pad(mn)}:${pad(s)},${pad(mm, 3)}`;
  };
  const blocks = fs.readFileSync(srtPath, "utf8").split(/\r?\n\r?\n/);
  const startMs = startSec * 1000;
  const endMs = endSec * 1000;
  const out: string[] = [];
  let idx = 1;
  for (const b of blocks) {
    const m = b.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);
    if (!m) continue;
    const a = toMs(m[1]);
    const z = toMs(m[2]);
    if (z <= startMs || a >= endMs) continue;
    const text = b.split(/\r?\n/).slice(2).join("\n");
    out.push(`${idx++}\n${fmt(Math.max(0, a - startMs))} --> ${fmt(Math.max(0, z - startMs))}\n${text}`);
  }
  if (!out.length) return false;
  fs.writeFileSync(outPath, out.join("\n\n") + "\n");
  return true;
}
