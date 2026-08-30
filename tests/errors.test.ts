/**
 * `fetch failed` di Node nasconde la causa vera in `cause`: se non la
 * srotoliamo, gli esiti di pubblicazione non dicono nulla di utile.
 */
import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/errors";

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
