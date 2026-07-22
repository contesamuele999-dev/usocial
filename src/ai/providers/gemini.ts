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
    async complete(system, prompt, opts) {
      if (!config.apiKey) {
        throw new Error(
          "Chiave API Gemini mancante: creala su aistudio.google.com/apikey e " +
            "impostala in Impostazioni → Configurazione AI."
        );
      }
      const model = config.model || "gemini-2.5-flash";
      const base = config.baseUrl || "https://generativelanguage.googleapis.com";
      let res: Response;
      try {
        res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "x-goog-api-key": config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            ...(opts?.maxTokens
              ? { generationConfig: { maxOutputTokens: opts.maxTokens } }
              : {}),
          }),
        });
      } catch (e) {
        throw new Error(`Gemini non raggiungibile: ${e instanceof Error ? e.message : String(e)}`);
      }

      const raw = await res.text();
      let json: {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Gemini: risposta non valida (${res.status}) ${raw.slice(0, 200)}`);
      }

      if (!res.ok) throw new Error(`Gemini: ${json.error?.message || res.status}`);
      const text = (json.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("");
      if (!text.trim()) {
        throw new Error(
          "Gemini ha restituito una risposta vuota (possibile blocco dei filtri di sicurezza). " +
            "Riprova riformulando l'argomento."
        );
      }
      return text;
    },
  };
}
