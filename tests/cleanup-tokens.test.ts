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
const { reclaimablePostMedia, mediaPendingUsage, scheduleMediaReclaim, dueReclaimableMedia, createPost } =
  await import("@/lib/repo");
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

/**
 * La pulizia non è più immediata: pubblicare marca i media e solo un giorno
 * dopo lo scheduler li toglie dal disco. Il caso che ha motivato il ritardo:
 * un post Instagram+Facebook pubblicato portava via il file mentre il post
 * TikTok delle ore successive era ancora da creare, e quello falliva con
 * "TikTok richiede almeno un media".
 */
describe("pulizia differita di un giorno", () => {
  const inADay = () => new Date(Date.now() + 24 * 3600_000);

  it("marca i media invece di cancellarli subito", () => {
    const { postId, mediaId } = seed("published", `e-${Date.now()}.mp4`);
    expect(scheduleMediaReclaim(postId, inADay())).toBe(1);
    const row = getDb().prepare("SELECT reclaim_at FROM media WHERE id = ?").get(mediaId) as {
      reclaim_at: string | null;
    };
    expect(row.reclaim_at).not.toBeNull();
  });

  it("non li considera scaduti prima del giorno di attesa", () => {
    const { postId, mediaId } = seed("published", `f-${Date.now()}.mp4`);
    scheduleMediaReclaim(postId, inADay());
    expect(dueReclaimableMedia(new Date()).map((m) => m.id)).not.toContain(mediaId);
  });

  it("li considera scaduti passato il giorno di attesa", () => {
    const { postId, mediaId } = seed("published", `g-${Date.now()}.mp4`);
    scheduleMediaReclaim(postId, inADay());
    const dayAfter = new Date(Date.now() + 25 * 3600_000);
    expect(dueReclaimableMedia(dayAfter).map((m) => m.id)).toContain(mediaId);
  });

  it("salva il media se nel frattempo entra in un nuovo post (il caso TikTok)", () => {
    const { postId, mediaId } = seed("published", `h-${Date.now()}.mp4`);
    scheduleMediaReclaim(postId, inADay());
    // il post per l'altra piattaforma viene creato subito dopo la pubblicazione
    createPost(1, {
      title: "TikTok",
      body: "b",
      hashtags: "",
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      status: "scheduled",
      platforms: ["tiktok"],
      mediaIds: [mediaId],
    });
    const dayAfter = new Date(Date.now() + 25 * 3600_000);
    expect(dueReclaimableMedia(dayAfter).map((m) => m.id)).not.toContain(mediaId);
    // il riaggancio azzera anche la scadenza già scritta
    const row = getDb().prepare("SELECT reclaim_at FROM media WHERE id = ?").get(mediaId) as {
      reclaim_at: string | null;
    };
    expect(row.reclaim_at).toBeNull();
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

  it("accetta una foto su TikTok, ma non il PNG né il video WebM", () => {
    expect(
      mediaWarnings([{ originalName: "a.jpg", mime: "image/jpeg" }], [info(tiktokModule)], t)
    ).toHaveLength(0);
    expect(
      mediaWarnings([{ originalName: "a.png", mime: "image/png" }], [info(tiktokModule)], t)
    ).toHaveLength(1);
    expect(
      mediaWarnings([{ originalName: "a.webm", mime: "video/webm" }], [info(tiktokModule)], t)
    ).toHaveLength(1);
  });

  it("segnala due video su TikTok, che ne accetta uno solo", () => {
    const two = [
      { originalName: "a.mp4", mime: "video/mp4" },
      { originalName: "b.mp4", mime: "video/mp4" },
    ];
    expect(mediaWarnings(two, [info(tiktokModule)], t)).toEqual([
      "mediaPicker.warnTooManyVideos",
    ]);
  });

  it("segnala foto e video mescolati su TikTok", () => {
    const mixed = [
      { originalName: "a.jpg", mime: "image/jpeg" },
      { originalName: "b.mp4", mime: "video/mp4" },
    ];
    expect(mediaWarnings(mixed, [info(tiktokModule)], t)).toEqual(["mediaPicker.warnNoMix"]);
  });

  it("accetta un carosello di foto su TikTok fino a 35 immagini", () => {
    const photos = Array.from({ length: 35 }, (_, i) => ({
      originalName: `slide-${i}.jpg`,
      mime: "image/jpeg",
    }));
    expect(mediaWarnings(photos, [info(tiktokModule)], t)).toHaveLength(0);
    expect(
      mediaWarnings([...photos, { originalName: "x.jpg", mime: "image/jpeg" }], [info(tiktokModule)], t)
    ).toEqual(["mediaPicker.warnTooMany", "mediaPicker.warnTooManyImages"]);
  });
});
