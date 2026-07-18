/**
 * Hashing password: il verify deve accettare la password giusta e rifiutare
 * quella sbagliata; l'hash non deve mai contenere la password in chiaro.
 */
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("hashing password", () => {
  it("verifica correttamente la password giusta", () => {
    const stored = hashPassword("SuperSegreta123");
    expect(verifyPassword("SuperSegreta123", stored)).toBe(true);
  });

  it("rifiuta la password sbagliata", () => {
    const stored = hashPassword("SuperSegreta123");
    expect(verifyPassword("sbagliata", stored)).toBe(false);
  });

  it("produce hash diversi per la stessa password (salt casuale)", () => {
    expect(hashPassword("uguale")).not.toBe(hashPassword("uguale"));
  });

  it("non contiene la password in chiaro", () => {
    expect(hashPassword("plaintextpw")).not.toContain("plaintextpw");
  });

  it("gestisce hash malformati senza lanciare", () => {
    expect(verifyPassword("x", "non-valido")).toBe(false);
  });
});
