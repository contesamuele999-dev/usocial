/**
 * Provider "mock": nessuna chiamata esterna, trasformazioni deterministiche.
 * Serve per usare l'app senza API key e per i test automatici.
 */
import type { AiProvider } from "../types";

export function mockProvider(): AiProvider {
  return {
    name: "mock",
    async complete(system, prompt) {
      // Estrae il testo utente dal prompt (dopo l'ultima riga "TESTO:")
      const marker = prompt.lastIndexOf("TESTO:");
      const text = (marker >= 0 ? prompt.slice(marker + 6) : prompt).trim();

      if (system.includes("[titles]")) {
        const base = text.split(/\s+/).slice(0, 6).join(" ");
        return [1, 2, 3, 4, 5].map((i) => `${i}. ${base} — variante ${i}`).join("\n");
      }
      if (system.includes("[hashtags]")) {
        const words = Array.from(new Set(text.toLowerCase().match(/[a-zà-ù]{4,}/g) || []));
        return words.slice(0, 8).map((w) => `#${w}`).join(" ") || "#social #post";
      }
      if (system.includes("[short]") || system.includes("[to_short_post]")) {
        return text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
      }
      if (system.includes("[cta]")) {
        return "👉 Seguimi per altri contenuti come questo! Salva il post e condividilo.";
      }
      // default: ritorna il testo (eventualmente troncato dal chiamante)
      return text;
    },
  };
}
