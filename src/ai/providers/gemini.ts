/**
 * Provider Google Gemini (Generative Language API).
 * `gemini-2.5-flash` è utilizzabile GRATIS con il piano gratuito di Google AI
 * Studio: crea una chiave su https://aistudio.google.com/apikey e incollala nella
 * configurazione AI. Nessun SDK: una semplice fetch.
 */
import type { AiConfig, AiProvider } from "../types";

export function geminiProvider(config: AiConfig): AiProvider {
  return {
    name: "gemini",
    async complete(system, prompt) {
      const model = config.model || "gemini-2.5-flash";
      const base = config.baseUrl || "https://generativelanguage.googleapis.com";
      const res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "x-goog-api-key": config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      });
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(`Gemini: ${json.error?.message || res.status}`);
      return (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    },
  };
}
