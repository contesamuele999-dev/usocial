/**
 * Provider OpenAI (Chat Completions).
 */
import type { AiConfig, AiProvider } from "../types";

export function openaiProvider(config: AiConfig): AiProvider {
  return {
    name: "openai",
    async complete(system, prompt, opts) {
      if (!config.apiKey) {
        throw new Error(
          "Chiave API OpenAI mancante: impostala in Impostazioni → Configurazione AI."
        );
      }
      const base = config.baseUrl || "https://api.openai.com/v1";
      let res: Response;
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model || "gpt-4o-mini",
            ...(opts?.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
        });
      } catch (e) {
        throw new Error(`OpenAI non raggiungibile: ${e instanceof Error ? e.message : String(e)}`);
      }

      const raw = await res.text();
      let json: {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`OpenAI: risposta non valida (${res.status}) ${raw.slice(0, 200)}`);
      }

      if (!res.ok) throw new Error(`OpenAI: ${json.error?.message || res.status}`);
      const text = json.choices?.[0]?.message?.content || "";
      if (!text.trim()) throw new Error("OpenAI ha restituito una risposta vuota.");
      return text;
    },
  };
}
