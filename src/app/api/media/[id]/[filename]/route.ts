/**
 * GET /api/media/:id/:filename — serve il file binario del media.
 * ⚠️ Endpoint PUBBLICO (non richiede login): Instagram e Facebook scaricano
 * i media da questo URL e non possono inviare il cookie di sessione. Per questo
 * usa getMediaSystem (lookup per solo id). Il segmento :filename è decorativo
 * (es. "file.jpg") e serve solo a dare un URL con estensione riconoscibile.
 */
import { NotFoundError, withErrorHandling } from "@/lib/errors";
import { getMediaSystem } from "@/lib/repo";
import { readFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; filename: string }> };

export const GET = withErrorHandling<Ctx>("media", async (_req, { params }) => {
  const { id } = await params;
  const item = getMediaSystem(Number(id));
  if (!item) throw new NotFoundError("Media non trovato");
  const buf = await readFile(item.filename);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": item.mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
});
