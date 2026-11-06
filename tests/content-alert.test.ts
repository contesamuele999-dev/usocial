/**
 * Avviso contenuti in esaurimento: chi va avvisato (funzione pura) e la query
 * che calcola, per account, l'ultimo post programmato (SQLite vero).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-alert-"));

const now = new Date("2026-11-06T10:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86400_000).toISOString();

describe("pickAlerts", async () => {
  const { pickAlerts } = await import("@/lib/content-alert");
  const row = (platform: string, lastAt: string | null) =>
    ({ userId: 1, email: "a@b.it", platform, accountName: "", lastAt });

  it("avvisa entro 7 giorni o senza post, non oltre, e una volta sola", () => {
    const rows = [row("instagram", inDays(3)), row("tiktok", null), row("facebook", inDays(10))];
    expect(pickAlerts(rows, now, () => "").map((r) => r.platform)).toEqual(["instagram", "tiktok"]);
    // già segnalati con la stessa data: silenzio
    const seen = (r: { lastAt: string | null }) => r.lastAt ?? "none";
    expect(pickAlerts(rows, now, seen)).toEqual([]);
    // nuovi post programmati e di nuovo in esaurimento: si riavvisa
    expect(pickAlerts([row("instagram", inDays(5))], now, () => inDays(3))).toHaveLength(1);
  });
});

describe("coverage", async () => {
  const { getDb } = await import("@/lib/db");
  const { coverage } = await import("@/lib/content-alert");
  const db = getDb();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES (1, 'a@b.it', 'x')").run();
  for (const p of ["instagram", "tiktok"])
    db.prepare("INSERT INTO accounts (user_id, platform, access_token) VALUES (1, ?, 't')").run(p);
  const post = (at: string, status: string, platform: string, tStatus = "pending") => {
    const id = db
      .prepare("INSERT INTO posts (user_id, status, scheduled_at) VALUES (1, ?, ?)")
      .run(status, at).lastInsertRowid;
    db.prepare("INSERT INTO post_targets (post_id, platform, status) VALUES (?, ?, ?)").run(id, platform, tStatus);
  };
  post(inDays(2), "scheduled", "instagram");
  post(inDays(9), "scheduled", "instagram");
  post(inDays(20), "draft", "instagram"); // bozza: non conta
  post(inDays(-1), "published", "tiktok", "published"); // passato: non conta

  it("prende l'ultimo post programmato futuro per account", () => {
    const byPlatform = Object.fromEntries(coverage(now).map((r) => [r.platform, r.lastAt]));
    expect(byPlatform).toEqual({ instagram: inDays(9), tiktok: null });
  });
});
