/**
 * Le tre logiche nuove che possono rompere qualcosa di serio:
 *  - quali media si possono cancellare dopo la pubblicazione (rischio: perdere
 *    un file ancora usato da un post programmato);
 *  - quando rinnovare un token (rischio: pubblicazione fallita fra mesi);
 *  - quali avvisi di formato mostrare prima di pubblicare.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// il repository usa DATA_DIR: va impostato PRIMA di importarlo
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-test-"));
const { getDb } = await import("@/lib/db");
const { reclaimablePostMedia, mediaPendingUsage } = await import("@/lib/repo");
const { needsRefresh } = await import("@/social/tokens");
const { mediaWarnings } = await import("@/lib/client");
const { instagramModule } = await import("@/social/instagram");
const { tiktokModule } = await import("@/social/tiktok");

/** Crea un post con un media collegato; ritorna gli id. */
function seed(status: string, mediaFilename: string) {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (1, 'test@example.com', 'x')"
  ).run();
  const postId = db
    .prepare("INSERT INTO posts (user_id, title, body, status) VALUES (1, 't', 'b', ?)")
    .run(status).lastInsertRowid as number;
  const mediaId = db
    .prepare(
      "INSERT INTO media (user_id, filename, original_name, mime, size) VALUES (1, ?, 'v.mp4', 'video/mp4', 100)"
    )
    .run(mediaFilename).lastInsertRowid as number;
  db.prepare("INSERT INTO post_media (post_id, media_id) VALUES (?, ?)").run(postId, mediaId);
  return { postId, mediaId };
}

describe("pulizia media dopo la pubblicazione", () => {
  it("libera i media di un post pubblicato", () => {
    const { postId, mediaId } = seed("published", `a-${Date.now()}.mp4`);
    expect(reclaimablePostMedia(postId).map((m) => m.id)).toEqual([mediaId]);
  });

  it("NON tocca un media usato anche da un post programmato", () => {
    const { postId, mediaId } = seed("published", `b-${Date.now()}.mp4`);
    const db = getDb();
    const otherId = db
      .prepare("INSERT INTO posts (user_id, title, body, status) VALUES (1, 't2', 'b', 'scheduled')")
      .run().lastInsertRowid as number;
    db.prepare("INSERT INTO post_media (post_id, media_id) VALUES (?, ?)").run(otherId, mediaId);
    expect(reclaimablePostMedia(postId)).toHaveLength(0);
  });
});

describe("media in attesa di pubblicazione", () => {
  it("elenca i post in coda che usano il media, e ignora quelli pubblicati", () => {
    const scheduled = seed("scheduled", `c-${Date.now()}.mp4`);
    const published = seed("published", `d-${Date.now()}.mp4`);
    const pending = mediaPendingUsage(1);
    expect(pending[scheduled.mediaId]?.map((u) => u.postId)).toEqual([scheduled.postId]);
    expect(pending[published.mediaId]).toBeUndefined();
  });
});

describe("rinnovo token", () => {
  const account = (platform: string, expiresAt: string | null) =>
    ({ platform, expiresAt, userId: 1 }) as Parameters<typeof needsRefresh>[0];

  it("rinnova un token TikTok che scade fra 6 ore", () => {
    expect(needsRefresh(account("tiktok", new Date(Date.now() + 6 * 3600_000).toISOString()))).toBe(true);
  });

  it("non rinnova un token TikTok appena creato (24 ore)", () => {
    expect(needsRefresh(account("tiktok", new Date(Date.now() + 24 * 3600_000).toISOString()))).toBe(false);
  });

  it("rinnova un token Meta con 10 giorni residui (dura 60 giorni)", () => {
    expect(needsRefresh(account("facebook", new Date(Date.now() + 10 * 24 * 3600_000).toISOString()))).toBe(true);
  });

  it("ignora gli account senza scadenza nota", () => {
    expect(needsRefresh(account("linkedin", null))).toBe(false);
  });
});

describe("avvisi di formato", () => {
  const info = (mod: typeof tiktokModule) => ({
    platform: mod.platform,
    displayName: mod.displayName,
    color: mod.color,
    limits: mod.limits,
    connected: true,
    accountName: null,
    expiresAt: null,
  });
  const t = (key: string) => key;

  it("segnala un PNG su Instagram (accetta solo JPEG)", () => {
    const out = mediaWarnings([{ originalName: "a.png", mime: "image/png" }], [info(instagramModule)], t);
    expect(out).toHaveLength(1);
  });

  it("accetta un JPEG su Instagram", () => {
    expect(
      mediaWarnings([{ originalName: "a.jpg", mime: "image/jpeg" }], [info(instagramModule)], t)
    ).toHaveLength(0);
  });

  it("segnala un'immagine su TikTok (solo video) e il video WebM non supportato", () => {
    expect(
      mediaWarnings([{ originalName: "a.jpg", mime: "image/jpeg" }], [info(tiktokModule)], t)
    ).toHaveLength(1);
    expect(
      mediaWarnings([{ originalName: "a.webm", mime: "video/webm" }], [info(tiktokModule)], t)
    ).toHaveLength(1);
  });
});
