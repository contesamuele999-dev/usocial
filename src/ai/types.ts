/**
 * Contratto del provider AI: una sola funzione `complete`.
 * Sostituire provider = implementare questa interfaccia (vedi src/ai/providers/).
 */
/** Opzioni per singola chiamata (il default va bene per la maggior parte dei casi). */
export interface CompleteOptions {
  /**
   * Tetto di token in uscita. Serve agli agenti "lunghi" (carosello, piano
   * editoriale): con un limite troppo basso la risposta veniva troncata a metà
   * e l'app mostrava un errore generico.
   */
  maxTokens?: number;
}

export interface AiProvider {
  name: string;
  /** Esegue il prompt e ritorna il testo generato. */
  complete(system: string, prompt: string, opts?: CompleteOptions): Promise<string>;
}

export interface AiConfig {
  provider: string; // mock | anthropic | openai | ollama
  model: string;
  apiKey: string;
  baseUrl: string;
}
