/**
 * Azioni AI: costruzione dei prompt per ogni trasformazione del testo.
 * I prompt includono i vincoli reali della piattaforma (limiti caratteri, stile).
 */
import type { AiAction, AiRequest, Platform } from "@/types";
import { getModule } from "@/social/registry";
import { getAiConfig, getAiProvider } from "./index";

const PLATFORM_STYLE: Record<Platform, string> = {
  facebook:
    "Tono colloquiale e coinvolgente, paragrafi brevi, emoji con moderazione, invito alla conversazione.",
  instagram:
    "Prima riga fortissima (hook), paragrafi brevissimi separati da riga vuota, emoji, max 2200 caratteri, chiudi con CTA e hashtag.",
  threads:
    "Conversazionale e diretto, come un pensiero detto a voce: max 500 caratteri, una sola idea, niente muro di hashtag.",
  tiktok:
    "Caption breve e diretta, linguaggio giovane, max 150 caratteri per il titolo, hook immediato.",
  youtube:
    "Descrizione strutturata: riassunto nelle prime 2 righe (visibili prima del 'mostra altro'), poi dettagli, link e hashtag.",
  linkedin:
    "Tono professionale ma umano, hook nella prima riga, paragrafi da 1-2 frasi, niente hashtag eccessivi (max 5), chiudi con una domanda.",
};

function systemFor(action: AiAction, platform?: Platform): string {
  const base =
    "Sei un social media manager esperto. Rispondi SOLO con il testo richiesto, in italiano, senza spiegazioni né preamboli.";
  const style = platform ? `\nStile per ${platform}: ${PLATFORM_STYLE[platform]}` : "";
  // Il tag [action] permette al provider mock di riconoscere l'azione.
  return `${base}${style}\n[${action}]`;
}

function promptFor(req: AiRequest): string {
  const limits = req.platform ? getModule(req.platform).limits : null;
  const t = req.title ? `TITOLO: ${req.title}\n` : "";
  switch (req.action) {
    case "adapt":
      return `Adatta questo contenuto per ${req.platform}. Rispetta il limite di ${limits?.maxChars} caratteri. Mantieni il messaggio ma ottimizza formato e tono per la piattaforma.\n${t}TESTO: ${req.text}`;
    case "short":
      return `Riscrivi questo testo in versione CORTA (max 3 frasi), mantenendo il messaggio chiave.\n${t}TESTO: ${req.text}`;
    case "long":
      return `Espandi questo testo in una versione LUNGA e più ricca (aggiungi contesto, esempi, dettagli), mantenendo il tono.\n${t}TESTO: ${req.text}`;
    case "titles":
      return `Genera 5 titoli efficaci e accattivanti per questo contenuto, uno per riga, numerati.\nTESTO: ${req.text}`;
    case "hashtags":
      return `Suggerisci 8-12 hashtag pertinenti per questo contenuto (mix di popolari e di nicchia), separati da spazio, in una sola riga.\nTESTO: ${req.text}`;
    case "improve":
      return `Migliora la leggibilità di questo testo: frasi più corte, parole semplici, paragrafi ariosi. Non cambiare il significato.\n${t}TESTO: ${req.text}`;
    case "cta":
      return `Genera 3 call-to-action efficaci per questo contenuto, una per riga.\nTESTO: ${req.text}`;
    case "to_short_post":
      return `Trasforma questo testo lungo in un post breve e d'impatto per i social (max 400 caratteri).\n${t}TESTO: ${req.text}`;
    case "to_linkedin_article":
      return `Trasforma questo post breve in un articolo LinkedIn completo: titolo, hook, 3-5 sezioni brevi, conclusione con domanda. Tono professionale ma personale.\n${t}TESTO: ${req.text}`;
    case "youtube_description":
      return `Crea una descrizione YouTube completa per questo video: riassunto nelle prime 2 righe, poi capitoli/dettagli, CTA iscrizione, hashtag finali.\n${t}TESTO: ${req.text}`;
  }
}

/** Esegue un'azione AI (col provider configurato dall'utente) e ritorna il testo. */
export async function runAiAction(userId: number, req: AiRequest): Promise<string> {
  const provider = getAiProvider(getAiConfig(userId));
  const result = await provider.complete(systemFor(req.action, req.platform), promptFor(req));
  return result.trim();
}
