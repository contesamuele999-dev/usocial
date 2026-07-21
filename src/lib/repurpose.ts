/**
 * Pipeline di "repurposing" video con ffmpeg: da un video lungo a più clip
 * verticali, con hook testuale iniziale (stile configurabile), sottotitoli
 * bruciati (da SRT) e copertina estratta come frame.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ffmpegPath } from "./video";

export type ClipRatio = "9:16" | "1:1" | "4:5" | "keep";

export interface HookStyle {
  text: string;
  fontSize: number; // px sul lato 1080
  color: string; // es. #ffffff
  bg: string; // colore box, es. #000000
  position: "top" | "center" | "bottom";
  seconds: number; // per quanti secondi mostrarlo
}

const DIMS: Record<Exclude<ClipRatio, "keep">, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
};

function run(bin: string, args: string[], cwd?: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, cwd ? { cwd } : undefined);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr = (stderr + d).slice(-6000)));
    p.on("error", () => resolve({ code: -1, stderr: "spawn error" }));
    p.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

function bin(): string {
  const b = ffmpegPath();
  if (!b) throw new Error("ffmpeg non disponibile: esegui `npm install` (ffmpeg-static).");
  return b;
}

/** Durata del video in secondi (parsing dallo stderr di ffmpeg). */
export async function probeDuration(input: string): Promise<number> {
  const { stderr } = await run(bin(), ["-i", input, "-f", "null", "-"]);
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (!m) return 0;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100;
}

/** Suddivide la durata in finestre [start,end] di `clipSeconds` (max `maxClips`). */
export function planClips(
  duration: number,
  clipSeconds: number,
  maxClips: number
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let start = 0;
  while (start < duration - 1 && out.length < maxClips) {
    out.push({ start, end: Math.min(start + clipSeconds, duration) });
    start += clipSeconds;
  }
  return out;
}

/** Escape di una stringa per il filtro drawtext di ffmpeg. */
function escDrawtext(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’") // apostrofo tipografico per evitare problemi di quoting
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

function hookFilter(h: HookStyle, ratioW: number): string | null {
  if (!h.text.trim()) return null;
  const size = Math.round((h.fontSize / 1080) * ratioW);
  const y =
    h.position === "top" ? "h*0.08" : h.position === "center" ? "(h-text_h)/2" : "h*0.82";
  return (
    `drawtext=text='${escDrawtext(h.text)}':` +
    `fontcolor=${h.color}:fontsize=${size}:box=1:boxcolor=${h.bg}@0.6:boxborderw=20:` +
    `x=(w-text_w)/2:y=${y}:enable='lte(t,${h.seconds})'`
  );
}

export interface RenderClipOptions {
  input: string;
  start: number;
  end: number;
  out: string;
  ratio: ClipRatio;
  hook?: HookStyle;
  srtPath?: string; // sottotitoli già ritagliati alla finestra della clip
}

/** Renderizza una singola clip: taglio + riquadratura + hook + sottotitoli. */
export async function renderClip(opts: RenderClipOptions): Promise<void> {
  const filters: string[] = [];
  const ratioW = opts.ratio === "keep" ? 1080 : DIMS[opts.ratio].w;

  if (opts.ratio !== "keep") {
    const { w, h } = DIMS[opts.ratio];
    filters.push(`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`, "setsar=1");
  }

  // sottotitoli: eseguiamo ffmpeg nella cartella del file SRT per evitare
  // problemi di escaping dei percorsi (Windows/spazi).
  let cwd: string | undefined;
  if (opts.srtPath && fs.existsSync(opts.srtPath)) {
    cwd = path.dirname(opts.srtPath);
    filters.push(`subtitles=${path.basename(opts.srtPath)}:force_style='Fontsize=16,Outline=1'`);
  }

  if (opts.hook) {
    const hf = hookFilter(opts.hook, ratioW);
    if (hf) filters.push(hf);
  }

  const args = [
    "-y",
    "-ss", String(opts.start),
    "-i", opts.input,
    "-t", String(opts.end - opts.start),
  ];
  if (filters.length) args.push("-vf", filters.join(","));
  args.push(
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    opts.out
  );

  const { code, stderr } = await run(bin(), args, cwd);
  if (code !== 0) throw new Error(`ffmpeg clip fallito: ${stderr.slice(-400)}`);
}

/** Estrae un frame come immagine di copertina. */
export async function extractCover(input: string, atSec: number, out: string): Promise<void> {
  const { code, stderr } = await run(bin(), [
    "-y", "-ss", String(atSec), "-i", input, "-frames:v", "1", "-q:v", "3", out,
  ]);
  if (code !== 0) throw new Error(`ffmpeg copertina fallita: ${stderr.slice(-300)}`);
}

/** Cartella temporanea di lavoro. */
export function tmpWorkDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "usocial-repurpose-"));
}
