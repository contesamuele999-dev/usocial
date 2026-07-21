/**
 * Rendering delle slide di un carosello su <canvas> (lato client) usando il
 * brand kit del template. Produce PNG ad alta risoluzione, scaricabili o
 * salvabili nella libreria media. Nessuna dipendenza server (ffmpeg non serve
 * per le immagini).
 */
import type { BrandKit, CarouselSlide } from "@/types";

export type Ratio = "4:5" | "1:1" | "9:16";

/** Dimensioni in pixel per ciascun rapporto (lato lungo ~1350px, qualità social). */
export function dimsFor(ratio: Ratio): { w: number; h: number } {
  switch (ratio) {
    case "1:1":
      return { w: 1080, h: 1080 };
    case "9:16":
      return { w: 1080, h: 1920 };
    case "4:5":
    default:
      return { w: 1080, h: 1350 };
  }
}

/** Spezza `text` in righe che stanno entro `maxWidth` per il font corrente del ctx. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Disegna una singola slide su un canvas e lo ritorna. */
export function renderSlide(
  slide: CarouselSlide,
  brand: BrandKit,
  index: number,
  total: number,
  ratio: Ratio = "4:5"
): HTMLCanvasElement {
  const { w, h } = dimsFor(ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const pad = Math.round(w * 0.09);

  // sfondo
  ctx.fillStyle = brand.bg;
  ctx.fillRect(0, 0, w, h);

  // barra accento in alto
  ctx.fillStyle = brand.accent;
  ctx.fillRect(pad, pad, Math.round(w * 0.16), Math.round(h * 0.01));

  // numero slide in alto a destra
  ctx.fillStyle = brand.accent;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = `bold ${Math.round(w * 0.038)}px ${brand.font}`;
  ctx.fillText(`${index + 1}/${total}`, w - pad, pad);

  const maxW = w - pad * 2;

  // headline
  ctx.textAlign = "left";
  ctx.fillStyle = brand.text;
  const hSize = Math.round(w * 0.075);
  ctx.font = `bold ${hSize}px ${brand.font}`;
  const hLines = wrapLines(ctx, slide.headline || "", maxW);
  const hLineH = hSize * 1.15;

  // body
  const bSize = Math.round(w * 0.046);
  const bLineH = bSize * 1.35;
  ctx.font = `${bSize}px ${brand.font}`;
  const bLines = wrapLines(ctx, slide.body || "", maxW);

  // blocco centrato verticalmente
  const blockH = hLines.length * hLineH + (bLines.length ? Math.round(h * 0.03) + bLines.length * bLineH : 0);
  let y = Math.max(pad + Math.round(h * 0.12), (h - blockH) / 2);

  ctx.fillStyle = brand.text;
  ctx.font = `bold ${hSize}px ${brand.font}`;
  for (const line of hLines) {
    ctx.fillText(line, pad, y);
    y += hLineH;
  }
  y += Math.round(h * 0.03);
  ctx.font = `${bSize}px ${brand.font}`;
  ctx.globalAlpha = 0.92;
  for (const line of bLines) {
    ctx.fillText(line, pad, y);
    y += bLineH;
  }
  ctx.globalAlpha = 1;

  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob fallito"))), "image/png")
  );
}

/** Ritorna i PNG (blob) di tutte le slide. */
export async function renderSlidesToBlobs(
  slides: CarouselSlide[],
  brand: BrandKit,
  ratio: Ratio
): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (let i = 0; i < slides.length; i++) {
    blobs.push(await toBlob(renderSlide(slides[i], brand, i, slides.length, ratio)));
  }
  return blobs;
}

/** Forza il download di un blob con un nome file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
