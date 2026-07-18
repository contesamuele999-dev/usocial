/**
 * Lo schema SQLite deve essere valido e le relazioni (cascade) funzionanti.
 */
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db";

describe("schema database", () => {
  it("crea tutte le tabelle", () => {
    const db = createTestDb();
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((t) => t.name);
    for (const t of ["users", "sessions", "posts", "post_targets", "media", "post_media", "accounts", "logs", "settings"]) {
      expect(tables).toContain(t);
    }
  });

  it("post_targets ha la colonna next_retry_at (retry automatico)", () => {
    const db = createTestDb();
    const cols = (db.prepare("PRAGMA table_info(post_targets)").all() as { name: string }[]).map(
      (c) => c.name
    );
    expect(cols).toContain("next_retry_at");
  });

  it("elimina i target quando si elimina il post (cascade)", () => {
    const db = createTestDb();
    const { lastInsertRowid: postId } = db
      .prepare("INSERT INTO posts (title, body) VALUES ('t', 'b')")
      .run();
    db.prepare("INSERT INTO post_targets (post_id, platform) VALUES (?, 'facebook')").run(postId);
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
    const targets = db.prepare("SELECT * FROM post_targets WHERE post_id = ?").all(postId);
    expect(targets).toHaveLength(0);
  });

  it("impedisce doppioni piattaforma per lo stesso post", () => {
    const db = createTestDb();
    const { lastInsertRowid: postId } = db
      .prepare("INSERT INTO posts (title, body) VALUES ('t', 'b')")
      .run();
    db.prepare("INSERT INTO post_targets (post_id, platform) VALUES (?, 'facebook')").run(postId);
    expect(() =>
      db.prepare("INSERT INTO post_targets (post_id, platform) VALUES (?, 'facebook')").run(postId)
    ).toThrow();
  });
});
