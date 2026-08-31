/**
 * Post foto TikTok (immagine singola e carosello).
 *
 * Il corpo dell'init è l'unico punto in cui si decide tutto: endpoint condiviso
 * con il video, ma `media_type`, `post_mode` e `source` diversi. Un campo
 * sbagliato non dà un errore leggibile, quindi è coperto qui.
 */
import { describe, expect, it } from "vitest";
import { photoInitBody } from "@/social/tiktok";
import type { PublishInput } from "@/social/types";

const input = (over: Partial<PublishInput> = {}): PublishInput => ({
  title: "Titolo",
  body: "Corpo del post",
  media: [],
  ...over,
});

const urls = ["https://app.example/1.jpg", "https://app.example/2.jpg"];

describe("init di un post foto TikTok", () => {
  it("manda le foto come URL, non come upload di file", () => {
    const body = photoInitBody(input({ options: { privacyLevel: "PUBLIC_TO_EVERYONE" } }), urls, false);
    expect(body.media_type).toBe("PHOTO");
    expect(body.post_mode).toBe("DIRECT_POST");
    expect(body.source_info).toMatchObject({
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: urls,
    });
  });

  it("porta privacy e interazioni scelte dall'utente sul Direct Post", () => {
    const body = photoInitBody(
      input({ options: { privacyLevel: "FOLLOWER_OF_CREATOR", disableComment: true, brandOrganic: true } }),
      urls,
      false
    );
    expect(body.post_info).toMatchObject({
      privacy_level: "FOLLOWER_OF_CREATOR",
      disable_comment: true,
      brand_organic_toggle: true,
      brand_content_toggle: false,
    });
    // Duetto e stitch non esistono sulle foto: non vanno inviati.
    expect(body.post_info).not.toHaveProperty("disable_duet");
    expect(body.post_info).not.toHaveProperty("disable_stitch");
  });

  it("rifiuta il Direct Post senza privacy scelta", () => {
    expect(() => photoInitBody(input(), urls, false)).toThrow(/privacy|vedere/i);
  });

  it("la bozza non chiede privacy: la sceglie l'utente nell'app TikTok", () => {
    const body = photoInitBody(input(), urls, true);
    expect(body.post_mode).toBe("MEDIA_UPLOAD");
    expect(body.post_info).toEqual({ title: "Titolo", description: "Corpo del post" });
  });

  it("usa il corpo come titolo quando il titolo manca, tagliato a 90 caratteri", () => {
    const long = "x".repeat(200);
    const body = photoInitBody(input({ title: "", body: long }), urls, true) as {
      post_info: { title: string; description: string };
    };
    expect(body.post_info.title).toHaveLength(90);
    expect(body.post_info.description).toBe(long);
  });

  it("rifiuta zero foto e più di 35", () => {
    expect(() => photoInitBody(input(), [], true)).toThrow();
    const many = Array.from({ length: 36 }, (_, i) => `https://app.example/${i}.jpg`);
    expect(() => photoInitBody(input(), many, true)).toThrow(/35/);
  });
});
