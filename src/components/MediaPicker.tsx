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

/**
 * URL del file. Punta a /files/:nome (non a /api/media/:id/:nome) perché quel
 * percorso corrisponde a un file reale su disco: in produzione lo serve Caddy
 * direttamente, senza svegliare Node.
 */
export function mediaUrl(m: MediaItem): string {
  return `/files/${encodeURIComponent(m.filename)}`;
}

/**
 * Fotogramma di anteprima di un video: il server lo genera al primo accesso e
 * poi lo riusa. Prima la griglia montava un <video> per elemento, cioè
 * scaricava ogni video INTERO solo per mostrarne un fermo immagine.
 */
export function posterUrl(m: MediaItem): string {
  return `/files/${encodeURIComponent(m.filename)}.poster.jpg`;
}

/** Quanto si aspetta prima di richiedere un poster che il server sta generando. */
const POSTER_RETRY_MS = 3000;

export function MediaThumb({ item, className = "" }: { item: MediaItem; className?: string }) {
  const isVideo = item.mime.startsWith("video/");
  /**
   * 0 = primo tentativo, 1 = ritentativo, 2 = rinuncia.
   *
   * Il ritentativo serve perché il poster di un video mai visto prima viene
   * creato DURANTE la prima richiesta: quella risponde 404 e senza un secondo
   * tentativo il riquadro restava 🎬 fino a un ricaricamento a mano — cioè
   * proprio al primo sguardo alla Libreria, quando l'impressione conta.
   */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt !== 1) return;
    const id = setTimeout(() => setAttempt(2), POSTER_RETRY_MS);
    return () => clearTimeout(id);
  }, [attempt]);

  // Poster non producibile (ffmpeg assente, video illeggibile): riquadro
  // neutro, non un download da 100 MB per mostrare un fermo immagine.
  if (isVideo && attempt > 2) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-2xl dark:bg-gray-800 ${className}`}>
        🎬
      </div>
    );
  }
  // In attesa del ritentativo: riquadro vuoto, senza <img> che riproverebbe subito.
  if (isVideo && attempt === 1) {
    return <div className={`bg-gray-100 dark:bg-gray-800 ${className}`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // La query rompe la cache del 404 precedente, che altrimenti il browser
      // riuserebbe rendendo inutile il ritentativo.
      src={isVideo ? `${posterUrl(item)}${attempt ? `?r=${attempt}` : ""}` : mediaUrl(item)}
      alt={item.originalName}
      loading="lazy"
      decoding="async"
      onError={isVideo ? () => setAttempt((a) => a + 1) : undefined}
      className={`object-cover ${className}`}
    />
  );
}

/** Media caricati per volta nel selettore (la griglia è alta poche righe). */
const PICKER_PAGE_SIZE = 40;

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
  /** Totale in libreria: gli `items` sono solo le pagine già caricate. */
  const [total, setTotal] = useState(0);
  /**
   * Media selezionati che non stanno nelle pagine caricate — tipicamente gli
   * allegati di un post creato tempo fa (o dall'MCP) mentre la libreria è
   * cresciuta. Senza questo recupero mirato l'editor li dava per non esistenti:
   * niente miniature e, peggio, l'avviso "Instagram richiede almeno un media"
   * su un post che i media ce li aveva eccome.
   */
  const [resolved, setResolved] = useState<MediaItem[]>([]);
  /** null = nessun upload in corso; altrimenti stato della barra. */
  const [progress, setProgress] = useState<{ name: string; percent: number; index: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (offset = 0) => {
    const r = await api<{ items: MediaItem[]; total: number }>(
      `/api/media?limit=${PICKER_PAGE_SIZE}&offset=${offset}`
    );
    setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
    setTotal(r.total);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recupera per id i selezionati che non sono nelle pagine già caricate.
  // `requested` evita di richiedere all'infinito gli id che non tornano più
  // (media cancellato dalla libreria dopo essere stato allegato).
  const requested = useRef<Set<number>>(new Set());
  useEffect(() => {
    const known = new Set([...items, ...resolved].map((m) => m.id));
    const missing = selected.filter((id) => !known.has(id) && !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    // Niente flag di annullamento: l'aggiornamento è additivo e deduplicato per
    // id, e in sviluppo React monta due volte — annullare la prima richiesta
    // avrebbe buttato via l'unica fatta, lasciando i media "non trovati".
    api<{ items: MediaItem[] }>(`/api/media?ids=${missing.join(",")}`)
      .then((r) => {
        if (r.items.length === 0) return;
        setResolved((prev) => [...prev, ...r.items.filter((m) => !prev.some((x) => x.id === m.id))]);
      })
      .catch(() => {
        /* media cancellato o non accessibile: resta semplicemente fuori dalla griglia */
      });
  }, [selected, items, resolved]);

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
      await load(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  const byId = new Map([...items, ...resolved].map((m) => [m.id, m] as const));
  const selectedItems = selected
    .map((id) => byId.get(id))
    .filter((m): m is MediaItem => !!m);
  const warnings = mediaWarnings(selectedItems, platforms, t);

  /**
   * Griglia: prima i selezionati fuori pagina (altrimenti sarebbero invisibili
   * e impossibili da togliere), poi la libreria nell'ordine consueto.
   */
  const inPage = new Set(items.map((m) => m.id));
  const grid = [...selectedItems.filter((m) => !inPage.has(m.id)), ...items];

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

      {grid.length === 0 ? (
        <p className="text-sm text-gray-500">{t("mediaPicker.empty")}</p>
      ) : (
        <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {grid.map((m) => {
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

      {items.length < total && (
        <button
          type="button"
          className="btn-secondary mt-2 w-full py-1 text-xs"
          onClick={() => load(items.length)}
        >
          {t("mediaPicker.loadMore", { shown: items.length, total })}
        </button>
      )}
    </div>
  );
}
