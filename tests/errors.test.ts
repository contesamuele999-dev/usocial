/**
 * `fetch failed` di Node nasconde la causa vera in `cause`: se non la
 * srotoliamo, gli esiti di pubblicazione non dicono nulla di utile.
 */
import { describe, expect, it } from "vitest";
import { AppError, errorMessage, withErrorHandling } from "@/lib/errors";

describe("errorMessage", () => {
  it("srotola la causa di un fetch fallito", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND open.tiktokapis.com"), {
      code: "ENOTFOUND",
      syscall: "getaddrinfo",
      hostname: "open.tiktokapis.com",
    });
    const msg = errorMessage(new TypeError("fetch failed", { cause }));
    expect(msg).toContain("fetch failed");
    expect(msg).toContain("ENOTFOUND");
    expect(msg).toContain("open.tiktokapis.com");
  });

  it("mostra il codice undici di un timeout", () => {
    const cause = Object.assign(new Error("Headers Timeout Error"), {
      code: "UND_ERR_HEADERS_TIMEOUT",
    });
    expect(errorMessage(new TypeError("fetch failed", { cause }))).toContain("UND_ERR_HEADERS_TIMEOUT");
  });

  it("tiene i messaggi già chiari come sono", () => {
    expect(errorMessage(new Error("Facebook: (#200) permesso mancante"))).toBe(
      "Facebook: (#200) permesso mancante"
    );
  });

  it("non va in loop su cause circolari", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as Error).cause = b;
    expect(errorMessage(b)).toBe("b ← a");
  });

  it("accetta anche valori non Error", () => {
    expect(errorMessage("boom")).toBe("boom");
  });
});

describe("sessione scaduta", () => {
  it("il 401 cancella il cookie di sessione", async () => {
    // Senza questa cancellazione si innesca un giro infinito: il client manda
    // a /login, il middleware vede il cookie e rimanda alla dashboard, che
    // richiama le API, che rispondono di nuovo 401.
    const handler = withErrorHandling("test", async () => {
      throw new AppError("Autenticazione richiesta", 401);
    });
    const res = await handler(new Request("https://esempio.test/api/x"), {});
    expect(res.status).toBe(401);
    const cookie = res.headers.get("set-cookie") || "";
    expect(cookie).toContain("usocial_session=");
    expect(cookie).toMatch(/Max-Age=0/i);
  });

  it("gli altri errori non toccano il cookie", async () => {
    const handler = withErrorHandling("test", async () => {
      throw new AppError("Dati non validi", 400);
    });
    const res = await handler(new Request("https://esempio.test/api/x"), {});
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
