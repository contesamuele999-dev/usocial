/**
 * Due brand, un solo profilo Facebook: il secondo account uSocial non deve
 * prendersi la Pagina del primo, e se il consenso la toglie va detto.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, expect, it } from "vitest";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "usocial-pages-"));

let pickPage: typeof import("@/social/meta-pages").pickPage;

beforeAll(async () => {
  const { getDb } = await import("@/lib/db");
  getDb().exec(
    "INSERT INTO users (id, email, password_hash) VALUES (1, 'a@x.it', 'x'), (2, 'b@x.it', 'x')"
  );
  const { saveAccount } = await import("@/lib/repo");
  saveAccount({
    userId: 1,
    platform: "facebook",
    accountName: "Samuele → uMaster",
    accountId: "fb-person",
    accessToken: "t",
    refreshToken: null,
    expiresAt: null,
    scopes: "",
    connectedAt: new Date().toISOString(),
    meta: JSON.stringify({ pageId: "p-umaster", pageName: "uMaster" }),
  });
  ({ pickPage } = await import("@/social/meta-pages"));
});

const umaster = { id: "p-umaster", name: "uMaster" };
const shui = { id: "p-shui", name: "Shui Taiji" };

it("salta la Pagina già usata dall'altro account", () => {
  expect(pickPage([umaster, shui], "facebook", 2, "fb-person")).toEqual({ page: shui, lost: [] });
});

it("avvisa se il consenso ha tolto la Pagina dell'altro brand", () => {
  expect(pickPage([shui], "facebook", 2, "fb-person")).toEqual({ page: shui, lost: ["uMaster"] });
});

it("non avvisa per Pagine di un'altra persona Facebook", () => {
  expect(pickPage([shui], "facebook", 2, "other-person").lost).toEqual([]);
});

it("ricollegando il primo brand ritrova la sua Pagina", () => {
  expect(pickPage([umaster, shui], "facebook", 1, "fb-person").page).toEqual(umaster);
});
