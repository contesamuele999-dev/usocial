"use client";
/**
 * Studio di registrazione reel (prototipo): anteprima fotocamera + teleprompter
 * con lo script che scorre a schermo mentre registri. Al termine puoi rivedere
 * il video e salvarlo nella libreria media. Lo script può arrivare dallo
 * "Studio AI" (agente Script reel) tramite sessionStorage.
 *
 * Nota: MediaRecorder produce WebM sulla maggior parte dei browser; la
 * conversione automatica in MP4 (per la pubblicazione) arriverà col montaggio.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { MediaItem } from "@/types";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const prefs = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return prefs.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

function extFor(mime: string): string {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

export default function RecordPage() {
  const { t } = useI18n();
  const [script, setScript] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false); // camera attiva
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mirror, setMirror] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outFormat, setOutFormat] = useState<"9:16" | "1:1" | "4:5" | "keep">("9:16");

  // teleprompter
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(40); // px/s
  const [fontSize, setFontSize] = useState(28);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");
  const blobRef = useRef<Blob | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported = typeof MediaRecorder !== "undefined";

  // Script precompilato dallo Studio AI (se presente).
  useEffect(() => {
    try {
      const s = sessionStorage.getItem("studio.reelScript");
      if (s) {
        setScript(s);
        sessionStorage.removeItem("studio.reelScript");
      }
    } catch {}
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const enableCamera = useCallback(
    async (mode: "user" | "environment" = facing) => {
      setError("");
      try {
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        streamRef.current = stream;
        if (liveRef.current) liveRef.current.srcObject = stream;
        setReady(true);
      } catch {
        setError(t("recorder.cameraError"));
        setReady(false);
      }
    },
    [facing, stopStream, t]
  );

  const switchCamera = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (ready) await enableCamera(next);
  };

  // Teleprompter auto-scroll con requestAnimationFrame.
  useEffect(() => {
    if (!scrolling) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTsRef.current = performance.now();
    const step = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const el = promptRef.current;
      if (el) {
        el.scrollTop += speed * dt;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) setScrolling(false);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, speed]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setSaved(false);
    chunksRef.current = [];
    const mime = pickMimeType();
    mimeRef.current = mime;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      blobRef.current = blob;
      setRecordedUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    // avvia lo scorrimento del teleprompter dall'inizio
    if (promptRef.current) promptRef.current.scrollTop = 0;
    setScrolling(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    setScrolling(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const rerecord = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setSaved(false);
    blobRef.current = null;
    if (promptRef.current) promptRef.current.scrollTop = 0;
  };

  const uploadRecording = async (): Promise<MediaItem | null> => {
    if (!blobRef.current) return null;
    const ext = extFor(mimeRef.current);
    const name = `reel-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
    const file = new File([blobRef.current], name, { type: blobRef.current.type });
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "reel");
    form.append("tags", "reel,registrazione");
    return api<MediaItem>("/api/media", { method: "POST", body: form });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await uploadRecording();
      setSaved(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  };

  // Salva la registrazione e la converte subito in MP4 pubblicabile.
  const saveAsMp4 = async () => {
    setSaving(true);
    setError("");
    try {
      const created = await uploadRecording();
      if (!created) return;
      setSaving(false);
      setConverting(true);
      await api(`/api/media/${created.id}/convert`, {
        method: "POST",
        body: JSON.stringify({ ratio: outFormat }),
      });
      setSaved(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
      setConverting(false);
    }
  };

  // Pulizia allo smontaggio.
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stopStream]);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("recorder.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("recorder.subtitle")}</p>
        </div>
        <Link href="/studio" className="text-sm text-brand-600 hover:underline">
          ← {t("nav.studio")}
        </Link>
      </div>

      {!supported && <div className="card text-sm text-red-500">{t("recorder.notSupported")}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Anteprima + teleprompter */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "9 / 16", maxHeight: "70vh" }}>
            {/* video live oppure registrato */}
            {recordedUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={recordedUrl} controls className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={liveRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: mirror && facing === "user" ? "scaleX(-1)" : undefined }}
              />
            )}

            {/* overlay teleprompter (solo in modalità camera) */}
            {!recordedUrl && script.trim() && (
              <div
                ref={promptRef}
                className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto scroll-smooth bg-black/55 px-5 py-4 text-center font-semibold leading-relaxed text-white"
                style={{ fontSize }}
              >
                <div className="whitespace-pre-wrap pb-[40%] pt-2">{script}</div>
              </div>
            )}

            {/* badge REC + timer */}
            {recording && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC {mmss}
              </div>
            )}

            {/* placeholder camera spenta */}
            {!ready && !recordedUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="btn-primary" onClick={() => enableCamera()} disabled={!supported}>
                  {t("recorder.enableCamera")}
                </button>
              </div>
            )}
          </div>

          {/* controlli registrazione */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ready && !recordedUrl && !recording && (
              <button className="btn-primary" onClick={startRecording}>
                {t("recorder.start")}
              </button>
            )}
            {recording && (
              <button className="btn-danger" onClick={stopRecording}>
                {t("recorder.stop")}
              </button>
            )}
            {recordedUrl && (
              <>
                <button className="btn-secondary" onClick={rerecord} disabled={saving || converting}>
                  {t("recorder.rerecord")}
                </button>
                <select
                  className="input w-auto text-sm"
                  value={outFormat}
                  onChange={(e) => setOutFormat(e.target.value as typeof outFormat)}
                  title={t("recorder.format")}
                >
                  <option value="9:16">{t("video.r916")}</option>
                  <option value="1:1">{t("video.r11")}</option>
                  <option value="4:5">{t("video.r45")}</option>
                  <option value="keep">{t("video.keep")}</option>
                </select>
                <button className="btn-primary" onClick={saveAsMp4} disabled={saving || converting}>
                  {converting ? t("recorder.converting") : saving ? t("recorder.saving") : t("recorder.saveMp4")}
                </button>
                <button className="btn-secondary" onClick={save} disabled={saving || converting}>
                  {t("recorder.save")}
                </button>
                {saved && <span className="text-sm text-green-600">{t("recorder.saved")}</span>}
              </>
            )}
            {ready && !recording && !recordedUrl && (
              <>
                <button className="btn-secondary text-xs" onClick={switchCamera}>
                  {t("recorder.switchCamera")}
                </button>
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="accent-brand-600" />
                  {t("recorder.mirror")}
                </label>
              </>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {recordedUrl && <p className="mt-2 text-xs text-gray-500">{t("recorder.webmNote")}</p>}
        </div>

        {/* Script + impostazioni teleprompter */}
        <div className="space-y-4">
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("recorder.scriptTitle")}</span>
              {ready && !recordedUrl && (
                <div className="flex gap-1">
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setScrolling((s) => !s)}>
                    {scrolling ? t("recorder.pause") : t("recorder.play")}
                  </button>
                  <button
                    className="btn-secondary px-2 py-1 text-xs"
                    onClick={() => {
                      if (promptRef.current) promptRef.current.scrollTop = 0;
                      setScrolling(false);
                    }}
                  >
                    {t("recorder.restart")}
                  </button>
                </div>
              )}
            </div>
            <textarea
              className="input min-h-40 resize-y text-sm"
              placeholder={t("recorder.scriptPlaceholder")}
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <label className="block text-xs text-gray-500">
              {t("recorder.scroll")}: {speed} px/s
              <input type="range" min={10} max={120} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-brand-600" />
            </label>
            <label className="block text-xs text-gray-500">
              {t("recorder.fontSize")}: {fontSize}px
              <input type="range" min={16} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full accent-brand-600" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
