/**
 * Montaggio automatico video (server-side) con ffmpeg.
 * Usa il binario di `ffmpeg-static` (nessuna installazione di sistema): funziona
 * su Windows, macOS, Linux e Docker. Converte in MP4 pubblicabile (H.264 + AAC,
 * pixel yuv420p, +faststart), con trim e adattamento del formato opzionali.
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

// Caricato con createRequire per evitare problemi di tipi/bundling: il pacchetto
// esporta semplicemente il percorso del binario ffmpeg (stringa).
const nodeRequire = createRequire(import.meta.url);

export type VideoRatio = "keep" | "9:16" | "1:1" | "4:5" | "16:9";

export interface ConvertOptions {
  start?: number; // secondi di inizio (trim)
  end?: number; // secondi di fine (trim)
  ratio?: VideoRatio; // riquadratura di destinazione
  muted?: boolean; // rimuove l'audio
  /** Percorso di un .srt da "bruciare" nel video (sottotitoli automatici). */
  srtPath?: string;
  /** Dimensione dei sottotitoli (px sul lato 1080). Default 44. */
  subtitleSize?: number;
}

const DIMS: Record<Exclude<VideoRatio, "keep">, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "16:9": { w: 1920, h: 1080 },
};

/**
 * Verifica che un percorso sia un binario realmente presente su disco.
 * NB: ritorna `boolean` (non un type predicate) di proposito, così TypeScript
 * non restringe la variabile a `never` nel ramo negativo.
 */
function isRunnable(p: string | null | undefined): boolean {
  if (!p) return false;
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Cerca un binario nel PATH di sistema (Linux/macOS: which, Windows: where). */
function fromSystemPath(name: string): string | null {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const r = spawnSync(finder, [name], { encoding: "utf8" });
    if (r.status !== 0 || !r.stdout) return null;
    const first = r.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || "";
    return isRunnable(first) ? first : null;
  } catch {
    return null;
  }
}

/**
 * Risolve un binario ffmpeg/ffprobe con più fallback, in ordine:
 *  1) variabile d'ambiente esplicita (FFMPEG_PATH / FFPROBE_PATH);
 *  2) binario di ffmpeg-static, ma SOLO se esiste davvero su disco;
 *  3) binario di sistema trovato nel PATH;
 *  4) percorsi comuni su Linux (VM/Docker).
 *
 * Il passaggio 2 è fondamentale: `npm install` su Windows scarica `ffmpeg.exe`,
 * che su una VM Linux non è eseguibile. Prima il percorso veniva restituito
 * comunque e ogni spawn falliva con ENOENT, che l'app mostrava come generico
 * "errore interno" / "impossibile leggere la durata del video".
 */
function resolveBinary(kind: "ffmpeg" | "ffprobe"): string | null {
  const envVar = (kind === "ffmpeg" ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH) || "";
  if (isRunnable(envVar)) return envVar;

  if (kind === "ffmpeg") {
    try {
      const stat: string = (nodeRequire("ffmpeg-static") as string) || "";
      if (isRunnable(stat)) return stat;
      // il pacchetto punta a un binario di un'altra piattaforma: prova la
      // variante senza/con .exe nella stessa cartella prima di rinunciare.
      if (stat) {
        const alt = stat.endsWith(".exe") ? stat.slice(0, -4) : `${stat}.exe`;
        if (isRunnable(alt)) return alt;
      }
    } catch {
      /* pacchetto assente: si prosegue coi fallback di sistema */
    }
  }

  const sys = fromSystemPath(kind);
  if (sys) return sys;

  for (const p of [`/usr/bin/${kind}`, `/usr/local/bin/${kind}`, `/snap/bin/${kind}`]) {
    if (isRunnable(p)) return p;
  }
  return null;
}

/** Percorso del binario ffmpeg (null se non disponibile). */
export function ffmpegPath(): string | null {
  return resolveBinary("ffmpeg");
}

/** Percorso di ffprobe, se disponibile (usato per leggere la durata in modo affidabile). */
export function ffprobePath(): string | null {
  return resolveBinary("ffprobe");
}

/**
 * Messaggio d'errore uniforme quando manca ffmpeg: spiega all'utente cosa fare
 * invece di lasciare un ENOENT criptico.
 */
export function ffmpegMissingMessage(): string {
  return (
    "ffmpeg non disponibile sul server. Sulla VM installalo con " +
    "`sudo apt-get install -y ffmpeg`, oppure esegui `npm install` sulla stessa " +
    "piattaforma del server, o imposta FFMPEG_PATH nel file .env."
  );
}

function buildArgs(input: string, output: string, opts: ConvertOptions): string[] {
  const args = ["-y", "-i", input];

  // trim (dopo -i: preciso al fotogramma; le clip sono corte)
  if (opts.start && opts.start > 0) args.push("-ss", String(opts.start));
  if (opts.end && (!opts.start || opts.end > opts.start)) {
    const dur = opts.start ? opts.end - opts.start : opts.end;
    args.push("-t", String(dur));
  }

  // catena di filtri: prima la riquadratura, poi i sottotitoli (così il testo
  // viene disegnato sulle dimensioni finali e non risulta stirato dal crop).
  const filters: string[] = [];
  const outW = opts.ratio && opts.ratio !== "keep" ? DIMS[opts.ratio].w : 1080;

  if (opts.ratio && opts.ratio !== "keep") {
    const { w, h } = DIMS[opts.ratio];
    filters.push(
      `scale=${w}:${h}:force_original_aspect_ratio=increase`,
      `crop=${w}:${h}`,
      "setsar=1"
    );
  }

  if (opts.srtPath) {
    // Stile "social": testo bianco grande, bordo nero marcato, in basso.
    // Fontsize ASS è in punti su una base di 384px di altezza: riscaliamo.
    const size = Math.round(((opts.subtitleSize ?? 44) / 1080) * outW * 0.36);
    const style = [
      `Fontsize=${size}`,
      "Fontname=Arial",
      "PrimaryColour=&H00FFFFFF",
      "OutlineColour=&H00000000",
      "BorderStyle=1",
      "Outline=3",
      "Shadow=0",
      "Bold=1",
      "Alignment=2", // in basso al centro
      "MarginV=90",
    ].join(",");
    // il chiamante esegue ffmpeg nella cartella del .srt, quindi basta il nome
    filters.push(`subtitles=${path.basename(opts.srtPath)}:force_style='${style}'`);
  }

  if (filters.length) args.push("-vf", filters.join(","));

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
  if (!bin) throw new Error(ffmpegMissingMessage());
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
  if (!bin) return Promise.reject(new Error(ffmpegMissingMessage()));
  const args = buildArgs(input, output, opts);
  // Con i sottotitoli eseguiamo ffmpeg nella cartella del .srt: il filtro
  // `subtitles` ha un escaping dei percorsi fragile (spazi, ':' di Windows),
  // quindi gli passiamo solo il nome del file.
  const cwd = opts.srtPath ? path.dirname(opts.srtPath) : undefined;
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, cwd ? { cwd } : undefined);
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

/** Esegue ffmpeg con gli argomenti dati; risolve true se esce con codice 0. */
function runFfmpeg(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(bin, args);
    proc.stderr.on("data", () => {
      /* scartato: qui interessa solo se il fotogramma è stato prodotto */
    });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Estrae un fotogramma di anteprima (JPEG ridotto) da un video.
 *
 * Serve alla Libreria: senza poster la griglia usava <video src=…> per ogni
 * elemento, cioè scaricava ogni video per intero solo per mostrare un'immagine
 * ferma. Il poster pesa qualche decina di KB ed è generato una volta sola.
 *
 * `-ss` prima di `-i` fa il seek rapido sui keyframe: su un video lungo evita di
 * decodificare dall'inizio, cosa che sulla VM costerebbe secondi di CPU.
 */
export async function extractPoster(input: string, output: string, atSeconds = 1): Promise<boolean> {
  const bin = ffmpegPath();
  if (!bin) return false;
  const args = (ss: number) => [
    "-ss", String(ss),
    "-i", input,
    "-frames:v", "1",
    // non ingrandisce i video più stretti di 480px
    "-vf", "scale='min(480,iw)':-2",
    "-q:v", "6",
    "-y", output,
  ];
  const ok = await runFfmpeg(bin, args(atSeconds));
  if (ok && isRunnable(output)) return true;
  // Video più corto del punto di seek: riprova dal primo fotogramma.
  const retry = await runFfmpeg(bin, args(0));
  return retry && isRunnable(output);
}
