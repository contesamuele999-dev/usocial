"use client";
/**
 * Selettore media per l'editor: mostra la libreria, permette upload rapido
 * (pulsante o drag & drop, con barra di avanzamento) e selezione multipla
 * (per i caroselli l'ordine di selezione conta).
 * Avvisa se un file selezionato non è pubblicabile su una delle piattaforme scelte.
 */
import { useEffect, useRef, useState } from "react";
import { api, mediaWarnings, uploadMedia, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { MediaItem } from "@/types";

export function mediaUrl(m: MediaItem): string {
  const ext = m.filename.includes(".") ? m.filename.slice(m.filename.lastIndexOf(".")) : "";
  return `/api/media/${m.id}/file${ext}`;
}

export function MediaThumb({ item, className = "" }: { item: MediaItem; className?: string }) {
  if (item.mime.startsWith("video/")) {
    return <video src={mediaUrl(item)} className={`object-cover ${className}`} muted />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl(item)} alt={item.originalName} className={`object-cover ${className}`} />;
}

export function MediaPicker({
  selected,
  onChange,
  platforms = [],
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Piattaforme selezionate per il post: servono per gli avvisi di formato. */
  platforms?: PlatformInfo[];
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<MediaItem[]>([]);
  /** null = nessun upload in corso; altrimenti stato della barra. */
  const [progress, setProgress] = useState<{ name: string; percent: number; index: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api<{ items: MediaItem[] }>("/api/media").then((r) => setItems(r.items));
  useEffect(() => {
    load();
  }, []);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const upload = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setError("");
    const added: number[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setProgress({ name: file.name, percent: 0, index: i + 1, total: list.length });
        const item = await uploadMedia(file, {
          onProgress: (percent) => setProgress({ name: file.name, percent, index: i + 1, total: list.length }),
        });
        added.push(item.id);
      }
      onChange([...selected, ...added]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  const selectedItems = selected
    .map((id) => items.find((m) => m.id === id))
    .filter((m): m is MediaItem => !!m);
  const warnings = mediaWarnings(selectedItems, platforms, t);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        upload(e.dataTransfer.files);
      }}
      className={`rounded-lg transition ${
        dragOver ? "bg-brand-50 outline-dashed outline-2 outline-brand-500 dark:bg-brand-700/10" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("mediaPicker.selected", { count: selected.length })}</span>
        <span className="hidden flex-1 text-center text-xs text-gray-400 sm:block">
          {t("mediaPicker.dropHint")}
        </span>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={!!progress}
        >
          {progress ? t("mediaPicker.uploading") : t("mediaPicker.uploadFile")}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {progress && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span className="truncate">
              {progress.total > 1 ? `(${progress.index}/${progress.total}) ` : ""}
              {progress.name}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {progress.percent === 100 && (
            <p className="mt-1 text-xs text-gray-400">{t("mediaPicker.processing")}</p>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      {warnings.length > 0 && (
        <ul className="mb-2 space-y-0.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {warnings.map((w) => (
            <li key={w}>⚠️ {w}</li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{t("mediaPicker.empty")}</p>
      ) : (
        <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {items.map((m) => {
            const idx = selected.indexOf(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                  idx >= 0 ? "border-brand-500" : "border-transparent hover:border-gray-300"
                }`}
                title={m.originalName}
              >
                <MediaThumb item={m} className="h-full w-full" />
                {idx >= 0 && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                )}
                {m.mime.startsWith("video/") && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {t("mediaPicker.video")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
