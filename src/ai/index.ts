/**
 * Factory del provider AI. La configurazione è per-utente: arriva dalle
 * impostazioni salvate nel DB (pagina Impostazioni) con fallback su .env.
 * Per aggiungere un provider: crea src/ai/providers/<nome>.ts e mappalo qui.
 */
import { getSetting } from "@/lib/db";
import type { AiConfig, AiProvider } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { geminiProvider } from "./providers/gemini";
import { ollamaProvider } from "./providers/ollama";
import { mockProvider } from "./providers/mock";

export function getAiConfig(userId: number): AiConfig {
  return {
    provider: getSetting(userId, "ai_provider", process.env.AI_PROVIDER || "mock"),
    model: getSetting(userId, "ai_model", process.env.AI_MODEL || ""),
    apiKey: getSetting(userId, "ai_api_key", process.env.AI_API_KEY || ""),
    baseUrl: getSetting(userId, "ai_base_url", process.env.AI_BASE_URL || ""),
  };
}

export function getAiProvider(config: AiConfig): AiProvider {
  switch (config.provider) {
    case "anthropic":
      return anthropicProvider(config);
    case "openai":
      return openaiProvider(config);
    case "gemini":
      return geminiProvider(config);
    case "ollama":
      return ollamaProvider(config);
    case "mock":
    default:
      return mockProvider();
  }
}
