"use client";
/**
 * Selettore media per l'editor: mostra la libreria, permette upload rapido
 * e selezione multipla (per i caroselli l'ordine di selezione conta).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
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
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api<{ items: MediaItem[] }>("/api/media").then((r) => setItems(r.items));
  useEffect(() => {
    load();
  }, []);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const item = await api<MediaItem>("/api/media", { method: "POST", body: form });
        onChange([...selected, item.id]);
      }
      await load();
    } catch (err) {
      alert(String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Media ({selected.length} selezionati)</span>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Caricamento…" : "⬆️ Carica file"}
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
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun media in libreria: caricane uno.</p>
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
                    ▶ video
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
