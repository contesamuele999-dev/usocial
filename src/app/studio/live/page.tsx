"use client";
/**
 * Gestione dirette (prototipo). Crea una live su YouTube/Facebook (API RTMP),
 * mostra URL + stream key (per OBS) e permette di trasmettere direttamente dal
 * browser tramite il ponte RTMP del server. Per IG/TikTok/LinkedIn: annuncio.
 *
 * La trasmissione dal browser usa il corpo-richiesta in streaming (Chrome/Edge).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getPlatforms, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { Live, Platform } from "@/types";

export default function LivePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [lives, setLives] = useState<Live[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Live[]>("/api/live").then(setLives).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    getPlatforms().then(setPlatforms).catch(() => {});
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      await api<Live>("/api/live", {
        method: "POST",
        body: JSON.stringify({ platform, title, description: desc }),
      });
      setTitle("");
      setDesc("");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: Live) => {
    if (!confirm(t("live.confirmDelete"))) return;
    await api(`/api/live/${l.id}`, { method: "DELETE" });
    load();
  };

  const announce = (l: Live) => {
    const body = `${l.title || "Siamo in diretta!"}\n\n👉 ${l.watchUrl}`;
    try {
      sessionStorage.setItem(
        "editor.prefill",
        JSON.stringify({ body, hashtags: "", platforms: [l.platform] })
      );
    } catch {}
    router.push("/posts/new");
  };

  // solo le piattaforme con API di diretta
  const liveCapable = platforms.filter((p) => p.platform === "youtube" || p.platform === "facebook");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("live.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("live.subtitle")}</p>
        </div>
        <Link href="/studio" className="btn-secondary text-sm">
          ← {t("nav.studio")}
        </Link>
      </div>

      <div className="card border-amber-300 bg-amber-50 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        {t("live.apiNote")}
      </div>

      {/* Creazione diretta */}
      <div className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            {t("live.platform")}
            <select
              className="input mt-1"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              {(liveCapable.length ? liveCapable : [{ platform: "youtube", displayName: "YouTube" }, { platform: "facebook", displayName: "Facebook" }]).map((p) => (
                <option key={p.platform} value={p.platform}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            {t("live.liveTitle")}
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("live.liveDesc")}
          <textarea className="input mt-1 min-h-20 resize-y" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={create} disabled={busy}>
          {busy ? t("live.creating") : t("live.create")}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Elenco dirette */}
      {lives.length === 0 ? (
        <p className="text-sm text-gray-500">{t("live.empty")}</p>
      ) : (
        <div className="space-y-3">
          {lives.map((l) => (
            <LiveCard key={l.id} live={l} onDelete={() => remove(l)} onAnnounce={() => announce(l)} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Live["status"] }) {
  const { t } = useI18n();
  const map: Record<Live["status"], string> = {
    created: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    live: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    ended: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    error: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  const label = {
    created: t("live.statusCreated"),
    live: t("live.statusLive"),
    ended: t("live.statusEnded"),
    error: t("live.statusError"),
  }[status];
  return <span className={`badge ${map[status]}`}>{label}</span>;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="text-xs">
      <span className="text-gray-500">{label}</span>
      <div className="mt-0.5 flex items-center gap-2">
        <input readOnly className="input flex-1 font-mono text-xs" value={value} />
        <button className="btn-secondary px-2 py-1 text-xs" onClick={copy}>
          {copied ? t("live.copied") : t("live.copy")}
        </button>
      </div>
    </div>
  );
}

function LiveCard({
  live,
  onDelete,
  onAnnounce,
  onChanged,
}: {
  live: Live;
  onDelete: () => void;
  onAnnounce: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [onAir, setOnAir] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const enableCamera = async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setReady(true);
    } catch {
      setError(t("live.cameraError"));
    }
  };

  const goLive = async () => {
    const s = streamRef.current;
    if (!s) return;
    setError("");
    setOnAir(true);

    // Corpo-richiesta in streaming alimentato dal MediaRecorder.
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    const bodyStream = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });

    const mime = ["video/webm;codecs=vp8,opus", "video/webm"].find((m) =>
      MediaRecorder.isTypeSupported(m)
    );
    const recorder = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = async (e) => {
      if (e.data.size && controller) controller.enqueue(new Uint8Array(await e.data.arrayBuffer()));
    };
    recorder.onstop = () => controller?.close();
    recorder.start(250);

    try {
      await fetch(`/api/live/${live.id}/stream`, {
        method: "POST",
        body: bodyStream,
        // @ts-expect-error duplex è richiesto per il body in streaming (Chrome/Edge)
        duplex: "half",
        headers: { "Content-Type": "application/octet-stream" },
      });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setOnAir(false);
      onChanged();
    }
  };

  const endLive = async () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    await api(`/api/live/${live.id}/end`, { method: "POST" }).catch(() => {});
    setOnAir(false);
    setReady(false);
    onChanged();
  };

  const canStream = !!live.ingestUrl && !!live.streamKey && live.status !== "ended";

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={live.status} />
          <span className="font-medium">{live.title || `Live #${live.id}`}</span>
          <span className="text-xs uppercase text-gray-400">{live.platform}</span>
        </div>
        <div className="flex gap-1">
          <a href={live.watchUrl} target="_blank" className="btn-secondary px-2 py-1 text-xs">
            {t("live.watchUrl")} ↗
          </a>
          <button className="btn-secondary px-2 py-1 text-xs" onClick={onAnnounce}>
            {t("live.announce")}
          </button>
          <button className="btn-danger px-2 py-1 text-xs" onClick={onDelete}>
            {t("live.delete")}
          </button>
        </div>
      </div>

      {canStream && (
        <div className="grid gap-3 md:grid-cols-2">
          {/* dettagli RTMP per OBS */}
          <div className="space-y-2">
            <CopyRow label={t("live.rtmpUrl")} value={live.ingestUrl} />
            <CopyRow label={t("live.streamKey")} value={live.streamKey} />
            <p className="text-xs text-gray-500">{t("live.obsHint")}</p>
          </div>

          {/* trasmissione dal browser */}
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
              {onAir && (
                <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {t("live.onair")}
                </span>
              )}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button className="btn-primary" onClick={enableCamera}>
                    {t("live.enableCamera")}
                  </button>
                </div>
              )}
            </div>
            {ready && !onAir && (
              <button className="btn-primary w-full" onClick={goLive}>
                {t("live.goLive")}
              </button>
            )}
            {onAir && (
              <button className="btn-danger w-full" onClick={endLive}>
                {t("live.endLive")}
              </button>
            )}
            <p className="text-xs text-gray-500">{t("live.browserNote")}</p>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
