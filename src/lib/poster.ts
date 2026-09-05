/**
 * Fotogrammi di anteprima dei video della Libreria.
 *
 * Vive in un modulo suo perché lo usano tre punti diversi: l'upload, il
 * montaggio (che produce un nuovo mp4) e la rotta `/files/:nome.poster.jpg`,
 * che lo genera al volo per i video caricati prima di questa funzione.
 */
import { logger } from "./logger";
import { filePath, posterPath } from "./storage";
import { extractPoster } from "./video";

/**
 * Genera il poster di un video in sottofondo, senza far aspettare la risposta
 * HTTP. Se ffmpeg non ce la fa il motivo finisce nei Log: prima l'unico
 * sintomo era una griglia di riquadri vuoti, senza spiegazione.
 */
export function warmPoster(filename: string, mime: string, userId?: number): void {
  if (!mime.startsWith("video/")) return;
  void extractPoster(filePath(filename), posterPath(filename))
    .then((res) => {
      if (!res.ok) logger.warn("media", `Anteprima non generata per ${filename}`, res.error, userId);
    })
    .catch((err) => logger.warn("media", `Anteprima non generata per ${filename}`, String(err), userId));
}
