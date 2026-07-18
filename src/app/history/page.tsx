"use client";
/**
 * Cronologia: storico pubblicazioni per piattaforma (con errori e tentativi)
 * + log applicativi grezzi.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate, retryInfo, type PlatformInfo } from "@/lib/client";
import type { LogEntry, Post } from "@/types";
import { StatusBadge } from "@/components/PostCard";

export default function HistoryPage() {
  const [tab, setTab] = useState<"posts" | "logs">("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);

  useEffect(() => {
    api<Post[]>("/api/posts").then((all) =>
      setPosts(all.filter((p) => p.targets.some((t) => t.status !== "pending")))
    );
    api<LogEntry[]>("/api/logs").then(setLogs);
    api<PlatformInfo[]>("/api/platforms").then(setPlatforms);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cronologia</h1>
      <div className="flex gap-2">
        <button
          className={tab === "posts" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("posts")}
        >
          📤 Pubblicazioni
        </button>
        <button
          className={tab === "logs" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("logs")}
        >
          📜 Log
        </button>
      </div>

      {tab === "posts" && (
        <div className="space-y-3">
          {posts.length === 0 && <p className="text-sm text-gray-500">Nessuna pubblicazione.</p>}
          {posts.map((p) => (
            <div key={p.id} className="card">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                <Link href={`/posts/${p.id}`} className="font-medium hover:underline">
                  {p.title || p.body.slice(0, 60) || `Post #${p.id}`}
                </Link>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {p.targets.map((t) => {
                    const info = platforms.find((x) => x.platform === t.platform);
                    return (
                      <tr key={t.platform} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: info?.color || "#999" }}
                            />
                            {info?.displayName || t.platform}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-gray-500">
                          {t.publishedAt
                            ? fmtDate(t.publishedAt)
                            : t.attempts > 0
                              ? `${t.attempts} tentativ${t.attempts === 1 ? "o" : "i"}`
                              : ""}
                        </td>
                        <td className="py-1.5 text-right">
                          {t.externalUrl ? (
                            <a href={t.externalUrl} target="_blank" className="text-brand-600 hover:underline">
                              Apri ↗
                            </a>
                          ) : retryInfo(t) ? (
                            <span className="text-xs text-amber-600">⏳ {retryInfo(t)}</span>
                          ) : t.error ? (
                            <span className="block max-w-64 truncate text-xs text-red-500" title={t.error}>
                              {t.error}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 pr-3">Quando</th>
                <th className="py-1 pr-3">Livello</th>
                <th className="py-1 pr-3">Modulo</th>
                <th className="py-1">Messaggio</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 align-top dark:border-gray-800">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-gray-500">
                    {fmtDate(l.createdAt)}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`badge ${
                        l.level === "error"
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : l.level === "warn"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {l.level}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-xs">{l.scope}</td>
                  <td className="py-1.5">
                    {l.message}
                    {l.detail && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-gray-400">dettagli</summary>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
                          {l.detail}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
