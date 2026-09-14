/**
 * Statistiche di un post che Meta non trova più (eliminato, o di un altro
 * account): prima finivano fra i "permessi mancanti" e la pagina consigliava di
 * ricollegare l'account, cosa che non riporta i numeri.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsightsUnavailableError, isMetaPostGone } from "@/social/types";
import { threadsModule } from "@/social/threads";
import type { Account } from "@/types";

const GONE =
  "HTTP 400: Unsupported get request. Object with ID '18498373069097133' does not exist, cannot be loaded due to missing permissions, or does not support this operation (100)";

afterEach(() => vi.unstubAllGlobals());

describe("post non più raggiungibile", () => {
  it("riconosce il messaggio di Meta, con o senza il rimando alla documentazione", () => {
    expect(isMetaPostGone(new Error(GONE))).toBe(true);
    expect(
      isMetaPostGone(
        new Error(
          "HTTP 400: Unsupported get request. Object with ID '1074975138764183' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api (100)"
        )
      )
    ).toBe(true);
  });

  it("non confonde un permesso mancante o un altro errore", () => {
    expect(isMetaPostGone(new Error("HTTP 403: (#10) Application does not have permission (10)"))).toBe(false);
    expect(isMetaPostGone(new Error("HTTP 400: (#100) Tried accessing nonexisting field (shares) (100)"))).toBe(false);
  });

  it("Threads lo segnala come statistica non disponibile, non come errore di permessi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "Unsupported get request. Object with ID '18498373069097133' does not exist, cannot be loaded due to missing permissions, or does not support this operation",
              code: 100,
            },
          }),
          { status: 400 }
        )
      )
    );
    const account = { accessToken: "tok", accountId: "u1", meta: "{}" } as Account;
    await expect(threadsModule.insights!(account, "18498373069097133")).rejects.toBeInstanceOf(
      InsightsUnavailableError
    );
  });
});
