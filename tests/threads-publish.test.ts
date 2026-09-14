/**
 * Pubblicazione Threads: "The requested resource does not exist (24)".
 *
 * Arrivava da `threads_publish` chiamato su un container non ancora pronto:
 * si aspettava l'elaborazione solo sui video, mentre anche una foto viene
 * scaricata ed elaborata. Qui si simula la Threads API con un fetch finto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNotFoundYet, threadsModule } from "@/social/threads";
import type { Account } from "@/types";

const account: Account = {
  userId: 1,
  platform: "threads",
  accountName: "@prova",
  accountId: "u1",
  accessToken: "tok",
  refreshToken: null,
  expiresAt: null,
  scopes: "",
  connectedAt: "",
  meta: JSON.stringify({ threadsUserId: "u1" }),
};

const photo = {
  path: "/tmp/a.jpg",
  mime: "image/jpeg",
  size: 1000,
  url: "https://example.com/files/a.jpg",
  kind: "image" as const,
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const notFound = () =>
  new Response(
    JSON.stringify({ error: { message: "The requested resource does not exist", code: 24 } }),
    { status: 400 }
  );

/** Registra le chiamate e risponde secondo lo scenario. */
function fakeThreads(opts: { statuses: string[]; publishNotFound: number }) {
  const calls: string[] = [];
  let statusCalls = 0;
  let publishCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/threads")) {
        calls.push("create");
        return ok({ id: "c1" });
      }
      if (u.pathname.endsWith("/threads_publish")) {
        calls.push("publish");
        return publishCalls++ < opts.publishNotFound ? notFound() : ok({ id: "p1" });
      }
      if (u.searchParams.get("fields")?.startsWith("status")) {
        calls.push("status");
        const s = opts.statuses[Math.min(statusCalls++, opts.statuses.length - 1)];
        return ok({ status: s });
      }
      calls.push("permalink");
      return ok({ permalink: "https://threads.net/p1" });
    })
  );
  return calls;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Fa scorrere i timer finché la promessa non si chiude. */
async function run<T>(p: Promise<T>): Promise<T> {
  let done = false;
  p.finally(() => (done = true)).catch(() => {});
  while (!done) await vi.advanceTimersByTimeAsync(1000);
  return p;
}

describe("pubblicazione Threads", () => {
  it("aspetta che il container di una FOTO sia pronto prima di pubblicare", async () => {
    const calls = fakeThreads({ statuses: ["IN_PROGRESS", "IN_PROGRESS", "FINISHED"], publishNotFound: 0 });
    const res = await run(
      threadsModule.publish({ title: "", body: "ciao", media: [photo] }, account)
    );
    expect(res.externalId).toBe("p1");
    expect(calls.slice(0, 5)).toEqual(["create", "status", "status", "status", "publish"]);
  });

  it("aspetta anche il container di un post di solo testo", async () => {
    const calls = fakeThreads({ statuses: ["FINISHED"], publishNotFound: 0 });
    await run(threadsModule.publish({ title: "", body: "solo testo", media: [] }, account));
    expect(calls.indexOf("status")).toBeLessThan(calls.indexOf("publish"));
  });

  it("riprova threads_publish quando Threads risponde 24", async () => {
    const calls = fakeThreads({ statuses: ["FINISHED"], publishNotFound: 2 });
    const res = await run(
      threadsModule.publish({ title: "", body: "ciao", media: [photo] }, account)
    );
    expect(res.externalId).toBe("p1");
    expect(calls.filter((c) => c === "publish")).toHaveLength(3);
  });

  it("si arrende dopo i tentativi e riporta l'errore originale", async () => {
    fakeThreads({ statuses: ["FINISHED"], publishNotFound: 99 });
    await expect(
      run(threadsModule.publish({ title: "", body: "ciao", media: [photo] }, account))
    ).rejects.toThrow("(24)");
  });

  it("riconosce solo il codice 24", () => {
    expect(isNotFoundYet(new Error("HTTP 400: The requested resource does not exist (24)"))).toBe(true);
    expect(isNotFoundYet(new Error("HTTP 400: Invalid parameter (100)"))).toBe(false);
    expect(isNotFoundYet(new Error("HTTP 400: qualcosa (240)"))).toBe(false);
  });
});
