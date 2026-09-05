/**
 * Statistiche dei post pubblicati: lettura delle metriche dalle piattaforme,
 * aggregazione e consigli.
 *
 * Due parti nettamente separate:
 *  - `refreshMetrics` parla con le API social e scrive in `post_metrics`;
 *  - `buildStats` legge solo dal DB ed è quindi istantaneo (la pagina si apre
 *    senza aspettare nessuna rete) e testabile senza mock.
 *
 * I consigli non contengono testo: sono `{ id, vars }` tradotti dalla UI, come
 * il resto dell'interfaccia. Un consiglio scritto qui in italiano sarebbe
 * l'unica frase non tradotta della pagina.
 */
import { logger } from "./logger";
import {
  getAccount,
  lastMetricsFetch,
  metricRows,
  metricTargets,
  saveMetrics,
  type MetricRow,
} from "./repo";
import { allModules, getModule } from "@/social/registry";
import type { Platform } from "@/types";

/** Finestra predefinita delle statistiche (giorni). */
export const DEFAULT_DAYS = 30;

/** Somma delle interazioni di un post, con lo stesso metro su ogni piattaforma. */
export function engagementOf(r: {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}): number {
  return (r.likes || 0) + (r.comments || 0) + (r.shares || 0) + (r.saves || 0);
}

/** true se la riga ha almeno un numero letto dalla piattaforma. */
function hasMetrics(r: MetricRow): boolean {
  return (
    r.views !== null ||
    r.likes !== null ||
    r.comments !== null ||
    r.shares !== null ||
    r.saves !== null
  );
}

export interface Totals {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  /** Interazioni ogni 100 visualizzazioni; null se nessun post ha le views. */
  engagementRate: number | null;
}

export interface PlatformStats extends Totals {
  platform: Platform;
  displayName: string;
  color: string;
  connected: boolean;
  /** Post pubblicati di cui NON si sono potute leggere le metriche. */
  missing: number;
  /** Motivo dell'ultimo errore di lettura, se c'è stato. */
  error: string | null;
}

export interface SeriesPoint {
  /** Giorno (YYYY-MM-DD). */
  date: string;
  posts: number;
  views: number;
  engagement: number;
}

export interface TopPost {
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

/** Consiglio: la UI lo traduce con la chiave `stats.tips.<id>` e le `vars`. */
export interface Tip {
  id: string;
  level: "good" | "warn" | "info";
  vars: Record<string, string | number>;
}

export interface StatsPayload {
  days: number;
  from: string;
  to: string;
  lastFetch: string | null;
  totals: Totals;
  byPlatform: PlatformStats[];
  series: SeriesPoint[];
  top: TopPost[];
  /** Post pubblicati con zero interazioni: da rivedere. */
  weak: TopPost[];
  coverage: { total: number; withMetrics: number };
  tips: Tip[];
}

function emptyTotals(): Totals {
  return {
    posts: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagement: 0,
    engagementRate: null,
  };
}

function addRow(t: Totals, r: MetricRow) {
  t.posts++;
  t.views += r.views || 0;
  t.likes += r.likes || 0;
  t.comments += r.comments || 0;
  t.shares += r.shares || 0;
  t.saves += r.saves || 0;
  t.engagement += engagementOf(r);
}

/** Generica sul tipo concreto: applicata a `PlatformStats` non deve degradarla a `Totals`. */
function closeTotals<T extends Totals>(t: T): T {
  t.engagementRate = t.views > 0 ? Math.round((t.engagement / t.views) * 1000) / 10 : null;
  return t;
}

/** ISO del momento `days` giorni fa (inizio della finestra). */
export function windowStart(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86400_000).toISOString();
}

// ---------------------------------------------------------------- refresh ---

export interface RefreshResult {
  checked: number;
  updated: number;
  failed: number;
  /** Un messaggio per piattaforma: quello che l'utente deve sapere per rimediare. */
  errors: { platform: Platform; message: string }[];
}

/**
 * Rilegge le metriche dalle piattaforme per i post pubblicati nella finestra.
 *
 * Un errore su un post non ferma gli altri: viene salvato sulla riga e la
 * pagina lo mostra accanto al post. Le piattaforme senza `insights` (o senza
 * account collegato) vengono saltate in silenzio.
 */
export async function refreshMetrics(userId: number, days = DEFAULT_DAYS): Promise<RefreshResult> {
  const targets = metricTargets(windowStart(days), userId);
  const res: RefreshResult = { checked: 0, updated: 0, failed: 0, errors: [] };
  /** Un errore per piattaforma basta: sono tutti lo stesso problema di permessi. */
  const reported = new Set<Platform>();

  for (const target of targets) {
    const mod = getModule(target.platform);
    if (!mod.insights) continue;
    const account = getAccount(userId, target.platform);
    if (!account) continue;

    res.checked++;
    try {
      const metrics = await mod.insights(account, target.externalId);
      saveMetrics(target, metrics);
      res.updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      saveMetrics(target, null, message);
      res.failed++;
      if (!reported.has(target.platform)) {
        reported.add(target.platform);
        res.errors.push({ platform: target.platform, message });
      }
    }
  }

  logger.info(
    "stats",
    `Metriche aggiornate: ${res.updated} lette, ${res.failed} non disponibili (${res.checked} post controllati)`,
    res.errors.length ? JSON.stringify(res.errors) : undefined,
    userId
  );
  return res;
}

// -------------------------------------------------------------- aggregate ---

/** Giorno della settimana 0=lunedì … 6=domenica (l'ISO di JS parte da domenica). */
function weekdayIndex(iso: string): number {
  return (new Date(iso).getDay() + 6) % 7;
}

/** Media di un gruppo, arrotondata; 0 se il gruppo è vuoto. */
function avg(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Numero di hashtag di un post (campo dedicato + quelli scritti nel testo). */
export function countHashtags(row: MetricRow): number {
  const inBody = row.body.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  const inField = row.hashtags.match(/#?[\p{L}\p{N}_]+/gu)?.length ?? 0;
  return inBody + inField;
}

/**
 * Consigli ricavati dai dati. Ogni regola ha una soglia minima di campioni:
 * suggerire "pubblica il martedì" avendo due post è peggio che tacere.
 */
export function buildTips(rows: MetricRow[], platforms: PlatformStats[]): Tip[] {
  const tips: Tip[] = [];
  const scored = rows.filter(hasMetrics);

  // Serve un minimo di storia perché qualsiasi confronto abbia senso.
  if (scored.length < 5) {
    tips.push({ id: "needMoreData", level: "info", vars: { have: scored.length, need: 5 } });
    return tips;
  }

  /** Confronta gruppi e restituisce il migliore, se ha abbastanza campioni. */
  const bestGroup = <K extends string | number>(
    groups: Map<K, number[]>,
    minSize: number
  ): { key: K; avg: number; overall: number } | null => {
    const all = [...groups.values()].flat();
    if (!all.length) return null;
    const overall = avg(all);
    let best: { key: K; avg: number } | null = null;
    for (const [key, values] of groups) {
      if (values.length < minSize) continue;
      const a = avg(values);
      if (!best || a > best.avg) best = { key, avg: a };
    }
    return best ? { ...best, overall } : null;
  };

  const group = <K extends string | number>(keyOf: (r: MetricRow) => K) => {
    const map = new Map<K, number[]>();
    for (const r of scored) {
      const k = keyOf(r);
      const list = map.get(k) || [];
      list.push(engagementOf(r));
      map.set(k, list);
    }
    return map;
  };

  // 1) Giorno della settimana migliore.
  const byDay = bestGroup(group((r) => weekdayIndex(r.publishedAt)), 2);
  if (byDay && byDay.avg > byDay.overall * 1.2) {
    tips.push({
      id: "bestDay",
      level: "good",
      vars: { day: byDay.key, avg: byDay.avg, overall: byDay.overall },
    });
  }

  // 2) Fascia oraria migliore (blocchi di 3 ore: le ore esatte sono rumore).
  const bySlot = bestGroup(
    group((r) => Math.floor(new Date(r.publishedAt).getHours() / 3) * 3),
    2
  );
  if (bySlot && bySlot.avg > bySlot.overall * 1.2) {
    tips.push({
      id: "bestSlot",
      level: "good",
      vars: { from: bySlot.key, to: (bySlot.key as number) + 3, avg: bySlot.avg },
    });
  }

  // 3) Formato: video, foto o solo testo.
  const byFormat = group((r) => (r.hasVideo ? "video" : r.mediaCount > 0 ? "image" : "text"));
  const formatBest = bestGroup(byFormat, 2);
  if (formatBest && byFormat.size > 1 && formatBest.avg > formatBest.overall * 1.2) {
    tips.push({
      id: "bestFormat",
      level: "good",
      vars: { format: String(formatBest.key), avg: formatBest.avg, overall: formatBest.overall },
    });
  }

  // 4) Piattaforma con il tasso di interazione migliore e peggiore.
  const rated = platforms.filter((p) => p.posts >= 2 && p.engagementRate !== null);
  if (rated.length >= 2) {
    const sorted = [...rated].sort((a, b) => (b.engagementRate || 0) - (a.engagementRate || 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    tips.push({
      id: "bestPlatform",
      level: "good",
      vars: { platform: best.displayName, rate: best.engagementRate ?? 0 },
    });
    if ((worst.engagementRate || 0) * 2 < (best.engagementRate || 0)) {
      tips.push({
        id: "weakPlatform",
        level: "warn",
        vars: { platform: worst.displayName, rate: worst.engagementRate ?? 0 },
      });
    }
  }

  // 5) Quantità di hashtag: pochi / giusti / troppi, misurata sui propri post.
  const byTags = group((r) => {
    const n = countHashtags(r);
    return n === 0 ? "0" : n <= 5 ? "1-5" : n <= 15 ? "6-15" : "16+";
  });
  const tagsBest = bestGroup(byTags, 2);
  if (tagsBest && byTags.size > 1 && tagsBest.avg > tagsBest.overall * 1.15) {
    tips.push({
      id: "hashtags",
      level: "info",
      vars: { range: String(tagsBest.key), avg: tagsBest.avg },
    });
  }

  // 6) Lunghezza della didascalia.
  const byLength = group((r) => {
    const n = r.body.length;
    return n < 200 ? "short" : n < 800 ? "medium" : "long";
  });
  const lenBest = bestGroup(byLength, 2);
  if (lenBest && byLength.size > 1 && lenBest.avg > lenBest.overall * 1.15) {
    tips.push({
      id: "captionLength",
      level: "info",
      vars: { length: String(lenBest.key), avg: lenBest.avg },
    });
  }

  // 7) Costanza: la pausa più lunga fra due pubblicazioni.
  const dates = rows
    .map((r) => new Date(r.publishedAt).getTime())
    .sort((a, b) => a - b);
  if (dates.length >= 3) {
    let maxGap = 0;
    for (let i = 1; i < dates.length; i++) maxGap = Math.max(maxGap, dates[i] - dates[i - 1]);
    const gapDays = Math.round(maxGap / 86400_000);
    if (gapDays >= 7) tips.push({ id: "consistency", level: "warn", vars: { days: gapDays } });
  }

  // 8) Post senza nessuna interazione: vale la pena rivederli.
  const zero = scored.filter((r) => engagementOf(r) === 0).length;
  if (zero > 0 && zero >= scored.length / 4) {
    tips.push({ id: "zeroEngagement", level: "warn", vars: { count: zero, total: scored.length } });
  }

  // 9) Piattaforme che pubblicano ma non restituiscono numeri: è un problema di
  //    permessi, non di risultati, e va detto con chiarezza.
  for (const p of platforms) {
    if (p.posts > 0 && p.missing === p.posts && p.error) {
      tips.push({ id: "noMetrics", level: "warn", vars: { platform: p.displayName } });
    }
  }

  return tips;
}

/** Costruisce l'intero pacchetto statistiche leggendo solo dal database. */
export function buildStats(userId: number, days = DEFAULT_DAYS): StatsPayload {
  const from = windowStart(days);
  const rows = metricRows(userId, from);

  const totals = emptyTotals();
  const perPlatform = new Map<Platform, PlatformStats>();
  for (const mod of allModules()) {
    perPlatform.set(mod.platform, {
      ...emptyTotals(),
      platform: mod.platform,
      displayName: mod.displayName,
      color: mod.color,
      connected: !!getAccount(userId, mod.platform),
      missing: 0,
      error: null,
    });
  }

  const byDate = new Map<string, SeriesPoint>();

  for (const r of rows) {
    addRow(totals, r);
    const p = perPlatform.get(r.platform);
    if (p) {
      addRow(p, r);
      if (!hasMetrics(r)) p.missing++;
      if (r.error && !p.error) p.error = r.error;
    }

    const day = r.publishedAt.slice(0, 10);
    const point = byDate.get(day) || { date: day, posts: 0, views: 0, engagement: 0 };
    point.posts++;
    point.views += r.views || 0;
    point.engagement += engagementOf(r);
    byDate.set(day, point);
  }

  closeTotals(totals);
  const byPlatform = [...perPlatform.values()]
    .map(closeTotals)
    .filter((p) => p.posts > 0 || p.connected)
    .sort((a, b) => b.engagement - a.engagement);

  // Serie continua: i giorni senza pubblicazioni devono valere zero, non
  // sparire, altrimenti il grafico comprime le pause e mente sull'andamento.
  const series: SeriesPoint[] = [];
  const startDay = new Date(from);
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDay.getTime() + i * 86400_000).toISOString().slice(0, 10);
    series.push(byDate.get(d) || { date: d, posts: 0, views: 0, engagement: 0 });
  }

  const toTop = (r: MetricRow): TopPost => {
    const engagement = engagementOf(r);
    const text = (r.title || r.body).replace(/\s+/g, " ").trim();
    return {
      targetId: r.targetId,
      postId: r.postId,
      platform: r.platform,
      title: r.title,
      excerpt: text.slice(0, 120),
      publishedAt: r.publishedAt,
      url: r.externalUrl,
      views: r.views,
      engagement,
      engagementRate: r.views ? Math.round((engagement / r.views) * 1000) / 10 : null,
      hasMetrics: hasMetrics(r),
    };
  };

  const scored = rows.filter(hasMetrics);
  const top = [...scored]
    .sort((a, b) => engagementOf(b) - engagementOf(a))
    .slice(0, 5)
    .map(toTop);
  const weak = [...scored]
    .sort((a, b) => engagementOf(a) - engagementOf(b))
    .slice(0, 3)
    .map(toTop)
    .filter((p) => p.engagement < (top[0]?.engagement ?? 0));

  return {
    days,
    from,
    to: new Date().toISOString(),
    lastFetch: lastMetricsFetch(userId),
    totals,
    byPlatform,
    series,
    top,
    weak,
    coverage: { total: rows.length, withMetrics: scored.length },
    tips: buildTips(rows, byPlatform),
  };
}
