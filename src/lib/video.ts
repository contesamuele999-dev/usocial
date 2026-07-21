/**
 * Montaggio automatico video (server-side) con ffmpeg.
 * Usa il binario di `ffmpeg-static` (nessuna installazione di sistema): funziona
 * su Windows, macOS, Linux e Docker. Converte in MP4 pubblicabile (H.264 + AAC,
 * pixel yuv420p, +faststart), con trim e adattamento del formato opzionali.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";

// Caricato con createRequire per evitare problemi di tipi/bundling: il pacchetto
// esporta semplicemente il percorso del binario ffmpeg (stringa).
const nodeRequire = createRequire(import.meta.url);

export type VideoRatio = "keep" | "9:16" | "1:1" | "4:5" | "16:9";

export interface ConvertOptions {
  start?: number; // secondi di inizio (trim)
  end?: number; // secondi di fine (trim)
  ratio?: VideoRatio; // riquadratura di destinazione
  muted?: boolean; // rimuove l'audio
}

const DIMS: Record<Exclude<VideoRatio, "keep">, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "16:9": { w: 1920, h: 1080 },
};

/**
 * Percorso del binario ffmpeg. Priorità:
 *  1) variabile d'ambiente FFMPEG_PATH (utile in Docker con ffmpeg di sistema);
 *  2) binario incluso da ffmpeg-static;
 *  3) null se nessuno dei due è disponibile.
 */
export function ffmpegPath(): string | null {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    return (nodeRequire("ffmpeg-static") as string) || null;
  } catch {
    return null;
  }
}

function buildArgs(input: string, output: string, opts: ConvertOptions): string[] {
  const args = ["-y", "-i", input];

  // trim (dopo -i: preciso al fotogramma; le clip sono corte)
  if (opts.start && opts.start > 0) args.push("-ss", String(opts.start));
  if (opts.end && (!opts.start || opts.end > opts.start)) {
    const dur = opts.start ? opts.end - opts.start : opts.end;
    args.push("-t", String(dur));
  }

  // riquadratura: scala per coprire, poi ritaglia al centro
  if (opts.ratio && opts.ratio !== "keep") {
    const { w, h } = DIMS[opts.ratio];
    args.push(
      "-vf",
      `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`
    );
  }

  // codec pubblicabili sui social
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart"
  );

  if (opts.muted) args.push("-an");
  else args.push("-c:a", "aac", "-b:a", "128k");

  args.push(output);
  return args;
}

/**
 * Avvia un processo ffmpeg che legge un flusso video (WebM) da stdin e lo
 * ritrasmette in tempo reale via RTMP verso `target` (ingest della piattaforma).
 * Usato dal ponte browser→server per le dirette. Ritorna il processo: scrivi i
 * chunk su `proc.stdin` e chiama `proc.stdin.end()` a fine diretta.
 */
export function pushStreamToRtmp(target: string): ChildProcessWithoutNullStreams {
  const bin = ffmpegPath();
  if (!bin) throw new Error("ffmpeg non disponibile: esegui `npm install` (ffmpeg-static).");
  const args = [
    "-i", "pipe:0",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "60",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-f", "flv",
    target,
  ];
  return spawn(bin, args) as ChildProcessWithoutNullStreams;
}

/** Esegue la conversione. Rigetta con lo stderr di ffmpeg in caso di errore. */
export function convertToMp4(input: string, output: string, opts: ConvertOptions = {}): Promise<void> {
  const bin = ffmpegPath();
  if (!bin) {
    return Promise.reject(
      new Error("ffmpeg non disponibile: esegui `npm install` (pacchetto ffmpeg-static).")
    );
  }
  const args = buildArgs(input, output, opts);
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 8000) err = err.slice(-8000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg uscito con codice ${code}: ${err.slice(-500)}`));
    });
  });
}
