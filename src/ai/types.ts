/**
 * Contratto del provider AI: una sola funzione `complete`.
 * Sostituire provider = implementare questa interfaccia (vedi src/ai/providers/).
 */
export interface AiProvider {
  name: string;
  /** Esegue il prompt e ritorna il testo generato. */
  complete(system: string, prompt: string): Promise<string>;
}

export interface AiConfig {
  provider: string; // mock | anthropic | openai | ollama
  model: string;
  apiKey: string;
  baseUrl: string;
}
