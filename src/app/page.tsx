"use client";
/**
 * Dashboard: post programmati, bozze, ultimi pubblicati + mini statistiche.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type PlatformInfo } from "@/lib/client";
import type { Post } from "@/types";
import { PostCard } from "@/components/PostCard";

export default function Dashboard() {
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
    if (!confirm("Eliminare questo post?")) return;
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

  if (loading) return <p className="text-gray-500">Caricamento…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/posts/new" className="btn-primary">
          ✍️ Nuovo Post
        </Link>
      </div>

      {/* Statistiche rapide */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Programmati", value: scheduled.length, icon: "🗓️" },
          { label: "Bozze", value: drafts.length, icon: "📝" },
          { label: "Pubblicati", value: posts.filter((p) => p.status === "published").length, icon: "✅" },
          { label: "Account connessi", value: `${connected}/${platforms.length}`, icon: "🔗" },
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
          ⚠️ Nessun account social connesso.{" "}
          <Link href="/settings" className="font-medium text-brand-600 hover:underline">
            Vai alle Impostazioni
          </Link>{" "}
          per collegare i tuoi account.
        </div>
      )}

      {/* Ricerca full-text */}
      <input
        className="input"
        placeholder="🔍 Cerca tra i tuoi post (titolo, testo, hashtag)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {q ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            🔍 Risultati ({results.length})
          </h2>
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun post corrisponde a &quot;{query}&quot;.</p>
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
          <h2 className="text-lg font-semibold">🗓️ In programma</h2>
          <Link href="/calendar" className="text-sm text-brand-600 hover:underline">
            Apri calendario →
          </Link>
        </div>
        {scheduled.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun post programmato.</p>
        ) : (
          <div className="space-y-2">
            {scheduled.map((p) => (
              <PostCard key={p.id} post={p} platforms={platforms} onDuplicate={duplicate} onDelete={remove} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">📝 Bozze</h2>
        {drafts.length === 0 ? (
          <p className="text-sm text-gray-500">Nessuna bozza.</p>
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
          <h2 className="text-lg font-semibold">✅ Ultimi pubblicati</h2>
          <Link href="/history" className="text-sm text-brand-600 hover:underline">
            Cronologia completa →
          </Link>
        </div>
        {published.length === 0 ? (
          <p className="text-sm text-gray-500">Ancora nessuna pubblicazione.</p>
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
