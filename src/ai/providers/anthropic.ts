/**
 * Provider Anthropic (Claude) via API Messages.
 * Nessun SDK: una semplice fetch per tenere le dipendenze al minimo.
 */
import type { AiConfig, AiProvider } from "../types";

export function anthropicProvider(config: AiConfig): AiProvider {
  return {
    name: "anthropic",
    async complete(system, prompt, opts) {
      if (!config.apiKey) {
        throw new Error(
          "Chiave API Anthropic mancante: impostala in Impostazioni → Configurazione AI."
        );
      }
      let res: Response;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: config.model || "claude-sonnet-5",
            max_tokens: opts?.maxTokens ?? 2048,
            system,
            messages: [{ role: "user", content: prompt }],
          }),
        });
      } catch (e) {
        // rete assente / DNS bloccato sulla VM
        throw new Error(
          `Anthropic non raggiungibile: ${e instanceof Error ? e.message : String(e)}`
        );
      }

      const raw = await res.text();
      let json: {
        content?: { type: string; text?: string }[];
        error?: { message?: string };
        stop_reason?: string;
      };
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Anthropic: risposta non valida (${res.status}) ${raw.slice(0, 200)}`);
      }

      if (!res.ok) throw new Error(`Anthropic: ${json.error?.message || res.status}`);

      const text = (json.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new Error("Anthropic ha restituito una risposta vuota.");
      return text;
    },
  };
}
