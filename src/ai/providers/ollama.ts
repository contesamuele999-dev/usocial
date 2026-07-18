/**
 * Provider Ollama (modelli locali, es. llama3).
 */
import type { AiConfig, AiProvider } from "../types";

export function ollamaProvider(config: AiConfig): AiProvider {
  return {
    name: "ollama",
    async complete(system, prompt) {
      const base = config.baseUrl || "http://localhost:11434";
      const res = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model || "llama3.1",
          system,
          prompt,
          stream: false,
        }),
      });
      const json = (await res.json()) as { response?: string; error?: string };
      if (!res.ok || json.error) throw new Error(`Ollama: ${json.error || res.status}`);
      return json.response || "";
    },
  };
}
