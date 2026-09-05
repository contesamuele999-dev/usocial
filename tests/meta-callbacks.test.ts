/**
 * Verifica del `signed_request` dei callback Meta.
 *
 * È il punto in cui l'app si fida di una richiesta che non arriva da un utente
 * loggato: se la firma non venisse controllata bene, chiunque conoscesse un id
 * Meta potrebbe scollegare l'account di qualcun altro.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const SECRET = "segreto-di-prova";
process.env.META_CLIENT_SECRET = SECRET;
process.env.THREADS_CLIENT_SECRET = "altro-segreto";
// Le rotte arrivano al database: lo si tiene in una cartella temporanea.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-meta-"));

type Mod = typeof import("@/social/meta-callbacks");
let mod: Mod;

beforeAll(async () => {
  mod = await import("@/social/meta-callbacks");
});

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Costruisce un signed_request come farebbe Meta. */
function sign(payload: object, secret = SECRET): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${sig}.${body}`;
}

describe("parseSignedRequest", () => {
  it("accetta una richiesta firmata con la chiave dell'app", () => {
    const parsed = mod.parseSignedRequest(
      sign({ user_id: "12345", algorithm: "HMAC-SHA256", issued_at: 1 })
    );
    expect(parsed?.user_id).toBe("12345");
  });

  it("accetta anche la chiave di Threads, che è diversa da quella di Meta", () => {
    const parsed = mod.parseSignedRequest(
      sign({ user_id: "999", algorithm: "HMAC-SHA256" }, "altro-segreto")
    );
    expect(parsed?.user_id).toBe("999");
  });

  it("rifiuta una firma fatta con un'altra chiave", () => {
    expect(mod.parseSignedRequest(sign({ user_id: "1" }, "chiave-sbagliata"))).toBeNull();
  });

  it("rifiuta un payload manomesso dopo la firma", () => {
    const valid = sign({ user_id: "1", algorithm: "HMAC-SHA256" });
    const [sig] = valid.split(".");
    const forged = b64url(Buffer.from(JSON.stringify({ user_id: "2", algorithm: "HMAC-SHA256" })));
    expect(mod.parseSignedRequest(`${sig}.${forged}`)).toBeNull();
  });

  it("rifiuta un algoritmo diverso da HMAC-SHA256", () => {
    // Firma valida, ma il payload dichiara un algoritmo che non usiamo: è una
    // richiesta costruita a mano, non un aggiornamento della piattaforma.
    expect(mod.parseSignedRequest(sign({ user_id: "1", algorithm: "none" }))).toBeNull();
  });

  it("rifiuta richieste malformate senza lanciare", () => {
    for (const raw of ["", ".", "abc", "a.b", "!!!.###"]) {
      expect(mod.parseSignedRequest(raw)).toBeNull();
    }
  });
});

describe("rotte dei callback", () => {
  /** POST come lo manda Meta: form-encoded con il solo `signed_request`. */
  const post = (signed: string) =>
    new Request("https://esempio.test/api/meta/deauthorize", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: signed }),
    });

  it("la disinstallazione risponde 200 anche a una richiesta non firmata", async () => {
    // Un 4xx qui farebbe comparire l'app come "non raggiungibile" nella
    // console Meta: si risponde 200 dicendo però che non si è fatto nulla.
    const { POST } = await import("@/app/api/meta/deauthorize/route");
    const res = await POST(post("firma.finta"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  it("la disinstallazione firmata arriva al database senza trovare nulla da scollegare", async () => {
    const { POST } = await import("@/app/api/meta/deauthorize/route");
    const res = await POST(post(sign({ user_id: "id-mai-visto", algorithm: "HMAC-SHA256" })));
    expect(await res.json()).toEqual({ ok: true, disconnected: 0 });
  });

  it("la cancellazione dati risponde nel formato preteso da Meta", async () => {
    const { POST } = await import("@/app/api/meta/data-deletion/route");
    const res = await POST(post(sign({ user_id: "id-mai-visto", algorithm: "HMAC-SHA256" })));
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(body.confirmation_code).toMatch(/^[0-9a-f]{16}$/);
    expect(body.url).toContain(`/data-deletion?code=${body.confirmation_code}`);
  });
});
