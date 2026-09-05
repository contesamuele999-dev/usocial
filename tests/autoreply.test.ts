/**
 * Risponditore automatico: riconoscimento della parola chiave, scelta della
 * regola e finestra del messaggio privato.
 *
 * Sono le decisioni che portano a scrivere a una persona vera: un falso
 * positivo qui è un DM mandato a chi non l'ha chiesto.
 */
import { describe, expect, it } from "vitest";
import {
  fillTemplate,
  matches,
  ruleFor,
  withinPrivateWindow,
} from "@/lib/autoreply";
import type { AutoReplyRule } from "@/lib/repo";
import type { SocialComment } from "@/social/types";
import type { Platform } from "@/types";

function comment(over: Partial<SocialComment> = {}): SocialComment {
  return {
    id: "c1",
    text: "PAUSA",
    author: "mario",
    authorId: "u1",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function rule(over: Partial<AutoReplyRule> = {}): AutoReplyRule {
  return {
    id: 1,
    userId: 1,
    name: "Guida",
    keyword: "PAUSA",
    matchMode: "word",
    platforms: [],
    publicReply: "Controlla i messaggi 📩",
    privateReply: "Ecco la guida",
    enabled: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("matches", () => {
  it("riconosce la parola chiave senza badare alle maiuscole", () => {
    expect(matches("pausa", "PAUSA", "word")).toBe(true);
    expect(matches("Voglio la PAUSA grazie", "pausa", "word")).toBe(true);
  });

  it("in modalità parola intera non scatta dentro un'altra parola", () => {
    // È il caso che fa la differenza: "pausapranzo" non è una richiesta.
    expect(matches("pausapranzo", "PAUSA", "word")).toBe(false);
    expect(matches("ripausa", "PAUSA", "word")).toBe(false);
    expect(matches("pausapranzo", "PAUSA", "contains")).toBe(true);
  });

  it("tratta punteggiatura ed emoji come confini di parola", () => {
    expect(matches("PAUSA!", "PAUSA", "word")).toBe(true);
    expect(matches("«pausa»", "PAUSA", "word")).toBe(true);
    expect(matches("pausa 🙏", "PAUSA", "word")).toBe(true);
    expect(matches("ciao, pausa, grazie", "PAUSA", "word")).toBe(true);
  });

  it("trova la parola anche dopo un falso aggancio nella stessa frase", () => {
    // "pausapranzo" viene prima: se ci si fermasse alla prima occorrenza,
    // la richiesta vera che segue andrebbe persa.
    expect(matches("dopo il pausapranzo scrivo PAUSA", "PAUSA", "word")).toBe(true);
  });

  it("gestisce parole chiave accentate", () => {
    expect(matches("perché sì", "PERCHÉ", "word")).toBe(true);
    expect(matches("perchédavvero", "PERCHÉ", "word")).toBe(false);
  });

  it("non scatta su una chiave vuota", () => {
    expect(matches("qualsiasi cosa", "", "word")).toBe(false);
    expect(matches("qualsiasi cosa", "   ", "contains")).toBe(false);
  });
});

describe("ruleFor", () => {
  const ig: Platform = "instagram";

  it("ignora le regole spente", () => {
    expect(ruleFor(comment(), [rule({ enabled: false })], ig)).toBeNull();
  });

  it("ignora le regole di un'altra piattaforma", () => {
    expect(ruleFor(comment(), [rule({ platforms: ["youtube"] })], ig)).toBeNull();
    expect(ruleFor(comment(), [rule({ platforms: ["instagram"] })], ig)).not.toBeNull();
    // Elenco vuoto = vale ovunque.
    expect(ruleFor(comment(), [rule({ platforms: [] })], ig)).not.toBeNull();
  });

  it("restituisce la prima regola che combacia", () => {
    const found = ruleFor(
      comment({ text: "GUIDA per favore" }),
      [rule({ id: 1, keyword: "PAUSA" }), rule({ id: 2, keyword: "GUIDA" })],
      ig
    );
    expect(found?.id).toBe(2);
  });
});

describe("withinPrivateWindow", () => {
  const now = new Date("2026-09-10T12:00:00.000Z").getTime();

  it("accetta un commento dentro i 7 giorni", () => {
    const c = comment({ createdAt: "2026-09-08T12:00:00.000Z" });
    expect(withinPrivateWindow(c, 24 * 7, now)).toBe(true);
  });

  it("rifiuta un commento più vecchio della finestra", () => {
    // Meta non accetta più il messaggio privato: meglio saltarlo che
    // collezionare errori e bruciare l'unico tentativo per quel commento.
    const c = comment({ createdAt: "2026-08-20T12:00:00.000Z" });
    expect(withinPrivateWindow(c, 24 * 7, now)).toBe(false);
  });

  it("senza finestra dichiarata non pone limiti", () => {
    expect(withinPrivateWindow(comment({ createdAt: "2020-01-01T00:00:00.000Z" }), undefined, now)).toBe(
      true
    );
  });

  it("con una data illeggibile non blocca l'invio", () => {
    expect(withinPrivateWindow(comment({ createdAt: "boh" }), 24 * 7, now)).toBe(true);
  });
});

describe("fillTemplate", () => {
  it("sostituisce il segnaposto con la menzione dell'autore", () => {
    expect(fillTemplate("Ciao {autore}, eccola!", comment({ author: "mario" }))).toBe(
      "Ciao @mario, eccola!"
    );
    expect(fillTemplate("Hi {author}!", comment({ author: "mario" }))).toBe("Hi @mario!");
  });

  it("senza autore non lascia una chiocciola orfana", () => {
    expect(fillTemplate("Ciao {autore}", comment({ author: "" }))).toBe("Ciao ");
  });
});
