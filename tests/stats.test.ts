/**
 * Aggregazione e consigli della pagina Statistiche.
 * Tutto ciò che viene provato qui è puro: nessun DB, nessuna rete.
 */
import { describe, expect, it } from "vitest";
import { buildTips, countHashtags, engagementOf, windowStart, type PlatformStats } from "@/lib/stats";
import type { MetricRow } from "@/lib/repo";

/** Riga di metriche con valori sensati; si sovrascrive solo ciò che conta al test. */
function row(over: Partial<MetricRow> = {}): MetricRow {
  return {
    targetId: 1,
    postId: 1,
    platform: "instagram",
    title: "",
    body: "",
    hashtags: "",
    postType: null,
    externalUrl: null,
    publishedAt: "2026-09-08T10:00:00.000Z",
    mediaCount: 1,
    hasVideo: false,
    views: 100,
    reach: null,
    likes: 5,
    comments: 1,
    shares: 0,
    saves: 0,
    clicks: null,
    followers: null,
    error: null,
    unavailable: false,
    fetchedAt: "2026-09-09T00:00:00.000Z",
    ...over,
  };
}

function platform(over: Partial<PlatformStats> = {}): PlatformStats {
  return {
    platform: "instagram",
    displayName: "Instagram",
    color: "#E1306C",
    connected: true,
    missing: 0,
    error: null,
    unavailable: false,
    posts: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagement: 0,
    engagementRate: null,
    ...over,
  };
}

const ids = (tips: { id: string }[]) => tips.map((t) => t.id);

describe("engagementOf", () => {
  it("somma le interazioni trattando i valori mancanti come zero", () => {
    expect(engagementOf({ likes: 3, comments: 2, shares: null, saves: 1 })).toBe(6);
    expect(engagementOf({ likes: null, comments: null, shares: null, saves: null })).toBe(0);
  });
});

describe("countHashtags", () => {
  it("conta gli hashtag nel testo e nel campo dedicato", () => {
    expect(countHashtags(row({ body: "ciao #uno #due", hashtags: "#tre #quattro" }))).toBe(4);
  });

  it("conta anche gli hashtag scritti senza cancelletto nel campo dedicato", () => {
    expect(countHashtags(row({ hashtags: "marketing, social" }))).toBe(2);
  });

  it("gestisce accenti ed emoji senza contarli come hashtag", () => {
    expect(countHashtags(row({ body: "però #città 🎬" }))).toBe(1);
  });
});

describe("windowStart", () => {
  it("torna indietro del numero di giorni chiesto", () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    expect(windowStart(7, now)).toBe("2026-09-23T12:00:00.000Z");
  });
});

describe("buildTips", () => {
  it("con pochi dati chiede solo di pubblicare di più, senza inventare consigli", () => {
    const tips = buildTips([row(), row(), row()], []);
    expect(ids(tips)).toEqual(["needMoreData"]);
  });

  it("non considera i post di cui non si sono lette le metriche", () => {
    const blank = { views: null, likes: null, comments: null, shares: null, saves: null };
    const rows = Array.from({ length: 8 }, () => row(blank));
    expect(ids(buildTips(rows, []))).toEqual(["needMoreData"]);
  });

  it("riconosce il giorno della settimana che rende di più", () => {
    // Lunedì (indice 0) molto sopra la media, gli altri giorni piatti.
    const mondays = ["2026-09-07", "2026-09-14", "2026-09-21"].map((d) =>
      row({ publishedAt: `${d}T10:00:00.000Z`, likes: 100, comments: 20 })
    );
    const others = ["2026-09-09", "2026-09-16", "2026-09-23"].map((d) =>
      row({ publishedAt: `${d}T10:00:00.000Z`, likes: 1, comments: 0 })
    );
    const tips = buildTips([...mondays, ...others], []);
    const best = tips.find((t) => t.id === "bestDay");
    expect(best?.vars.day).toBe(0);
    expect(Number(best?.vars.avg)).toBeGreaterThan(Number(best?.vars.overall));
  });

  it("segnala il formato che funziona meglio", () => {
    const videos = Array.from({ length: 3 }, (_, i) =>
      row({ targetId: i, hasVideo: true, likes: 80, comments: 20 })
    );
    const photos = Array.from({ length: 3 }, (_, i) =>
      row({ targetId: 10 + i, hasVideo: false, likes: 2, comments: 0 })
    );
    const best = buildTips([...videos, ...photos], []).find((t) => t.id === "bestFormat");
    expect(best?.vars.format).toBe("video");
  });

  it("mette a confronto le piattaforme solo quando ce ne sono almeno due misurate", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row({ targetId: i }));
    const one = buildTips(rows, [platform({ posts: 5, engagementRate: 4 })]);
    expect(ids(one)).not.toContain("bestPlatform");

    const two = buildTips(rows, [
      platform({ posts: 5, engagementRate: 8 }),
      platform({ platform: "tiktok", displayName: "TikTok", posts: 5, engagementRate: 1 }),
    ]);
    expect(ids(two)).toContain("bestPlatform");
    // Rendimento meno della metà del migliore: va detto.
    expect(ids(two)).toContain("weakPlatform");
  });

  it("segnala i post rimasti senza nessuna interazione", () => {
    const dead = Array.from({ length: 4 }, (_, i) =>
      row({ targetId: i, likes: 0, comments: 0, shares: 0, saves: 0 })
    );
    const alive = Array.from({ length: 4 }, (_, i) => row({ targetId: 10 + i, likes: 9 }));
    const tip = buildTips([...dead, ...alive], []).find((t) => t.id === "zeroEngagement");
    expect(tip?.vars).toMatchObject({ count: 4, total: 8 });
  });

  it("segnala una pausa lunga fra due pubblicazioni", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => row({ targetId: i })),
      row({ targetId: 99, publishedAt: "2026-09-30T10:00:00.000Z" }),
    ];
    const tip = buildTips(rows, []).find((t) => t.id === "consistency");
    expect(Number(tip?.vars.days)).toBeGreaterThanOrEqual(7);
  });

  it("distingue «nessun risultato» da «permessi mancanti»", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row({ targetId: i }));
    const broken = platform({
      platform: "tiktok",
      displayName: "TikTok",
      posts: 3,
      missing: 3,
      error: "video.list mancante",
      unavailable: false,
    });
    expect(ids(buildTips(rows, [broken]))).toContain("noMetrics");
    // Stessa piattaforma senza errori: nessun allarme.
    expect(ids(buildTips(rows, [platform({ posts: 3, missing: 0 })]))).not.toContain("noMetrics");
  });

  it("non consiglia di ricollegare una piattaforma che le statistiche non le espone", () => {
    // LinkedIn su profilo personale: la connessione è a posto, è l'API a non
    // dare i numeri. Dire "ricollega l'account" manderebbe a sbattere.
    const rows = Array.from({ length: 6 }, (_, i) => row({ targetId: i }));
    const linkedin = platform({
      platform: "linkedin",
      displayName: "LinkedIn",
      posts: 3,
      missing: 3,
      error: "LinkedIn non espone le statistiche dei post di un profilo personale",
      unavailable: true,
    });
    const tips = buildTips(rows, [linkedin]);
    expect(ids(tips)).toContain("noMetricsUnsupported");
    expect(ids(tips)).not.toContain("noMetrics");
    expect(tips.find((t) => t.id === "noMetricsUnsupported")?.level).toBe("info");
  });
});
