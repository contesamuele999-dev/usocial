/**
 * GET|HEAD /api/media/:id/:filename — serve il file binario del media.
 * ⚠️ Endpoint PUBBLICO (non richiede login): Instagram e Facebook scaricano
 * i media da questo URL e non possono inviare il cookie di sessione. Per questo
 * usa getMediaSystem (lookup per solo id). Il segmento :filename è decorativo
 * (es. "file.jpg") e serve solo a dare un URL con estensione riconoscibile.
 *
 * Il corpo viene inviato in streaming con supporto `Range` (vedi lib/serve.ts):
 * prima leggeva il file intero in un Buffer e ne faceva una seconda copia in un
 * Uint8Array, cioè due volte la dimensione del video in RAM a ogni richiesta.
 *
 * La UI usa invece /files/:nome, che Caddy può servire senza passare da Node;
 * questa rotta resta l'indirizzo pubblico stabile per le piattaforme social.
 */
import { NotFoundError, withErrorHandling } from "@/lib/errors";
import { getMediaSystem } from "@/lib/repo";
import { serveFile } from "@/lib/serve";
import { filePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; filename: string }> };

const handler = withErrorHandling<Ctx>("media", async (req, { params }) => {
  const { id } = await params;
  const item = getMediaSystem(Number(id));
  if (!item) throw new NotFoundError("Media non trovato");
  return serveFile(req, filePath(item.filename), {
    mime: item.mime,
    cacheControl: "public, max-age=3600",
  });
});

export const GET = handler;
export const HEAD = handler;
