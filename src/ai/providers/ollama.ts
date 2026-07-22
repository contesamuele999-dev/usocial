/**
 * Provider Ollama (modelli locali, es. llama3).
 */
import type { AiConfig, AiProvider } from "../types";

export function ollamaProvider(config: AiConfig): AiProvider {
  return {
    name: "ollama",
    async complete(system, prompt, opts) {
      const base = config.baseUrl || "http://localhost:11434";
      let res: Response;
      try {
        res = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model || "llama3.1",
            system,
            prompt,
            stream: false,
            ...(opts?.maxTokens ? { options: { num_predict: opts.maxTokens } } : {}),
          }),
        });
      } catch (e) {
        throw new Error(
          `Ollama non raggiungibile su ${base}: assicurati che sia in esecuzione ` +
            `(${e instanceof Error ? e.message : String(e)}).`
        );
      }
      const json = (await res.json().catch(() => ({}))) as {
        response?: string;
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(`Ollama: ${json.error || res.status}`);
      const text = json.response || "";
      if (!text.trim()) throw new Error("Ollama ha restituito una risposta vuota.");
      return text;
    },
  };
}
