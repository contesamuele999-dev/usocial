"use client";
/**
 * Gestione template (prototipo): modelli riutilizzabili per post e caroselli.
 * - Template "post": struttura del testo con segnaposto {…}, hashtag, piattaforme.
 * - Template "carosello": brand kit (colori/font) + slide, con anteprima visiva.
 * "Usa nel post" precompila l'editor via sessionStorage.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { downloadBlob, renderSlidesToBlobs, type Ratio } from "@/lib/carousel";
import type {
  CarouselTemplateData,
  Platform,
  PostTemplateData,
  Template,
  TemplateKind,
} from "@/types";

const FONTS = [
  "Inter, system-ui, sans-serif",
  "Georgia, serif",
  "'Courier New', monospace",
  "'Trebuchet MS', sans-serif",
  "Impact, sans-serif",
];

const DEFAULT_POST: PostTemplateData = {
  body: "Hook: {hook}\n\n{corpo}\n\nCTA: {cta}",
  hashtags: "",
  platforms: [],
};

const DEFAULT_CAROUSEL: CarouselTemplateData = {
  brand: { bg: "#0f172a", text: "#ffffff", accent: "#6366f1", font: FONTS[0] },
  slides: [
    { headline: "Titolo di apertura (hook)", body: "Una frase che ferma lo scroll." },
    { headline: "Punto 1", body: "Il valore che offri." },
    { headline: "CTA", body: "Segui / Acquista ora." },
  ],
  hashtags: "",
};

type Editing =
  | { id?: number; kind: "post"; name: string; data: PostTemplateData }
  | { id?: number; kind: "carousel"; name: string; data: CarouselTemplateData };

export default function TemplatesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [list, setList] = useState<Template[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Template[]>("/api/templates").then(setList).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api<PlatformInfo[]>("/api/platforms").then(setPlatforms).catch(() => {});
  }, [load]);

  const startNew = (kind: TemplateKind) => {
    setSaved(false);
    setError("");
    setEditing(
      kind === "post"
        ? { kind: "post", name: "", data: structuredClone(DEFAULT_POST) }
        : { kind: "carousel", name: "", data: structuredClone(DEFAULT_CAROUSEL) }
    );
  };

  const editExisting = (tpl: Template) => {
    setSaved(false);
    setError("");
    setEditing({ id: tpl.id, kind: tpl.kind, name: tpl.name, data: tpl.data as never });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError(t("templates.needName"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editing.id) {
        await api(`/api/templates/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: editing.name, data: editing.data }),
        });
      } else {
        const created = await api<Template>("/api/templates", {
          method: "POST",
          body: JSON.stringify({ name: editing.name, kind: editing.kind, data: editing.data }),
        });
        setEditing({ ...editing, id: created.id } as Editing);
      }
      setSaved(true);
      load();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tpl: Template) => {
    if (!confirm(t("templates.confirmDelete", { name: tpl.name }))) return;
    await api(`/api/templates/${tpl.id}`, { method: "DELETE" });
    if (editing?.id === tpl.id) setEditing(null);
    load();
  };

  const use = (tpl: Template) => {
    let prefill: { body: string; hashtags: string; platforms: Platform[] };
    if (tpl.kind === "post") {
      const d = tpl.data as PostTemplateData;
      prefill = { body: d.body, hashtags: d.hashtags, platforms: d.platforms };
    } else {
      const d = tpl.data as CarouselTemplateData;
      const body = d.slides
        .map((s, i) => `【${i + 1}】 ${s.headline}\n${s.body}`)
        .join("\n\n");
      prefill = { body, hashtags: d.hashtags, platforms: [] };
    }
    try {
      sessionStorage.setItem("editor.prefill", JSON.stringify(prefill));
    } catch {}
    router.push("/posts/new");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("templates.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("templates.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => startNew("post")}>
            {t("templates.newPost")}
          </button>
          <button className="btn-primary text-sm" onClick={() => startNew("carousel")}>
            {t("templates.newCarousel")}
          </button>
          <Link href="/studio" className="btn-secondary text-sm">
            ← {t("nav.studio")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Elenco template */}
        <div className="space-y-2 lg:col-span-1">
          {list.length === 0 && <p className="text-sm text-gray-500">{t("templates.empty")}</p>}
          {list.map((tpl) => (
            <div key={tpl.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{tpl.name}</p>
                  <span className="badge bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {tpl.kind === "post" ? t("templates.kindPost") : t("templates.kindCarousel")}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button className="btn-primary px-2 py-1 text-xs" onClick={() => use(tpl)}>
                  {t("templates.use")}
                </button>
                <button className="btn-secondary px-2 py-1 text-xs" onClick={() => editExisting(tpl)}>
                  {t("templates.edit")}
                </button>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(tpl)}>
                  {t("templates.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {editing ? (
            <div className="card space-y-3">
              <input
                className="input font-semibold"
                placeholder={t("templates.namePlaceholder")}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value } as Editing)}
              />

              {editing.kind === "post" ? (
                <PostTemplateEditor
                  data={editing.data}
                  platforms={platforms}
                  onChange={(data) => setEditing({ ...editing, data } as Editing)}
                />
              ) : (
                <CarouselTemplateEditor
                  data={editing.data}
                  name={editing.name}
                  onChange={(data) => setEditing({ ...editing, data } as Editing)}
                />
              )}

              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={save} disabled={busy}>
                  {busy ? t("templates.saving") : t("templates.save")}
                </button>
                {saved && <span className="text-sm text-green-600">{t("templates.saved")}</span>}
                {error && <span className="text-sm text-red-500">{error}</span>}
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-gray-500">{t("templates.empty")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- editor template POST ---------------- */

function PostTemplateEditor({
  data,
  platforms,
  onChange,
}: {
  data: PostTemplateData;
  platforms: PlatformInfo[];
  onChange: (d: PostTemplateData) => void;
}) {
  const { t } = useI18n();
  const toggle = (p: Platform) =>
    onChange({
      ...data,
      platforms: data.platforms.includes(p)
        ? data.platforms.filter((x) => x !== p)
        : [...data.platforms, p],
    });
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        {t("templates.body")}
        <textarea
          className="input mt-1 min-h-40 resize-y font-mono text-sm"
          placeholder={t("templates.bodyPlaceholder")}
          value={data.body}
          onChange={(e) => onChange({ ...data, body: e.target.value })}
        />
      </label>
      <p className="text-xs text-gray-500">{t("templates.bodyHint")}</p>
      <label className="block text-sm font-medium">
        {t("templates.hashtags")}
        <input
          className="input mt-1"
          placeholder="#brand #prodotto"
          value={data.hashtags}
          onChange={(e) => onChange({ ...data, hashtags: e.target.value })}
        />
      </label>
      <div>
        <span className="text-sm font-medium">{t("templates.platforms")}</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {platforms.map((p) => (
            <label
              key={p.platform}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                data.platforms.includes(p.platform)
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-700/10"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={data.platforms.includes(p.platform)}
                onChange={() => toggle(p.platform)}
              />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              {p.displayName}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- editor template CAROSELLO ---------------- */

function CarouselTemplateEditor({
  data,
  name,
  onChange,
}: {
  data: CarouselTemplateData;
  name: string;
  onChange: (d: CarouselTemplateData) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [exporting, setExporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const slug = (name.trim() || "carosello").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const download = async () => {
    setExporting(true);
    setExportMsg("");
    try {
      const blobs = await renderSlidesToBlobs(data.slides, data.brand, ratio);
      blobs.forEach((b, i) => downloadBlob(b, `${slug}-${i + 1}.png`));
    } finally {
      setExporting(false);
    }
  };

  const saveToLibrary = async () => {
    setExporting(true);
    setExportMsg("");
    try {
      const blobs = await renderSlidesToBlobs(data.slides, data.brand, ratio);
      for (let i = 0; i < blobs.length; i++) {
        const file = new File([blobs[i]], `${slug}-${i + 1}.png`, { type: "image/png" });
        const form = new FormData();
        form.append("file", file);
        form.append("folder", "caroselli");
        form.append("tags", "carosello");
        await api("/api/media", { method: "POST", body: form });
      }
      setExportMsg(t("templates.exportedSaved", { n: blobs.length }));
    } catch (err) {
      setExportMsg(String(err instanceof Error ? err.message : err));
    } finally {
      setExporting(false);
    }
  };

  // Renderizza le slide, le salva come media e crea una bozza di post con le immagini allegate.
  const createPostWithImages = async () => {
    setCreating(true);
    setExportMsg("");
    try {
      const blobs = await renderSlidesToBlobs(data.slides, data.brand, ratio);
      const mediaIds: number[] = [];
      for (let i = 0; i < blobs.length; i++) {
        const file = new File([blobs[i]], `${slug}-${i + 1}.png`, { type: "image/png" });
        const form = new FormData();
        form.append("file", file);
        form.append("folder", "caroselli");
        form.append("tags", "carosello");
        const m = await api<{ id: number }>("/api/media", { method: "POST", body: form });
        mediaIds.push(m.id);
      }
      const post = await api<{ id: number }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ status: "draft", hashtags: data.hashtags, mediaIds }),
      });
      router.push(`/posts/${post.id}`);
    } catch (err) {
      setExportMsg(String(err instanceof Error ? err.message : err));
    } finally {
      setCreating(false);
    }
  };

  const setBrand = (patch: Partial<CarouselTemplateData["brand"]>) =>
    onChange({ ...data, brand: { ...data.brand, ...patch } });
  const setSlide = (i: number, patch: Partial<{ headline: string; body: string }>) =>
    onChange({ ...data, slides: data.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSlide = () =>
    onChange({ ...data, slides: [...data.slides, { headline: "", body: "" }] });
  const removeSlide = (i: number) =>
    onChange({ ...data, slides: data.slides.filter((_, j) => j !== i) });

  return (
    <div className="space-y-4">
      {/* Brand kit */}
      <div>
        <span className="text-sm font-medium">{t("templates.brand")}</span>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ColorField label={t("templates.bg")} value={data.brand.bg} onChange={(v) => setBrand({ bg: v })} />
          <ColorField label={t("templates.textColor")} value={data.brand.text} onChange={(v) => setBrand({ text: v })} />
          <ColorField label={t("templates.accent")} value={data.brand.accent} onChange={(v) => setBrand({ accent: v })} />
          <label className="block text-xs text-gray-500">
            {t("templates.font")}
            <select
              className="input mt-1"
              value={data.brand.font}
              onChange={(e) => setBrand({ font: e.target.value })}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f.split(",")[0].replace(/'/g, "")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Slide + anteprima affiancate */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("templates.slides")}</span>
          {data.slides.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">{t("templates.slideOf", { n: i + 1 })}</span>
                {data.slides.length > 1 && (
                  <button className="text-xs text-red-500 hover:underline" onClick={() => removeSlide(i)}>
                    {t("templates.removeSlide")}
                  </button>
                )}
              </div>
              <input
                className="input mb-1 text-sm"
                placeholder={t("templates.slideHeadline")}
                value={s.headline}
                onChange={(e) => setSlide(i, { headline: e.target.value })}
              />
              <textarea
                className="input min-h-16 resize-y text-sm"
                placeholder={t("templates.slideBody")}
                value={s.body}
                onChange={(e) => setSlide(i, { body: e.target.value })}
              />
            </div>
          ))}
          <button className="btn-secondary w-full text-xs" onClick={addSlide}>
            {t("templates.addSlide")}
          </button>
          <label className="block text-sm font-medium">
            {t("templates.hashtags")}
            <input
              className="input mt-1"
              placeholder="#brand #prodotto"
              value={data.hashtags}
              onChange={(e) => onChange({ ...data, hashtags: e.target.value })}
            />
          </label>
        </div>

        {/* Anteprima visiva + export */}
        <div>
          <span className="text-sm font-medium">{t("templates.preview")}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              className="input w-auto text-sm"
              value={ratio}
              onChange={(e) => setRatio(e.target.value as Ratio)}
            >
              <option value="4:5">{t("templates.ratio45")}</option>
              <option value="1:1">{t("templates.ratio11")}</option>
              <option value="9:16">{t("templates.ratio916")}</option>
            </select>
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={download} disabled={exporting}>
              {exporting ? t("templates.exporting") : t("templates.exportDownload")}
            </button>
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={saveToLibrary} disabled={exporting}>
              {t("templates.exportSave")}
            </button>
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={createPostWithImages} disabled={exporting || creating}>
              {creating ? t("templates.creating") : t("templates.createPost")}
            </button>
          </div>
          {exportMsg && <p className="mt-1 text-xs text-green-600">{exportMsg}</p>}
          <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
            {data.slides.map((s, i) => (
              <div
                key={i}
                className="relative flex shrink-0 flex-col justify-center rounded-xl p-4 shadow"
                style={{
                  width: 160,
                  aspectRatio: "4 / 5",
                  background: data.brand.bg,
                  color: data.brand.text,
                  fontFamily: data.brand.font,
                }}
              >
                <span
                  className="absolute right-2 top-2 text-xs font-bold"
                  style={{ color: data.brand.accent }}
                >
                  {i + 1}/{data.slides.length}
                </span>
                <div className="h-1 w-8 rounded" style={{ background: data.brand.accent }} />
                <p className="mt-2 text-sm font-bold leading-tight">{s.headline}</p>
                <p className="mt-1 text-[11px] leading-snug opacity-90">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-gray-500">
      {label}
      <span className="mt-1 flex items-center gap-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
        />
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}
