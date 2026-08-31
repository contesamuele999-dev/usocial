"use client";
/**
 * Editor del post: contenuto, piattaforme, media, programmazione, AI.
 * Usato sia per creare (postId=null) sia per modificare un post.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, getPlatforms, fmtDate, retryInfo, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { Platform, Post, TargetOptions } from "@/types";
import { EmojiPicker } from "./EmojiPicker";
import { MediaPicker } from "./MediaPicker";
import { AiPanel } from "./AiPanel";
import { TikTokOptions } from "./TikTokOptions";
import { StatusBadge } from "./PostCard";

/** Converte ISO ↔ valore per <input type="datetime-local"> (ora locale). */
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

export function PostEditor({ initial }: { initial: Post | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [hashtags, setHashtags] = useState(initial?.hashtags || "");
  const [selected, setSelected] = useState<Platform[]>(initial?.targets.map((t) => t.platform) || []);
  const [mediaIds, setMediaIds] = useState<number[]>(initial?.media.map((m) => m.id) || []);
  // tipo di pubblicazione scelto per piattaforma (reel, storia, carosello, …)
  const [postTypes, setPostTypes] = useState<Partial<Record<Platform, string>>>(
    Object.fromEntries(
      (initial?.targets || []).filter((t) => t.postType).map((t) => [t.platform, t.postType!])
    )
  );
  // opzioni del pannello di piattaforma (TikTok: privacy, commenti, duetto…)
  const [targetOptions, setTargetOptions] = useState<Partial<Record<Platform, TargetOptions>>>(
    Object.fromEntries(
      (initial?.targets || []).filter((t) => t.options).map((t) => [t.platform, t.options!])
    )
  );
  const [scheduled, setScheduled] = useState(isoToLocal(initial?.scheduledAt || null));
  // id=0 = precompilazione (es. data dal calendario), non un post salvato
  const [post, setPost] = useState<Post | null>(initial && initial.id > 0 ? initial : null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getPlatforms().then(setPlatforms).catch(() => {});
  }, []);

  const togglePlatform = (p: Platform) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const insertEmoji = (emoji: string) => {
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + emoji);
    const start = el.selectionStart ?? body.length;
    setBody(body.slice(0, start) + emoji + body.slice(el.selectionEnd ?? start));
  };

  const payload = (status: "draft" | "scheduled") => ({
    title,
    body,
    hashtags,
    scheduledAt: localToIso(scheduled),
    status,
    platforms: selected,
    mediaIds,
    postTypes,
    targetOptions,
  });

  /** Salva (crea o aggiorna) e ritorna il post. */
  const save = async (status: "draft" | "scheduled"): Promise<Post> => {
    if (post) {
      return api<Post>(`/api/posts/${post.id}`, { method: "PUT", body: JSON.stringify(payload(status)) });
    }
    return api<Post>("/api/posts", { method: "POST", body: JSON.stringify(payload(status)) });
  };

  /**
   * Il Direct Post TikTok richiede che la privacy la scelga l'utente: senza,
   * la pubblicazione fallirebbe a metà coda invece che qui.
   */
  const tiktokNeedsPrivacy = () =>
    selected.includes("tiktok") &&
    (postTypes.tiktok || "video") !== "draft" &&
    !targetOptions.tiktok?.privacyLevel;

  const doSave = async (status: "draft" | "scheduled") => {
    if (status === "scheduled" && !scheduled) {
      setMessage({ ok: false, text: t("editor.setDateTime") });
      return;
    }
    if (status === "scheduled" && tiktokNeedsPrivacy()) {
      setMessage({ ok: false, text: t("editor.tiktokPickPrivacy") });
      return;
    }
    setBusy(status);
    setMessage(null);
    try {
      const saved = await save(status);
      setPost(saved);
      setMessage({
        ok: true,
        text:
          status === "draft"
            ? t("editor.draftSaved")
            : t("editor.scheduledFor", { date: fmtDate(saved.scheduledAt) }),
      });
      if (!post) router.replace(`/posts/${saved.id}`);
    } catch (err) {
      setMessage({ ok: false, text: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy("");
    }
  };

  const doPublish = async () => {
    if (selected.length === 0) {
      setMessage({ ok: false, text: t("editor.selectPlatform") });
      return;
    }
    if (tiktokNeedsPrivacy()) {
      setMessage({ ok: false, text: t("editor.tiktokPickPrivacy") });
      return;
    }
    if (!confirm(t("editor.confirmPublish", { platforms: selected.join(", ") }))) return;
    setBusy("publish");
    setMessage(null);
    try {
      const saved = await save("draft");
      setPost(saved);
      const published = await api<Post>(`/api/posts/${saved.id}/publish`, { method: "POST" });
      setPost(published);
      const ok = published.status === "published";
      const failures = published.targets.filter((t) => t.error).map((t) => `${t.platform}: ${t.error}`);
      setMessage({
        ok,
        text: ok
          ? t("editor.publishedAll")
          : t("editor.partialOutcome", { failures: failures.join(" · ") }),
      });
      if (!window.location.pathname.includes(`/posts/${saved.id}`)) {
        router.replace(`/posts/${saved.id}`);
      }
    } catch (err) {
      setMessage({ ok: false, text: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy("");
    }
  };

  const doAdapt = async () => {
    if (!post) {
      setMessage({ ok: false, text: t("editor.saveFirst") });
      return;
    }
    setBusy("adapt");
    setMessage(null);
    try {
      await save(post.status === "scheduled" ? "scheduled" : "draft");
      const updated = await api<Post>(`/api/posts/${post.id}/adapt`, { method: "POST" });
      setPost(updated);
      setMessage({ ok: true, text: t("editor.adaptedDone") });
    } catch (err) {
      setMessage({ ok: false, text: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy("");
    }
  };

  const bodyLen = body.length + (hashtags ? hashtags.length + 2 : 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Colonna principale: contenuto */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card space-y-3">
          <input
            className="input text-lg font-semibold"
            placeholder={t("editor.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            ref={bodyRef}
            className="input min-h-48 resize-y font-normal"
            placeholder={t("editor.bodyPlaceholder")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <EmojiPicker onPick={insertEmoji} />
            <input
              className="input flex-1"
              placeholder={t("editor.hashtagsPlaceholder")}
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
            <span className="text-xs text-gray-500">{t("editor.chars", { n: bodyLen })}</span>
          </div>
        </div>

        <AiPanel
          text={body}
          title={title}
          onApplyBody={setBody}
          onApplyHashtags={setHashtags}
        />

        <div className="card">
          <MediaPicker
            selected={mediaIds}
            onChange={setMediaIds}
            platforms={platforms.filter((p) => selected.includes(p.platform))}
          />
        </div>

        {/* Anteprime adattate per piattaforma */}
        {post && post.targets.some((t) => t.adaptedBody) && (
          <div className="card">
            <h3 className="mb-2 font-semibold">{t("editor.adaptedVersions")}</h3>
            <div className="space-y-3">
              {post.targets
                .filter((t) => t.adaptedBody)
                .map((t) => {
                  const info = platforms.find((p) => p.platform === t.platform);
                  return (
                    <div key={t.platform} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info?.color }} />
                        {info?.displayName || t.platform}
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-600 dark:text-gray-300">
                        {t.adaptedBody}
                      </pre>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Colonna laterale: piattaforme + programmazione + azioni */}
      <div className="space-y-4">
        <div className="card">
          <h3 className="mb-2 font-semibold">{t("editor.platforms")}</h3>
          <div className="space-y-2">
            {platforms.map((p) => {
              const target = post?.targets.find((t) => t.platform === p.platform);
              const isOn = selected.includes(p.platform);
              const types = p.limits.postTypes || [];
              return (
                <div
                  key={p.platform}
                  className={`rounded-lg border p-2.5 transition ${
                    isOn ? "border-brand-500 bg-brand-50 dark:bg-brand-700/10" : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => togglePlatform(p.platform)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 text-sm font-medium">{p.displayName}</span>
                    {target && target.status !== "pending" && <StatusBadge status={target.status} />}
                    {!p.connected && (
                      <span className="text-xs text-amber-600" title={t("editor.accountNotConnected")}>
                        ⚠️
                      </span>
                    )}
                  </label>

                  {/* Tipo di pubblicazione: solo se la piattaforma ne ha più di uno */}
                  {isOn && types.length > 1 && (
                    <select
                      className="input mt-2 py-1 text-xs"
                      value={postTypes[p.platform] || types[0]}
                      onChange={(e) =>
                        setPostTypes((prev) => ({ ...prev, [p.platform]: e.target.value }))
                      }
                    >
                      {types.map((ty) => (
                        <option key={ty} value={ty}>
                          {t(`postType.${ty}`)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Opzioni imposte dalla piattaforma (TikTok Direct Post) */}
                  {isOn && p.platform === "tiktok" && p.connected && (
                    (postTypes.tiktok || types[0]) === "draft" ? (
                      <p className="mt-2 text-[10px] text-gray-500">{t("tiktok.draftNote")}</p>
                    ) : (
                      <TikTokOptions
                        value={targetOptions.tiktok || {}}
                        photo={(postTypes.tiktok || types[0]) === "photo"}
                        onChange={(next) => setTargetOptions((prev) => ({ ...prev, tiktok: next }))}
                      />
                    )
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-secondary mt-3 w-full text-xs"
            onClick={doAdapt}
            disabled={busy !== "" || selected.length === 0}
          >
            {busy === "adapt" ? t("editor.adapting") : t("editor.adapt")}
          </button>
        </div>

        <div className="card">
          <h3 className="mb-2 font-semibold">{t("editor.scheduling")}</h3>
          <input
            type="datetime-local"
            className="input"
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
          />
        </div>

        <div className="card space-y-2">
          {post && (
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-500">{t("editor.status")}</span>
              <StatusBadge status={post.status} />
            </div>
          )}
          <button className="btn-primary w-full" onClick={doPublish} disabled={busy !== ""}>
            {busy === "publish" ? t("editor.publishing") : t("editor.publishNow")}
          </button>
          <button className="btn-secondary w-full" onClick={() => doSave("scheduled")} disabled={busy !== ""}>
            {busy === "scheduled" ? t("editor.scheduleBusy") : t("editor.schedule")}
          </button>
          <button className="btn-secondary w-full" onClick={() => doSave("draft")} disabled={busy !== ""}>
            {busy === "draft" ? t("editor.saveBusy") : t("editor.saveDraft")}
          </button>
          {message && (
            <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
          )}
        </div>

        {/* Esiti per piattaforma */}
        {post && post.targets.some((t) => t.externalUrl || t.error) && (
          <div className="card">
            <h3 className="mb-2 font-semibold">{t("editor.outcomes")}</h3>
            <ul className="space-y-2 text-sm">
              {post.targets.map((tgt) => {
                const retry = retryInfo(tgt, t);
                return (
                  <li key={tgt.platform} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span>{tgt.platform}</span>
                      {tgt.externalUrl ? (
                        <a href={tgt.externalUrl} target="_blank" className="text-brand-600 hover:underline">
                          {t("common.open")}
                        </a>
                      ) : (
                        <StatusBadge status={tgt.status} />
                      )}
                    </div>
                    {retry && <span className="text-xs text-amber-600">⏳ {retry}</span>}
                    {tgt.status === "failed" && !tgt.nextRetryAt && (
                      <span className="text-xs text-red-500">{t("editor.retriesExhausted")}</span>
                    )}
                    {/* Il motivo del fallimento va mostrato, non nascosto in un tooltip:
                        senza non si capisce se riprovare o cambiare il contenuto. */}
                    {tgt.status === "failed" && tgt.error && (
                      <span className="break-words text-xs text-red-500">⚠️ {tgt.error}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
