"use client";
/**
 * Calendario editoriale mensile con drag & drop:
 * trascina un post su un altro giorno per riprogrammarlo (l'orario resta).
 * Click su un giorno vuoto = nuovo post con quella data.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, getPlatforms, STATUS_ACCENT, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { Platform, Post, PostStatus } from "@/types";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Stati mostrati in legenda (e nel filtro), nell'ordine del ciclo di vita. */
const STATUS_KEYS: PostStatus[] = ["draft", "scheduled", "publishing", "published", "partial", "failed"];

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [filter, setFilter] = useState<Platform | "">("");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "">("");
  const [dragId, setDragId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [p, pl] = await Promise.all([
      api<Post[]>("/api/posts"),
      getPlatforms(),
    ]);
    setPosts(p);
    setPlatforms(pl);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Griglia del mese: settimane che iniziano di lunedì
  const first = new Date(cursor);
  const offset = (first.getDay() + 6) % 7; // 0 = lunedì
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const visible = posts.filter(
    (p) =>
      (!filter || p.targets.some((t) => t.platform === filter)) &&
      (!statusFilter || p.status === statusFilter)
  );

  const byDay = (d: Date) =>
    visible.filter((p) => p.scheduledAt && ymd(new Date(p.scheduledAt)) === ymd(d));

  const onDrop = async (day: Date) => {
    if (dragId === null) return;
    const post = posts.find((p) => p.id === dragId);
    setDragId(null);
    if (!post) return;
    // mantiene l'orario originale (o 09:00 se non c'era)
    const old = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const next = new Date(day);
    next.setHours(old?.getHours() ?? 9, old?.getMinutes() ?? 0, 0, 0);
    await api(`/api/posts/${post.id}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledAt: next.toISOString() }),
    });
    load();
  };

  const duplicate = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    await api(`/api/posts/${id}/duplicate`, { method: "POST" });
    load();
  };

  const monthLabel = cursor.toLocaleString(lang === "en" ? "en-US" : "it-IT", {
    month: "long",
    year: "numeric",
  });
  const today = ymd(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("calendar.title")}</h1>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Platform | "")}
          >
            <option value="">{t("calendar.allPlatforms")}</option>
            {platforms.map((p) => (
              <option key={p.platform} value={p.platform}>
                {p.displayName}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PostStatus | "")}
          >
            <option value="">{t("calendar.allStatuses")}</option>
            {STATUS_KEYS.map((st) => (
              <option key={st} value={st}>
                {STATUS_ACCENT[st].icon} {t(`status.${st}`)}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary px-3"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ←
          </button>
          <span className="min-w-36 text-center font-semibold capitalize">{monthLabel}</span>
          <button
            className="btn-secondary px-3"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
        {DAY_KEYS.map((d) => (
          <div
            key={d}
            className="bg-gray-100 p-2 text-center text-xs font-semibold text-gray-500 dark:bg-gray-900"
          >
            {t(`calendar.days.${d}`)}
          </div>
        ))}
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const dayPosts = byDay(day);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-24 bg-white p-1.5 dark:bg-gray-950 ${inMonth ? "" : "opacity-40"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(day)}
            >
              <Link
                href={`/posts/new?date=${ymd(day)}`}
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  ymd(day) === today ? "bg-brand-600 font-bold text-white" : "text-gray-500"
                }`}
                title={t("calendar.newPostOnDay")}
              >
                {day.getDate()}
              </Link>
              <div className="space-y-1">
                {dayPosts.map((p) => {
                  const accent = STATUS_ACCENT[p.status] ?? STATUS_ACCENT.draft;
                  return (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    className={`group block cursor-grab rounded-md border border-l-4 border-gray-200 px-1.5 py-1 text-xs hover:ring-1 hover:ring-brand-400 dark:border-gray-700 ${accent.tint}`}
                    style={{ borderLeftColor: accent.color }}
                    title={`${t(`status.${p.status}`)} — ${p.title || p.body}`}
                  >
                    <span className="mr-1" aria-hidden>
                      {accent.icon}
                    </span>
                    <span className="mr-1 inline-flex gap-0.5">
                      {p.targets.map((t) => {
                        const info = platforms.find((x) => x.platform === t.platform);
                        return (
                          <span
                            key={t.platform}
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: info?.color || "#999" }}
                          />
                        );
                      })}
                    </span>
                    <span className="truncate">{p.title || p.body.slice(0, 30) || t("calendar.emptyPost")}</span>
                    <button
                      onClick={(e) => duplicate(e, p.id)}
                      className="ml-1 hidden text-gray-400 hover:text-gray-700 group-hover:inline"
                      title={t("calendar.duplicate")}
                    >
                      ⧉
                    </button>
                  </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legenda: senza, i colori delle chip andrebbero indovinati. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {STATUS_KEYS.map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: STATUS_ACCENT[st].color }}
            />
            {STATUS_ACCENT[st].icon} {t(`status.${st}`)}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">{t("calendar.hint")}</p>
    </div>
  );
}
