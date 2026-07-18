"use client";
/**
 * Libreria media: upload (anche drag&drop), ricerca, tag, cartelle, anteprima.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { MediaItem } from "@/types";
import { MediaThumb, mediaUrl } from "@/components/MediaPicker";

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (folder) params.set("folder", folder);
    const r = await api<{ items: MediaItem[]; folders: string[] }>(`/api/media?${params}`);
    setItems(r.items);
    setFolders(r.folders);
  }, [q, folder]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce ricerca
    return () => clearTimeout(t);
  }, [load]);

  const upload = async (files: FileList | File[] | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        if (folder) form.append("folder", folder);
        await api("/api/media", { method: "POST", body: form });
      }
      await load();
    } catch (err) {
      alert(String(err));
    } finally {
      setUploading(false);
    }
  };

  const saveMeta = async (item: MediaItem, newFolder: string, newTags: string) => {
    const updated = await api<MediaItem>(`/api/media/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ folder: newFolder, tags: newTags }),
    });
    setPreview(updated);
    load();
  };

  const remove = async (item: MediaItem) => {
    if (!confirm(`Eliminare "${item.originalName}"?`)) return;
    try {
      await api(`/api/media/${item.id}`, { method: "DELETE" });
    } catch (err) {
      // 409: il media è usato da post ancora in coda (bozze/programmati)
      const msg = String(err instanceof Error ? err.message : err);
      if (!confirm(`${msg}\n\nEliminare comunque il media?`)) return;
      await api(`/api/media/${item.id}?force=true`, { method: "DELETE" });
    }
    setPreview(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Libreria Media</h1>
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Caricamento…" : "⬆️ Carica"}
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

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="🔍 Cerca per nome o tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-auto" value={folder} onChange={(e) => setFolder(e.target.value)}>
          <option value="">Tutte le cartelle</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              📁 {f}
            </option>
          ))}
        </select>
      </div>

      {/* Zona drag & drop + griglia */}
      <div
        className={`min-h-64 rounded-xl border-2 border-dashed p-4 transition ${
          dragOver ? "border-brand-500 bg-brand-50 dark:bg-brand-700/10" : "border-gray-200 dark:border-gray-800"
        }`}
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
      >
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            Nessun media. Trascina qui immagini o video, oppure usa &quot;Carica&quot;.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {items.map((m) => (
              <button
                key={m.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
                onClick={() => setPreview(m)}
                title={m.originalName}
              >
                <MediaThumb item={m} className="h-full w-full transition group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-left text-[10px] text-white">
                  {m.originalName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal anteprima/dettaglio */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="card max-h-full w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-semibold">{preview.originalName}</h3>
              <button className="text-gray-400 hover:text-gray-700" onClick={() => setPreview(null)}>
                ✕
              </button>
            </div>
            {preview.mime.startsWith("video/") ? (
              <video src={mediaUrl(preview)} controls className="mb-3 max-h-80 w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(preview)} alt="" className="mb-3 max-h-80 w-full rounded-lg object-contain" />
            )}
            <p className="mb-3 text-xs text-gray-500">
              {preview.mime} · {(preview.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <MetaForm item={preview} onSave={saveMeta} />
            <button className="btn-danger mt-3 w-full" onClick={() => remove(preview)}>
              🗑 Elimina
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaForm({
  item,
  onSave,
}: {
  item: MediaItem;
  onSave: (item: MediaItem, folder: string, tags: string) => void;
}) {
  const [folder, setFolder] = useState(item.folder);
  const [tags, setTags] = useState(item.tags);
  useEffect(() => {
    setFolder(item.folder);
    setTags(item.tags);
  }, [item]);
  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="📁 Cartella (es. prodotti, dietro-le-quinte)"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      />
      <input
        className="input"
        placeholder="🏷️ Tag separati da virgola"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <button className="btn-secondary w-full" onClick={() => onSave(item, folder, tags)}>
        💾 Salva metadati
      </button>
    </div>
  );
}
