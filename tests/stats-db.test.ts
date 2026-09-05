/**
 * Statistiche, lato database: le query di `post_metrics` e l'aggregazione di
 * `buildStats` girano su uno SQLite vero, in una cartella temporanea.
 *
 * Vale la pena provarle davvero: sono JOIN scritte a mano, e un errore lì non
 * lo prende né TypeScript né un test sulle sole funzioni pure.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Platform } from "@/types";

// DATA_DIR va impostata PRIMA che `@/lib/db` venga caricato: da qui in poi gli
// import sono dinamici, altrimenti l'hoisting li anticiperebbe a questa riga.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-stats-"));
process.env.DATA_DIR = dataDir;

type Repo = typeof import("@/lib/repo");
type Stats = typeof import("@/lib/stats");

let repo: Repo;
let stats: Stats;

const USER = 1;
/** Data di pubblicazione a N giorni fa (dentro la finestra di 30). */
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

beforeAll(async () => {
  const { getDb } = await import("@/lib/db");
  repo = await import("@/lib/repo");
  stats = await import("@/lib/stats");

  const db = getDb();
  db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").run(
    USER,
    "test@example.com",
    "Test",
    "x"
  );
  db.prepare(
    "INSERT INTO media (id, user_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(1, USER, "clip.mp4", "clip.mp4", "video/mp4", 10);

  const addPost = (id: number, title: string, body: string, withVideo: boolean) => {
    db.prepare("INSERT INTO posts (id, user_id, title, body, status) VALUES (?, ?, ?, ?, 'published')").run(
      id,
      USER,
      title,
      body
    );
    if (withVideo) {
      db.prepare("INSERT INTO post_media (post_id, media_id, sort) VALUES (?, 1, 0)").run(id);
    }
  };
  const addTarget = (
    id: number,
    postId: number,
    platform: Platform,
    externalId: string | null,
    publishedAt: string
  ) =>
    db
      .prepare(
        `INSERT INTO post_targets (id, post_id, platform, status, external_id, external_url, published_at)
         VALUES (?, ?, ?, 'published', ?, ?, ?)`
      )
      .run(id, postId, platform, externalId, externalId ? `https://x/${externalId}` : null, publishedAt);

  addPost(1, "Reel", "corpo #uno", true);
  addTarget(1, 1, "instagram", "ig-1", daysAgo(3));
  addTarget(2, 1, "tiktok", "tt-1", daysAgo(3));

  addPost(2, "Solo testo", "niente media", false);
  addTarget(3, 2, "linkedin", "li-1", daysAgo(10));

  // Fuori finestra: non deve comparire nelle statistiche a 7 giorni.
  addPost(3, "Vecchio", "vecchio", false);
  addTarget(4, 3, "instagram", "ig-old", daysAgo(60));

  // Pubblicato ma senza id esterno: non è interrogabile sulla piattaforma.
  addPost(4, "Senza id", "boh", false);
  addTarget(5, 4, "facebook", null, daysAgo(2));
});

describe("metricTargets", () => {
  it("prende solo i post pubblicati con id esterno dentro la finestra", () => {
    const found = repo.metricTargets(stats.windowStart(30), USER);
    expect(found.map((t) => t.externalId).sort()).toEqual(["ig-1", "li-1", "tt-1"]);
    // Ogni target porta con sé l'utente: il refresh non deve doverlo cercare.
    expect(found.every((t) => t.userId === USER)).toBe(true);
  });

  it("rispetta la finestra temporale", () => {
    expect(repo.metricTargets(stats.windowStart(7), USER)).toHaveLength(2);
    expect(repo.metricTargets(stats.windowStart(90), USER)).toHaveLength(4);
  });
});

describe("saveMetrics", () => {
  it("sovrascrive la fotografia precedente invece di accumularne una nuova", () => {
    const [target] = repo.metricTargets(stats.windowStart(30), USER);
    repo.saveMetrics(target, { views: 10, likes: 1 });
    repo.saveMetrics(target, { views: 999, likes: 50 });
    const row = repo.metricRows(USER, stats.windowStart(30)).find((r) => r.targetId === target.targetId);
    expect(row?.views).toBe(999);
    expect(row?.likes).toBe(50);
  });

  it("conserva il motivo quando la lettura fallisce", () => {
    const target = repo
      .metricTargets(stats.windowStart(30), USER)
      .find((t) => t.platform === "tiktok")!;
    repo.saveMetrics(target, null, "permesso video.list mancante");
    const row = repo.metricRows(USER, stats.windowStart(30)).find((r) => r.targetId === target.targetId);
    expect(row?.error).toContain("video.list");
    // Nessun numero inventato: resta distinguibile da "zero visualizzazioni".
    expect(row?.views).toBeNull();
  });
});

describe("buildStats", () => {
  it("aggrega solo il periodo chiesto e riconosce i media del post", () => {
    const all = repo.metricTargets(stats.windowStart(30), USER);
    for (const t of all) repo.saveMetrics(t, { views: 100, likes: 8, comments: 2 });

    const payload = stats.buildStats(USER, 30);
    expect(payload.totals.posts).toBe(4); // 3 con id + quello senza
    expect(payload.totals.views).toBe(300);
    expect(payload.totals.engagement).toBe(30);
    // 30 interazioni su 300 visualizzazioni = 10 ogni 100.
    expect(payload.totals.engagementRate).toBe(10);
    expect(payload.coverage).toEqual({ total: 4, withMetrics: 3 });

    const ig = payload.byPlatform.find((p) => p.platform === "instagram");
    expect(ig?.posts).toBe(1); // il post di 60 giorni fa è fuori finestra
  });

  it("costruisce una serie continua, con zero nei giorni senza pubblicazioni", () => {
    const payload = stats.buildStats(USER, 7);
    expect(payload.series).toHaveLength(8); // 7 giorni + oggi
    expect(payload.series.filter((p) => p.posts > 0).length).toBeGreaterThan(0);
    expect(payload.series.some((p) => p.posts === 0)).toBe(true);
    // Ordinata dal più vecchio al più recente.
    const dates = payload.series.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("elenca i post migliori solo fra quelli con metriche", () => {
    const payload = stats.buildStats(USER, 30);
    expect(payload.top.every((p) => p.hasMetrics)).toBe(true);
    expect(payload.top.length).toBeLessThanOrEqual(5);
  });
});
