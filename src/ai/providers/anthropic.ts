/**
 * Provider Anthropic (Claude) via API Messages.
 * Nessun SDK: una semplice fetch per tenere le dipendenze al minimo.
 */
import type { AiConfig, AiProvider } from "../types";

export function anthropicProvider(config: AiConfig): AiProvider {
  return {
    name: "anthropic",
    async complete(system, prompt) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model || "claude-sonnet-5",
          max_tokens: 2048,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(`Anthropic: ${json.error?.message || res.status}`);
      return (json.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}
