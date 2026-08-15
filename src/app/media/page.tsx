"use client";
/**
 * Libreria media: upload (anche drag&drop), ricerca, tag, cartelle, anteprima.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmtDate, uploadMedia } from "@/lib/client";
import { useI18n, type TFunc } from "@/lib/i18n";
import type { MediaItem, MediaUsage } from "@/types";
import { MediaThumb, mediaUrl } from "@/components/MediaPicker";

interface Quota {
  used: number;
  limit: number;
  percent: number;
  files: number;
  warning: boolean;
  full: boolean;
  byFolder: { folder: string; bytes: number; files: number }[];
}

/** Byte → stringa leggibile (es. "1.4 GB"). */
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const dec = v >= 10 || i === 0 || Number.isInteger(v) ? 0 : 1;
  return `${v.toFixed(dec)} ${units[i]}`;
}

/** Dettaglio dello spazio occupato, con ripartizione per cartella. */
function StoragePanel({ quota }: { quota: Quota | null }) {
  const { t } = useI18n();
  if (!quota) return null;
  const pct = Math.min(100, quota.percent);
  const color = quota.full ? "bg-red-500" : quota.warning ? "bg-amber-500" : "bg-brand-600";
  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">💾 {t("storage.title")}</span>
        <span className={`text-sm ${quota.warning ? "font-semibold text-amber-600" : "text-gray-500"}`}>
          {t("storage.ofLimit", { used: fmtBytes(quota.used), limit: fmtBytes(quota.limit) })} · {pct}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {quota.full && <p className="mt-1 text-xs text-red-500">{t("storage.full")}</p>}
      {quota.byFolder.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="font-medium">{t("storage.byFolder")}:</span>
          {quota.byFolder.slice(0, 6).map((f) => (
            <span key={f.folder}>
              {f.folder} — {fmtBytes(f.bytes)} ({t("storage.files", { n: f.files })})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MediaPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  /** mediaId → post ancora in coda che lo useranno. */
  const [pending, setPending] = useState<Record<number, MediaUsage[]>>({});
  const [usage, setUsage] = useState<"all" | "pending" | "free">("all");
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ name: string; percent: number; index: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (folder) params.set("folder", folder);
    const r = await api<{ items: MediaItem[]; folders: string[]; pending: Record<number, MediaUsage[]> }>(
      `/api/media?${params}`
    );
    setItems(r.items);
    setFolders(r.folders);
    setPending(r.pending || {});
    // la quota si aggiorna insieme alla lista (dopo upload/eliminazioni)
    try {
      setQuota(await api<Quota>("/api/storage"));
    } catch {
      /* la barra è informativa: un errore qui non deve bloccare la libreria */
    }
  }, [q, folder]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce ricerca
    return () => clearTimeout(t);
  }, [load]);

  const upload = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setProgress({ name: file.name, percent: 0, index: i + 1, total: list.length });
        await uploadMedia(file, {
          folder,
          onProgress: (percent) => setProgress({ name: file.name, percent, index: i + 1, total: list.length }),
        });
      }
      await load();
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
    } finally {
      setProgress(null);
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
    if (!confirm(t("media.confirmDelete", { name: item.originalName }))) return;
    try {
      await api(`/api/media/${item.id}`, { method: "DELETE" });
    } catch (err) {
      // 409: il media è usato da post ancora in coda (bozze/programmati)
      const msg = String(err instanceof Error ? err.message : err);
      if (!confirm(t("media.confirmForceDelete", { msg }))) return;
      await api(`/api/media/${item.id}?force=true`, { method: "DELETE" });
    }
    setPreview(null);
    load();
  };

  const visible = items.filter((m) =>
    usage === "pending" ? !!pending[m.id] : usage === "free" ? !pending[m.id] : true
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("media.title")}</h1>
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? t("media.uploading") : t("media.upload")}
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

      <StoragePanel quota={quota} />

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder={t("media.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-auto" value={folder} onChange={(e) => setFolder(e.target.value)}>
          <option value="">{t("media.allFolders")}</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              📁 {f}
            </option>
          ))}
        </select>
        {/* Filtro per capire al volo cosa è ancora in coda e cosa si può cancellare */}
        <select
          className="input w-auto"
          value={usage}
          onChange={(e) => setUsage(e.target.value as typeof usage)}
        >
          <option value="all">{t("media.filterAll")}</option>
          <option value="pending">{t("media.filterPending")}</option>
          <option value="free">{t("media.filterFree")}</option>
        </select>
      </div>

      {/* Avanzamento upload */}
      {progress && (
        <div className="card">
          <div className="flex justify-between text-sm text-gray-500">
            <span className="truncate">
              {progress.total > 1 ? `(${progress.index}/${progress.total}) ` : ""}
              {progress.name}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
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
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">{t("media.empty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {visible.map((m) => (
              <button
                key={m.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
                onClick={() => setPreview(m)}
                title={m.originalName}
              >
                <MediaThumb item={m} className="h-full w-full transition group-hover:scale-105" />
                {pending[m.id] && (
                  <span
                    className="absolute right-1 top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    title={t("media.pendingTitle")}
                  >
                    {t("media.pendingBadge")} {pending[m.id].length}
                  </span>
                )}
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

            {/* Post in coda che useranno questo media: dice se è sicuro cancellarlo */}
            {pending[preview.id] ? (
              <div className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <p className="font-medium">
                  ⏳ {t("media.pendingIn", { n: pending[preview.id].length })}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {pending[preview.id].map((u) => (
                    <li key={u.postId}>
                      <a href={`/posts/${u.postId}`} className="underline">
                        {u.title || `Post #${u.postId}`}
                      </a>{" "}
                      —{" "}
                      {u.scheduledAt
                        ? t("media.scheduledFor", { date: fmtDate(u.scheduledAt) })
                        : t("media.notScheduled")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mb-3 text-xs text-green-600">✅ {t("media.freeToDelete")}</p>
            )}
            {preview.mime.startsWith("video/") && (
              <VideoConverter
                item={preview}
                t={t}
                onDone={(created) => {
                  load();
                  setPreview(created);
                }}
              />
            )}
            <MetaForm item={preview} onSave={saveMeta} t={t} />
            <button className="btn-danger mt-3 w-full" onClick={() => remove(preview)}>
              {t("media.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoConverter({
  item,
  t,
  onDone,
}: {
  item: MediaItem;
  t: TFunc;
  onDone: (created: MediaItem) => void;
}) {
  const [ratio, setRatio] = useState<"keep" | "9:16" | "1:1" | "4:5" | "16:9">("keep");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const convert = async () => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const body: Record<string, unknown> = { ratio, muted };
      if (start) body.start = Number(start);
      if (end) body.end = Number(end);
      const created = await api<MediaItem>(`/api/media/${item.id}/convert`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg(t("video.converted"));
      onDone(created);
    } catch (err) {
      setError(`${t("video.error")}: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-sm font-semibold">{t("video.convertTitle")}</p>
      <p className="mt-0.5 text-xs text-gray-500">{t("video.hint")}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="col-span-2 block text-xs text-gray-500">
          {t("video.format")}
          <select className="input mt-1" value={ratio} onChange={(e) => setRatio(e.target.value as typeof ratio)}>
            <option value="keep">{t("video.keep")}</option>
            <option value="9:16">{t("video.r916")}</option>
            <option value="1:1">{t("video.r11")}</option>
            <option value="4:5">{t("video.r45")}</option>
            <option value="16:9">{t("video.r169")}</option>
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          {t("video.trimStart")}
          <input type="number" min={0} step="0.1" className="input mt-1" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block text-xs text-gray-500">
          {t("video.trimEnd")}
          <input type="number" min={0} step="0.1" className="input mt-1" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" className="accent-brand-600" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
        {t("video.muted")}
      </label>
      <button className="btn-primary mt-2 w-full text-sm" onClick={convert} disabled={busy}>
        {busy ? t("video.converting") : t("video.convert")}
      </button>
      {msg && <p className="mt-1 text-xs text-green-600">{msg}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function MetaForm({
  item,
  onSave,
  t,
}: {
  item: MediaItem;
  onSave: (item: MediaItem, folder: string, tags: string) => void;
  t: TFunc;
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
        placeholder={t("media.folderPlaceholder")}
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      />
      <input
        className="input"
        placeholder={t("media.tagsPlaceholder")}
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <button className="btn-secondary w-full" onClick={() => onSave(item, folder, tags)}>
        {t("media.saveMeta")}
      </button>
    </div>
  );
}
