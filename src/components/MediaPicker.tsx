"use client";
/**
 * Media del post nell'editor.
 *
 * Nella scheda si vedono solo i media ALLEGATI, grandi e in ordine (per i
 * caroselli l'ordine conta), con anteprima, spostamento e rimozione. La
 * libreria si apre a parte, in una finestra con ricerca e filtro foto/video.
 *
 * Perché: prima allegati e libreria stavano nella stessa griglia alta 192 px,
 * con miniature minuscole e nessun modo di guardare un video prima di
 * pubblicarlo — si sceglieva un fermo immagine sperando fosse il file giusto.
 *
 * Upload rapido (pulsante o drag & drop, con barra di avanzamento) e avvisi
 * sui formati non pubblicabili restano qui.
 */
import { useEffect, useRef, useState } from "react";
import { api, mediaWarnings, uploadMedia, type PlatformInfo } from "@/lib/client";
import { useI18n, type TFunc } from "@/lib/i18n";
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

/** Media caricati per volta nella finestra della libreria. */
const LIBRARY_PAGE_SIZE = 40;
/** Attesa dopo l'ultimo tasto prima di cercare: niente richiesta per lettera. */
const SEARCH_DEBOUNCE_MS = 300;

type Kind = "all" | "image" | "video";

/** Chiude una finestra con Esc. */
function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, active]);
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
  /**
   * Tutti i media visti finora (pagine della libreria, allegati recuperati per
   * id, file appena caricati), indicizzati per id. Gli allegati si disegnano da
   * qui: la scheda non dipende dal fatto che la libreria sia stata aperta.
   */
  const [known, setKnown] = useState<Map<number, MediaItem>>(new Map());
  const remember = (list: MediaItem[]) => {
    if (list.length === 0) return;
    setKnown((prev) => {
      const next = new Map(prev);
      for (const m of list) next.set(m.id, m);
      return next;
    });
  };

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  /** null = nessun upload in corso; altrimenti stato della barra. */
  const [progress, setProgress] = useState<{ name: string; percent: number; index: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Recupera per id gli allegati che non si conoscono ancora — tipicamente un
  // post creato tempo fa (o dall'MCP). `requested` evita di richiedere
  // all'infinito gli id che non tornano più (media cancellato dopo l'allegato).
  const requested = useRef<Set<number>>(new Set());
  useEffect(() => {
    const missing = selected.filter((id) => !known.has(id) && !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    // Niente flag di annullamento: l'aggiornamento è additivo e deduplicato per
    // id, e in sviluppo React monta due volte — annullare la prima richiesta
    // avrebbe buttato via l'unica fatta, lasciando i media "non trovati".
    api<{ items: MediaItem[] }>(`/api/media?ids=${missing.join(",")}`)
      .then((r) => remember(r.items))
      .catch(() => {
        /* media cancellato o non accessibile: resta fuori dagli allegati */
      });
  }, [selected, known]);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= selected.length) return;
    const next = [...selected];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  const upload = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setError("");
    const added: MediaItem[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setProgress({ name: file.name, percent: 0, index: i + 1, total: list.length });
        const item = await uploadMedia(file, {
          onProgress: (percent) => setProgress({ name: file.name, percent, index: i + 1, total: list.length }),
        });
        added.push(item);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Anche se un file a metà lista fallisce, quelli già caricati si allegano.
      if (added.length) {
        remember(added);
        onChange([...selected, ...added.map((m) => m.id)]);
      }
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const selectedItems = selected.map((id) => known.get(id)).filter((m): m is MediaItem => !!m);
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("mediaPicker.selected", { count: selected.length })}</span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setLibraryOpen(true)}>
            {t("mediaPicker.openLibrary")}
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={!!progress}
          >
            {progress ? t("mediaPicker.uploading") : t("mediaPicker.uploadFile")}
          </button>
        </div>
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

      {selected.length === 0 ? (
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 py-8 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:border-gray-700"
        >
          <span className="text-2xl">🖼️</span>
          {t("mediaPicker.emptySelection")}
        </button>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {selected.map((id, index) => {
            const m = known.get(id);
            return (
              <li key={id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                {m ? (
                  <button
                    type="button"
                    onClick={() => setPreview(m)}
                    className="group relative block aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800"
                    title={t("mediaPicker.preview")}
                  >
                    <MediaThumb item={m} className="h-full w-full" />
                    <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    {m.mime.startsWith("video/") && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-lg text-white transition group-hover:scale-110">
                          ▶
                        </span>
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="aspect-square w-full animate-pulse bg-gray-100 dark:bg-gray-800" />
                )}
                <div className="flex items-center gap-1 p-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-500" title={m?.originalName}>
                    {m?.originalName ?? "…"}
                  </span>
                  <IconButton label={t("mediaPicker.moveLeft")} onClick={() => move(index, -1)} disabled={index === 0}>
                    ←
                  </IconButton>
                  <IconButton
                    label={t("mediaPicker.moveRight")}
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                  >
                    →
                  </IconButton>
                  <IconButton label={t("mediaPicker.remove")} onClick={() => toggle(id)} danger>
                    ✕
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-2 hidden text-center text-xs text-gray-400 sm:block">{t("mediaPicker.dropHint")}</p>

      {libraryOpen && (
        <LibraryDialog
          selected={selected}
          onToggle={toggle}
          onPreview={setPreview}
          onLoaded={remember}
          onClose={() => setLibraryOpen(false)}
          // Con l'anteprima aperta sopra, Esc chiude solo quella.
          escapeActive={!preview}
          t={t}
        />
      )}

      {preview && (
        <PreviewDialog
          item={preview}
          isSelected={selected.includes(preview.id)}
          onToggle={() => toggle(preview.id)}
          onClose={() => setPreview(null)}
          t={t}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm disabled:opacity-30 ${
        danger
          ? "text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

/** Finestra della libreria: ricerca, filtro per tipo, selezione e anteprima. */
function LibraryDialog({
  selected,
  onToggle,
  onPreview,
  onLoaded,
  onClose,
  escapeActive,
  t,
}: {
  selected: number[];
  onToggle: (id: number) => void;
  onPreview: (m: MediaItem) => void;
  onLoaded: (items: MediaItem[]) => void;
  onClose: () => void;
  escapeActive: boolean;
  t: TFunc;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [loading, setLoading] = useState(true);
  /**
   * Numero dell'ultima richiesta: una ricerca lenta che arriva dopo una più
   * recente non deve sovrascriverne i risultati.
   */
  const latest = useRef(0);
  useEscape(onClose, escapeActive);

  const load = async (offset: number) => {
    const call = ++latest.current;
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIBRARY_PAGE_SIZE), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    if (kind !== "all") params.set("kind", kind);
    try {
      const r = await api<{ items: MediaItem[]; total: number }>(`/api/media?${params}`);
      if (call !== latest.current) return;
      setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
      setTotal(r.total);
      onLoaded(r.items);
    } finally {
      if (call === latest.current) setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => load(0), q ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("mediaPicker.libraryTitle")}
        className="card flex h-full max-h-[90vh] w-full max-w-5xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t("mediaPicker.libraryTitle")}</h3>
          <button type="button" className="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label={t("mediaPicker.close")}>
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className="input min-w-0 flex-1"
            placeholder={t("mediaPicker.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-sm dark:border-gray-700">
            {(["all", "image", "video"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 ${
                  kind === k ? "bg-brand-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {t(`mediaPicker.kind.${k}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {loading ? t("mediaPicker.loading") : q || kind !== "all" ? t("mediaPicker.noResults") : t("mediaPicker.empty")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((m) => {
                const idx = selected.indexOf(m.id);
                return (
                  <div
                    key={m.id}
                    className={`group relative overflow-hidden rounded-lg border-2 transition ${
                      idx >= 0 ? "border-brand-500" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggle(m.id)}
                      className="block aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800"
                      title={idx >= 0 ? t("mediaPicker.removeFromPost") : t("mediaPicker.addToPost")}
                    >
                      <MediaThumb item={m} className="h-full w-full" />
                    </button>
                    {idx >= 0 && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onPreview(m)}
                      className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                      title={t("mediaPicker.preview")}
                    >
                      {m.mime.startsWith("video/") ? "▶" : "🔍"}
                    </button>
                    <p className="truncate px-1.5 py-1 text-xs text-gray-500" title={m.originalName}>
                      {m.originalName}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {items.length < total && (
            <button
              type="button"
              className="btn-secondary mt-3 w-full py-1.5 text-xs"
              onClick={() => load(items.length)}
              disabled={loading}
            >
              {t("mediaPicker.loadMore", { shown: items.length, total })}
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <span className="text-sm text-gray-500">{t("mediaPicker.selected", { count: selected.length })}</span>
          <button type="button" className="btn-primary" onClick={onClose}>
            {t("mediaPicker.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Anteprima a grandezza piena: il video si guarda davvero prima di pubblicarlo. */
function PreviewDialog({
  item,
  isSelected,
  onToggle,
  onClose,
  t,
}: {
  item: MediaItem;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
  t: TFunc;
}) {
  useEscape(onClose, true);
  const isVideo = item.mime.startsWith("video/");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.originalName}
        className="card flex max-h-full w-full max-w-3xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-semibold" title={item.originalName}>
            {item.originalName}
          </h3>
          <button type="button" className="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label={t("mediaPicker.close")}>
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
          {isVideo ? (
            // Parte da sola: l'anteprima si apre con un clic, quindi il browser
            // ammette l'audio. `key` riavvia il player se si passa a un altro file.
            <video
              key={item.id}
              src={mediaUrl(item)}
              poster={posterUrl(item)}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(item)} alt={item.originalName} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            {item.mime} · {(item.size / 1024 / 1024).toFixed(2)} MB
          </span>
          <button type="button" className={isSelected ? "btn-secondary" : "btn-primary"} onClick={onToggle}>
            {isSelected ? t("mediaPicker.removeFromPost") : t("mediaPicker.addToPost")}
          </button>
        </div>
      </div>
    </div>
  );
}
