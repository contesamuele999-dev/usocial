"use client";
/**
 * Dashboard: post programmati, bozze, ultimi pubblicati + mini statistiche.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { Post } from "@/types";
import { PostCard } from "@/components/PostCard";

export function DashboardClient() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<Post[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [p, pl] = await Promise.all([
      api<Post[]>("/api/posts"),
      api<PlatformInfo[]>("/api/platforms"),
    ]);
    setPosts(p);
    setPlatforms(pl);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const duplicate = async (id: number) => {
    await api(`/api/posts/${id}/duplicate`, { method: "POST" });
    load();
  };
  const remove = async (id: number) => {
    if (!confirm(t("dashboard.confirmDelete"))) return;
    await api(`/api/posts/${id}`, { method: "DELETE" });
    load();
  };

  const scheduled = posts.filter((p) => p.status === "scheduled");
  const drafts = posts.filter((p) => p.status === "draft");
  const published = posts.filter((p) => ["published", "partial", "failed"].includes(p.status)).slice(0, 5);
  const connected = platforms.filter((p) => p.connected).length;

  // Ricerca full-text lato client su titolo, testo e hashtag
  const q = query.trim().toLowerCase();
  const results = q
    ? posts.filter((p) =>
        `${p.title} ${p.body} ${p.hashtags}`.toLowerCase().includes(q)
      )
    : [];

  if (loading) return <p className="text-gray-500">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <Link href="/posts/new" className="btn-primary">
          {t("dashboard.newPost")}
        </Link>
      </div>

      {/* Statistiche rapide */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("dashboard.statScheduled"), value: scheduled.length, icon: "🗓️" },
          { label: t("dashboard.statDrafts"), value: drafts.length, icon: "📝" },
          { label: t("dashboard.statPublished"), value: posts.filter((p) => p.status === "published").length, icon: "✅" },
          { label: t("dashboard.statAccounts"), value: `${connected}/${platforms.length}`, icon: "🔗" },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="text-2xl">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {connected === 0 && (
        <div className="card border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          {t("dashboard.noAccounts")}
          <Link href="/settings" className="font-medium text-brand-600 hover:underline">
            {t("dashboard.goToSettings")}
          </Link>
          {t("dashboard.toConnect")}
        </div>
      )}

      {/* Ricerca full-text */}
      <input
        className="input"
        placeholder={t("dashboard.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {q ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            {t("dashboard.results", { count: results.length })}
          </h2>
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">{t("dashboard.noResults", { query })}</p>
          ) : (
            <div className="space-y-2">
              {results.map((p) => (
                <PostCard key={p.id} post={p} platforms={platforms} onDuplicate={duplicate} onDelete={remove} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.scheduledTitle")}</h2>
          <Link href="/calendar" className="text-sm text-brand-600 hover:underline">
            {t("dashboard.openCalendar")}
          </Link>
        </div>
        {scheduled.length === 0 ? (
          <p className="text-sm text-gray-500">{t("dashboard.noScheduled")}</p>
        ) : (
          <div className="space-y-2">
            {scheduled.map((p) => (
              <PostCard key={p.id} post={p} platforms={platforms} onDuplicate={duplicate} onDelete={remove} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("dashboard.draftsTitle")}</h2>
        {drafts.length === 0 ? (
          <p className="text-sm text-gray-500">{t("dashboard.noDrafts")}</p>
        ) : (
          <div className="space-y-2">
            {drafts.map((p) => (
              <PostCard key={p.id} post={p} platforms={platforms} onDuplicate={duplicate} onDelete={remove} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.publishedTitle")}</h2>
          <Link href="/history" className="text-sm text-brand-600 hover:underline">
            {t("dashboard.fullHistory")}
          </Link>
        </div>
        {published.length === 0 ? (
          <p className="text-sm text-gray-500">{t("dashboard.noPublished")}</p>
        ) : (
          <div className="space-y-2">
            {published.map((p) => (
              <PostCard key={p.id} post={p} platforms={platforms} onDuplicate={duplicate} />
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
