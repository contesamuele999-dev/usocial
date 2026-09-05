"use client";
/**
 * Statistiche: andamento dei post pubblicati, metriche per piattaforma,
 * migliori e peggiori contenuti, consigli ricavati dai dati.
 *
 * La pagina si apre leggendo solo il database (istantanea): le API social si
 * interrogano con il pulsante "Aggiorna" o dallo scheduler, ogni 6 ore.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, fmtDay } from "@/lib/client";
import { useI18n, type TFunc } from "@/lib/i18n";
import type { Platform } from "@/types";

// ------------------------------------------------------------------ tipi ---
// Rispecchiano il payload di /api/stats (src/lib/stats.ts).

interface Totals {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  engagementRate: number | null;
}

interface PlatformStats extends Totals {
  platform: Platform;
  displayName: string;
  color: string;
  connected: boolean;
  missing: number;
  error: string | null;
  unavailable: boolean;
}

interface SeriesPoint {
  date: string;
  posts: number;
  views: number;
  engagement: number;
}

interface TopPost {
  targetId: number;
  postId: number;
  platform: Platform;
  title: string;
  excerpt: string;
  publishedAt: string;
  url: string | null;
  views: number | null;
  engagement: number;
  engagementRate: number | null;
  hasMetrics: boolean;
}

interface Tip {
  id: string;
  level: "good" | "warn" | "info";
  vars: Record<string, string | number>;
}

interface StatsPayload {
  days: number;
  from: string;
  to: string;
  lastFetch: string | null;
  totals: Totals;
  byPlatform: PlatformStats[];
  series: SeriesPoint[];
  top: TopPost[];
  weak: TopPost[];
  coverage: { total: number; withMetrics: number };
  tips: Tip[];
  refresh?: { checked: number; updated: number; failed: number; errors: { platform: Platform; message: string }[] };
}

// --------------------------------------------------------------- utility ---

/** 12500 → "12,5k": nelle schede lo spazio è poco e le cifre esatte non servono. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(".", ",")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
}

/** Traduce le variabili "codificate" di un consiglio (giorno, formato, fascia). */
function tipVars(tip: Tip, t: TFunc): Record<string, string | number> {
  const out: Record<string, string | number> = { ...tip.vars };
  if (typeof out.day === "number") out.day = t(`stats.weekday.${out.day}`);
  if (typeof out.format === "string") out.format = t(`stats.format.${out.format}`);
  if (typeof out.length === "string") out.length = t(`stats.captionLength.${out.length}`);
  return out;
}

// ------------------------------------------------------------- componenti ---

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Istogramma dell'andamento, disegnato con dei semplici div.
 *
 * Niente libreria di grafici: sarebbero centinaia di KB di JavaScript per
 * mostrare una trentina di barre, su un'app che gira su una VM piccola.
 */
function TrendChart({ series, metric, t }: { series: SeriesPoint[]; metric: "engagement" | "views"; t: TFunc }) {
  const max = Math.max(1, ...series.map((p) => p[metric]));
  return (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">{t("stats.trendTitle")}</h2>
        <span className="text-xs text-gray-400">{t(`stats.metric.${metric}`)}</span>
      </div>
      <div className="flex h-32 items-end gap-[2px]">
        {series.map((p) => {
          const value = p[metric];
          const height = Math.max(value > 0 ? 4 : 1, Math.round((value / max) * 100));
          return (
            <div
              key={p.date}
              className={`flex-1 rounded-t transition-all ${
                value > 0 ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-800"
              }`}
              style={{ height: `${height}%` }}
              title={`${fmtDay(p.date)} · ${t("stats.chartTip", {
                posts: p.posts,
                value,
                metric: t(`stats.metric.${metric}`),
              })}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400">
        <span>{fmtDay(series[0]?.date ?? null)}</span>
        <span>{fmtDay(series[series.length - 1]?.date ?? null)}</span>
      </div>
    </div>
  );
}

/**
 * Una riga è un post SU UNA PIATTAFORMA, non un post: lo stesso contenuto
 * pubblicato su Instagram e su TikTok occupa due righe, con numeri diversi.
 * Senza il pallino colorato le due righe sembrerebbero un duplicato.
 */
function PostRow({ post, color, t }: { post: TopPost; color: string; t: TFunc }) {
  const label = post.title || post.excerpt || t("stats.untitled");
  return (
    <li className="flex items-start justify-between gap-3 border-t border-gray-100 py-2 text-sm first:border-0 dark:border-gray-800">
      <div className="min-w-0">
        <Link href={`/posts/${post.postId}`} className="line-clamp-1 font-medium hover:underline">
          {label}
        </Link>
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {fmtDate(post.publishedAt)}
          {post.url && (
            <>
              {" · "}
              <a href={post.url} target="_blank" rel="noreferrer" className="hover:underline">
                {t("common.open")}
              </a>
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">{compact(post.engagement)}</p>
        <p className="text-xs text-gray-400">
          {post.views !== null
            ? t("stats.viewsShort", { n: compact(post.views) })
            : t("stats.noViews")}
        </p>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ pagina ---

export default function StatsPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<"engagement" | "views">("engagement");

  const load = useCallback(
    async (d: number) => {
      try {
        setError("");
        setData(await api<StatsPayload>(`/api/stats?days=${d}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    []
  );

  useEffect(() => {
    void load(days);
  }, [days, load]);

  /** Rilegge i numeri dalle piattaforme: è l'unica azione che tocca la rete. */
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      setData(await api<StatsPayload>(`/api/stats?days=${days}`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const totals = data?.totals;
  /** Colore della piattaforma, per distinguere le righe dei post. */
  const colorOf = (platform: Platform) =>
    data?.byPlatform.find((p) => p.platform === platform)?.color || "#999";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("stats.title")}</h1>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>{t("stats.days7")}</option>
            <option value={30}>{t("stats.days30")}</option>
            <option value={90}>{t("stats.days90")}</option>
          </select>
          <button className="btn-primary" onClick={refresh} disabled={busy}>
            {busy ? t("stats.refreshing") : t("stats.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-red-300 text-sm text-red-600 dark:border-red-900">{error}</div>
      )}

      {!data ? (
        <p className="text-sm text-gray-500">{t("common.loading")}</p>
      ) : data.totals.posts === 0 ? (
        <div className="card">
          <p className="font-medium">{t("stats.emptyTitle")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("stats.emptyBody")}</p>
          <Link href="/posts/new" className="btn-primary mt-3">
            {t("dashboard.newPost")}
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            {data.lastFetch
              ? t("stats.lastFetch", { when: fmtDate(data.lastFetch) })
              : t("stats.neverFetched")}
            {" · "}
            {t("stats.coverage", {
              with: data.coverage.withMetrics,
              total: data.coverage.total,
            })}
          </p>

          {data.refresh && data.refresh.errors.length > 0 && (
            <div className="card border-amber-300 dark:border-amber-900">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {t("stats.refreshIssues")}
              </p>
              <ul className="mt-1 space-y-1 text-xs text-gray-500">
                {data.refresh.errors.map((e) => (
                  <li key={e.platform}>
                    <span className="font-medium">{e.platform}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t("stats.kpiPosts")} value={String(totals!.posts)} />
            <StatCard label={t("stats.kpiViews")} value={compact(totals!.views)} />
            <StatCard
              label={t("stats.kpiEngagement")}
              value={compact(totals!.engagement)}
              hint={t("stats.kpiEngagementHint", {
                likes: compact(totals!.likes),
                comments: compact(totals!.comments),
              })}
            />
            <StatCard
              label={t("stats.kpiRate")}
              value={totals!.engagementRate !== null ? `${totals!.engagementRate}%` : "—"}
              hint={t("stats.kpiRateHint")}
            />
          </div>

          <div className="flex gap-2">
            {(["engagement", "views"] as const).map((m) => (
              <button
                key={m}
                className={metric === m ? "btn-primary" : "btn-secondary"}
                onClick={() => setMetric(m)}
              >
                {t(`stats.metric.${m}`)}
              </button>
            ))}
          </div>

          <TrendChart series={data.series} metric={metric} t={t} />

          {data.tips.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold">{t("stats.tipsTitle")}</h2>
              <ul className="space-y-2">
                {data.tips.map((tip) => (
                  <li key={tip.id} className="flex gap-2 text-sm">
                    <span aria-hidden>
                      {tip.level === "good" ? "✅" : tip.level === "warn" ? "⚠️" : "💡"}
                    </span>
                    <span className={tip.level === "warn" ? "text-amber-700 dark:text-amber-400" : ""}>
                      {t(`stats.tips.${tip.id}`, tipVars(tip, t))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-gray-400">{t("stats.tipsDisclaimer")}</p>
            </div>
          )}

          <div className="card overflow-x-auto">
            <h2 className="mb-2 font-semibold">{t("stats.byPlatform")}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1 pr-2">{t("stats.colPlatform")}</th>
                  <th className="py-1 pr-2 text-right">{t("stats.colPosts")}</th>
                  <th className="py-1 pr-2 text-right">{t("stats.colViews")}</th>
                  <th className="py-1 pr-2 text-right">{t("stats.colEngagement")}</th>
                  <th className="py-1 text-right">{t("stats.colRate")}</th>
                </tr>
              </thead>
              <tbody>
                {data.byPlatform.map((p) => (
                  <tr key={p.platform} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.displayName}
                      </span>
                      {p.missing > 0 && (
                        // Grigio, non ambra, quando non c'è niente da
                        // sistemare: un avviso colorato su un fatto immutabile
                        // è solo rumore.
                        <span
                          className={`text-[11px] ${p.unavailable ? "text-gray-400" : "text-amber-600"}`}
                          title={p.error || ""}
                        >
                          {p.unavailable
                            ? t("stats.missingUnsupported")
                            : t("stats.missingMetrics", { n: p.missing })}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{p.posts}</td>
                    <td className="py-1.5 pr-2 text-right">{p.views ? compact(p.views) : "—"}</td>
                    <td className="py-1.5 pr-2 text-right">{compact(p.engagement)}</td>
                    <td className="py-1.5 text-right">
                      {p.engagementRate !== null ? `${p.engagementRate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="card">
              <h2 className="mb-1 font-semibold">{t("stats.topTitle")}</h2>
              {data.top.length === 0 ? (
                <p className="text-sm text-gray-500">{t("stats.noScored")}</p>
              ) : (
                <ul>
                  {data.top.map((p) => (
                    <PostRow key={p.targetId} post={p} color={colorOf(p.platform)} t={t} />
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <h2 className="mb-1 font-semibold">{t("stats.weakTitle")}</h2>
              {data.weak.length === 0 ? (
                <p className="text-sm text-gray-500">{t("stats.noWeak")}</p>
              ) : (
                <ul>
                  {data.weak.map((p) => (
                    <PostRow key={p.targetId} post={p} color={colorOf(p.platform)} t={t} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
