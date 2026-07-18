/**
 * Provider OpenAI (Chat Completions).
 */
import type { AiConfig, AiProvider } from "../types";

export function openaiProvider(config: AiConfig): AiProvider {
  return {
    name: "openai",
    async complete(system, prompt) {
      const base = config.baseUrl || "https://api.openai.com/v1";
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model || "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(`OpenAI: ${json.error?.message || res.status}`);
      return json.choices?.[0]?.message?.content || "";
    },
  };
}
