/**
 * Il registro dei moduli social deve coprire tutte le piattaforme dichiarate
 * e ogni modulo deve rispettare il contratto di base.
 */
import { describe, expect, it } from "vitest";
import { PLATFORMS } from "@/types";
import { allModules, getModule, platformInfo } from "@/social/registry";

describe("registry social", () => {
  it("ha un modulo per ogni piattaforma", () => {
    for (const p of PLATFORMS) {
      const mod = getModule(p);
      expect(mod.platform).toBe(p);
      expect(mod.displayName.length).toBeGreaterThan(0);
      expect(typeof mod.publish).toBe("function");
      expect(typeof mod.verifyToken).toBe("function");
      expect(typeof mod.fetchAccount).toBe("function");
    }
    expect(allModules()).toHaveLength(PLATFORMS.length);
  });

  it("dichiara limiti sensati", () => {
    for (const mod of allModules()) {
      expect(mod.limits.maxChars).toBeGreaterThan(100);
      expect(mod.limits.maxMedia).toBeGreaterThanOrEqual(1);
      expect(mod.limits.mediaTypes.length).toBeGreaterThan(0);
    }
  });

  it("dichiara una configurazione OAuth completa", () => {
    for (const mod of allModules()) {
      expect(mod.oauth.authorizeUrl).toMatch(/^https:\/\//);
      expect(mod.oauth.tokenUrl).toMatch(/^https:\/\//);
      expect(mod.oauth.scopes.length).toBeGreaterThan(0);
    }
  });

  it("platformInfo non espone funzioni server", () => {
    for (const info of platformInfo()) {
      expect(Object.keys(info).sort()).toEqual([
        "color",
        "comments",
        "displayName",
        "limits",
        "platform",
      ]);
      // Il punto del controllo non è l'elenco delle chiavi ma che non passi
      // niente di eseguibile al browser: `publish`, `insights` e compagnia
      // parlano con le API social usando i token.
      expect(JSON.parse(JSON.stringify(info))).toEqual(info);
    }
  });
});

describe("scope che dipendono da un prodotto opzionale", () => {
  it("non chiede i permessi sui messaggi se non sono stati abilitati", () => {
    // `pages_messaging` e `instagram_manage_messages` non esistono finché
    // l'app Meta non ha il prodotto Messenger: chiederli comunque fa
    // rispondere a Facebook "Invalid Scopes" a ogni schermata di consenso.
    for (const platform of ["facebook", "instagram"] as const) {
      const scopes = getModule(platform).oauth.scopes;
      expect(scopes.join(",")).not.toContain("messaging");
      expect(scopes.join(",")).not.toContain("manage_messages");
    }
  });

  it("chi non sa mandare messaggi privati lo dichiara", () => {
    // La UI del risponditore usa questo flag per non promettere un DM che poi
    // fallirebbe a ogni commento.
    expect(getModule("threads").comments?.privateReply).toBe(false);
    expect(getModule("youtube").comments?.privateReply).toBe(false);
    // TikTok e LinkedIn non gestiscono affatto i commenti.
    expect(getModule("tiktok").comments).toBeUndefined();
    expect(getModule("linkedin").comments).toBeUndefined();
  });
});
