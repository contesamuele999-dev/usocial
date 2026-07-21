"use client";
/**
 * Repurpose video (prototipo): da un video lungo genera più clip con hook,
 * sottotitoli (Whisper), descrizione AI, copertina e b-roll opzionali.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { MediaItem } from "@/types";

interface ClipResult {
  index: number;
  clipMediaId: number;
  coverMediaId: number | null;
  description: string;
  brollMediaIds: number[];
  postId: number | null;
}

export default function RepurposePage() {
  const { t } = useI18n();
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [mediaId, setMediaId] = useState<number | "">("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [clipSeconds, setClipSeconds] = useState(30);
  const [maxClips, setMaxClips] = useState(5);
  const [ratio, setRatio] = useState<"9:16" | "1:1" | "4:5" | "keep">("9:16");
  const [hookText, setHookText] = useState("");
  const [fontSize, setFontSize] = useState(64);
  const [color, setColor] = useState("#ffffff");
  const [bg, setBg] = useState("#000000");
  const [position, setPosition] = useState<"top" | "center" | "bottom">("top");
  const [seconds, setSeconds] = useState(3);
  const [subtitles, setSubtitles] = useState(true);
  const [describe, setDescribe] = useState(true);
  const [broll, setBroll] = useState(false);
  const [createPosts, setCreatePosts] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ClipResult[]>([]);
  const [done, setDone] = useState("");

  const loadVideos = useCallback(() => {
    api<{ items: MediaItem[] }>("/api/media").then((r) =>
      setVideos(r.items.filter((m) => m.mime.startsWith("video/")))
    );
  }, []);
  useEffect(() => loadVideos(), [loadVideos]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const item = await api<MediaItem>("/api/media", {
        method: "POST",
        body: (() => {
          const f = new FormData();
          f.append("file", files[0]);
          f.append("folder", "sorgenti");
          return f;
        })(),
      });
      await loadVideos();
      setMediaId(item.id);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
    }
  };

  const run = async () => {
    if (!mediaId) {
      setError(t("repurpose.needSource"));
      return;
    }
    setBusy(true);
    setError("");
    setResults([]);
    setDone("");
    try {
      const r = await api<{ clips: ClipResult[] }>("/api/repurpose", {
        method: "POST",
        body: JSON.stringify({
          mediaId,
          clipSeconds,
          maxClips,
          ratio,
          hook: { text: hookText, fontSize, color, bg, position, seconds },
          subtitles,
          describe,
          broll,
          createPosts,
        }),
      });
      setResults(r.clips);
      setDone(t("repurpose.done", { n: r.clips.length }));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("repurpose.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("repurpose.subtitle")}</p>
        </div>
        <Link href="/studio" className="btn-secondary text-sm">
          ← {t("nav.studio")}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Configurazione */}
        <div className="space-y-4 lg:col-span-1">
          <div className="card space-y-3">
            <label className="block text-sm font-medium">
              {t("repurpose.source")}
              <select
                className="input mt-1"
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">—</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.originalName}
                  </option>
                ))}
              </select>
            </label>
            {videos.length === 0 && <p className="text-xs text-gray-500">{t("repurpose.noVideos")}</p>}
            <button className="btn-secondary w-full text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? t("repurpose.uploading") : t("repurpose.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
          </div>

          <div className="card grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              {t("repurpose.clipSeconds")}
              <input type="number" min={5} max={180} className="input mt-1" value={clipSeconds} onChange={(e) => setClipSeconds(Number(e.target.value) || 30)} />
            </label>
            <label className="block text-sm font-medium">
              {t("repurpose.maxClips")}
              <input type="number" min={1} max={20} className="input mt-1" value={maxClips} onChange={(e) => setMaxClips(Number(e.target.value) || 5)} />
            </label>
            <label className="col-span-2 block text-sm font-medium">
              {t("repurpose.ratio")}
              <select className="input mt-1" value={ratio} onChange={(e) => setRatio(e.target.value as typeof ratio)}>
                <option value="9:16">{t("video.r916")}</option>
                <option value="1:1">{t("video.r11")}</option>
                <option value="4:5">{t("video.r45")}</option>
                <option value="keep">{t("video.keep")}</option>
              </select>
            </label>
          </div>

          <div className="card space-y-2">
            <label className="block text-sm font-medium">
              {t("repurpose.hookText")}
              <input className="input mt-1" placeholder={t("repurpose.hookTextPlaceholder")} value={hookText} onChange={(e) => setHookText(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-gray-500">
                {t("repurpose.fontSize")}
                <input type="number" min={24} max={140} className="input mt-1" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 64)} />
              </label>
              <label className="block text-xs text-gray-500">
                {t("repurpose.seconds")}
                <input type="number" min={1} max={10} className="input mt-1" value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 3)} />
              </label>
              <label className="block text-xs text-gray-500">
                {t("repurpose.color")}
                <input type="color" className="input mt-1 h-9 p-1" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
              <label className="block text-xs text-gray-500">
                {t("repurpose.bg")}
                <input type="color" className="input mt-1 h-9 p-1" value={bg} onChange={(e) => setBg(e.target.value)} />
              </label>
              <label className="col-span-2 block text-xs text-gray-500">
                {t("repurpose.position")}
                <select className="input mt-1" value={position} onChange={(e) => setPosition(e.target.value as typeof position)}>
                  <option value="top">{t("repurpose.posTop")}</option>
                  <option value="center">{t("repurpose.posCenter")}</option>
                  <option value="bottom">{t("repurpose.posBottom")}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} />{t("repurpose.subtitles")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={describe} onChange={(e) => setDescribe(e.target.checked)} />{t("repurpose.describe")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={broll} onChange={(e) => setBroll(e.target.checked)} />{t("repurpose.broll")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={createPosts} onChange={(e) => setCreatePosts(e.target.checked)} />{t("repurpose.createPosts")}</label>
            <p className="text-xs text-gray-500">{t("repurpose.whisperNote")}</p>
            {broll && <p className="text-xs text-gray-500">{t("repurpose.brollNote")}</p>}
            <button className="btn-primary w-full" onClick={run} disabled={busy}>
              {busy ? t("repurpose.running") : t("repurpose.run")}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {done && <p className="text-sm text-green-600">{done}</p>}
          </div>
        </div>

        {/* Risultati */}
        <div className="lg:col-span-2">
          {results.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500">{busy ? t("repurpose.running") : t("repurpose.results")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((c) => (
                <div key={c.index} className="card space-y-2">
                  <p className="text-sm font-semibold">{t("repurpose.clip", { n: c.index })}</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={`/api/media/${c.clipMediaId}/file.mp4`} controls className="w-full rounded-lg" style={{ maxHeight: 300 }} />
                  {c.description && <p className="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">{c.description}</p>}
                  {c.postId && (
                    <Link href={`/posts/${c.postId}`} className="text-xs text-brand-600 hover:underline">
                      {t("repurpose.openPost")}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
