/**
 * Test delle funzioni pure del publisher: composeText, backoff del retry e
 * calcolo dello stato complessivo del post.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  backoffMinutes,
  composeText,
  computePostStatus,
} from "@/social/publisher";
import type { Post, PostTarget } from "@/types";

function makePost(over: Partial<Post> = {}): Post {
  return {
    id: 1,
    userId: 1,
    title: "Titolo",
    body: "Corpo del post",
    hashtags: "#uno #due",
    status: "draft",
    scheduledAt: null,
    createdAt: "",
    updatedAt: "",
    targets: [],
    media: [],
    ...over,
  };
}

function makeTarget(over: Partial<PostTarget> = {}): PostTarget {
  return {
    id: 1,
    postId: 1,
    platform: "facebook",
    adaptedTitle: null,
    adaptedBody: null,
    postType: null,
    status: "pending",
    externalId: null,
    externalUrl: null,
    error: null,
    publishedAt: null,
    attempts: 0,
    nextRetryAt: null,
    ...over,
  };
}

describe("composeText", () => {
  it("usa il testo base con hashtag in coda", () => {
    const { title, body } = composeText(makePost(), makeTarget());
    expect(title).toBe("Titolo");
    expect(body).toBe("Corpo del post\n\n#uno #due");
  });

  it("preferisce il testo adattato dall'AI", () => {
    const { body } = composeText(makePost(), makeTarget({ adaptedBody: "Versione adattata" }));
    expect(body).toContain("Versione adattata");
    expect(body).toContain("#uno #due");
  });

  it("non duplica gli hashtag già presenti", () => {
    const { body } = composeText(
      makePost(),
      makeTarget({ adaptedBody: "Testo con #uno #due incluso" })
    );
    expect(body.match(/#uno/g)).toHaveLength(1);
  });

  it("senza hashtag non aggiunge righe vuote", () => {
    const { body } = composeText(makePost({ hashtags: "" }), makeTarget());
    expect(body).toBe("Corpo del post");
  });
});

describe("backoffMinutes (retry automatico)", () => {
  it("cresce col numero di tentativi e si ferma a 60 min", () => {
    expect(backoffMinutes(1)).toBe(1);
    expect(backoffMinutes(2)).toBe(5);
    expect(backoffMinutes(3)).toBe(15);
    expect(backoffMinutes(4)).toBe(60);
    expect(backoffMinutes(10)).toBe(60); // tetto
  });

  it("ha senso rispetto a MAX_ATTEMPTS", () => {
    expect(MAX_ATTEMPTS).toBeGreaterThan(1);
  });
});

describe("computePostStatus", () => {
  it("published solo se tutti i target sono pubblicati", () => {
    expect(computePostStatus(["published", "published"])).toBe("published");
  });
  it("partial se almeno uno pubblicato e almeno uno no", () => {
    expect(computePostStatus(["published", "failed"])).toBe("partial");
    expect(computePostStatus(["published", "pending"])).toBe("partial");
  });
  it("failed se nessuno è pubblicato", () => {
    expect(computePostStatus(["failed", "failed"])).toBe("failed");
    expect(computePostStatus(["pending", "publishing"])).toBe("failed");
  });
  it("draft se non ci sono target", () => {
    expect(computePostStatus([])).toBe("draft");
  });
});
