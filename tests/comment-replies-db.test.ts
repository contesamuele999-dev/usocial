/**
 * Registro dei commenti: un "skipped" si può sovrascrivere (invio scelto a
 * mano dall'anteprima), un "replied" mai — sarebbe un secondo DM alla stessa
 * persona.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, expect, it } from "vitest";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-replies-"));

let repo: typeof import("@/lib/repo");

beforeAll(async () => {
  repo = await import("@/lib/repo");
});

const row = (status: "skipped" | "replied") => ({
  userId: 1,
  platform: "instagram" as const,
  commentId: "c1",
  ruleId: status === "replied" ? 7 : null,
  targetId: null,
  postId: null,
  author: "mario",
  text: "GUIDE",
  status,
});

it("sovrascrive solo gli skipped", () => {
  expect(repo.recordCommentReply(row("skipped"))).toBe(true);
  expect(repo.seenCommentIds(1, "instagram").has("c1")).toBe(true);
  expect(repo.seenCommentIds(1, "instagram", false).has("c1")).toBe(false);

  expect(repo.recordCommentReply(row("replied"))).toBe(true);
  expect(repo.seenCommentIds(1, "instagram", false).has("c1")).toBe(true);

  expect(repo.recordCommentReply(row("skipped"))).toBe(false);
  expect(repo.recordCommentReply(row("replied"))).toBe(false);
  expect(repo.listCommentReplies(1)[0]).toMatchObject({ status: "replied", ruleId: 7 });
});
