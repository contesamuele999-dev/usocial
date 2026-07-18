/**
 * Il provider mock deve rispondere in modo deterministico per ogni azione.
 */
import { describe, expect, it } from "vitest";
import { mockProvider } from "@/ai/providers/mock";
import { getAiProvider } from "@/ai";

const TEXT = "Oggi parliamo di produttività. Ecco tre consigli pratici per studiare meglio ogni giorno!";

describe("provider AI mock", () => {
  const provider = mockProvider();

  it("genera 5 titoli", async () => {
    const out = await provider.complete("[titles]", `TESTO: ${TEXT}`);
    expect(out.split("\n")).toHaveLength(5);
  });

  it("genera hashtag", async () => {
    const out = await provider.complete("[hashtags]", `TESTO: ${TEXT}`);
    expect(out).toMatch(/#\w+/);
  });

  it("accorcia il testo", async () => {
    const out = await provider.complete("[short]", `TESTO: ${TEXT}`);
    expect(out.length).toBeLessThanOrEqual(TEXT.length);
  });

  it("genera una CTA", async () => {
    const out = await provider.complete("[cta]", `TESTO: ${TEXT}`);
    expect(out.length).toBeGreaterThan(10);
  });
});

describe("factory provider AI", () => {
  const base = { model: "", apiKey: "", baseUrl: "" };
  it("mappa ogni provider al modulo giusto", () => {
    expect(getAiProvider({ ...base, provider: "gemini" }).name).toBe("gemini");
    expect(getAiProvider({ ...base, provider: "anthropic" }).name).toBe("anthropic");
    expect(getAiProvider({ ...base, provider: "openai" }).name).toBe("openai");
    expect(getAiProvider({ ...base, provider: "ollama" }).name).toBe("ollama");
    expect(getAiProvider({ ...base, provider: "mock" }).name).toBe("mock");
  });

  it("usa il mock per provider sconosciuti (fallback sicuro)", () => {
    expect(getAiProvider({ ...base, provider: "inesistente" }).name).toBe("mock");
  });
});
