/**
 * POST /api/live/:id/stream — ponte RTMP: riceve il flusso video del browser
 * (WebM da MediaRecorder, corpo della richiesta in streaming) e lo ritrasmette
 * in tempo reale all'ingest RTMP della piattaforma tramite ffmpeg.
 *
 * Nota: richiede un browser che supporti il corpo-richiesta in streaming
 * (Chrome/Edge, `duplex: "half"`). In alternativa usa l'URL RTMP + stream key
 * con OBS o l'app mobile della piattaforma.
 */
import { NotFoundError, AppError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { getLive, setLiveStatus } from "@/lib/repo";
import { pushStreamToRtmp } from "@/lib/video";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 3600; // dirette fino a 1 ora

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>("live", async (req, { params }, user) => {
  const id = Number((await params).id);
  const live = getLive(id, user.id);
  if (!live) throw new NotFoundError("Diretta non trovata");
  if (!live.ingestUrl || !live.streamKey) throw new AppError("Diretta senza endpoint RTMP");
  if (!req.body) throw new AppError("Nessun flusso video ricevuto");

  const target = `${live.ingestUrl.replace(/\/$/, "")}/${live.streamKey}`;
  const proc = pushStreamToRtmp(target);
  setLiveStatus(id, user.id, "live");

  let ffmpegErr = "";
  proc.stderr.on("data", (d) => {
    ffmpegErr = (ffmpegErr + d.toString()).slice(-2000);
  });

  try {
    const reader = req.body.getReader();
    // travasa i chunk del browser nello stdin di ffmpeg
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && !proc.stdin.destroyed) proc.stdin.write(Buffer.from(value));
    }
    proc.stdin.end();
    await new Promise<void>((resolve) => proc.on("close", () => resolve()));
    setLiveStatus(id, user.id, "ended");
    return Response.json({ ok: true });
  } catch (err) {
    try {
      proc.kill("SIGKILL");
    } catch {}
    setLiveStatus(id, user.id, "error");
    logger.error("live", `Streaming diretta #${id} interrotto`, ffmpegErr || String(err), user.id);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
