/**
 * "Cervello contenuti": agenti AI che sostituiscono i compiti del social media
 * manager. Ognuno costruisce un prompt mirato a più follower e più vendite.
 * Usa il provider AI configurato dall'utente (vedi src/ai/index.ts).
 *
 * Prototipo iniziale — agenti disponibili:
 *  - ideas        → ricerca temi/angoli per nuovi post e reel
 *  - plan         → piano editoriale su N giorni
 *  - reel_script  → script per reel, scena per scena, con hook e CTA
 *  - carousel     → testo di un carosello, slide per slide
 *  - description  → didascalia ottimizzata + hashtag
 */
import { getAiConfig, getAiProvider } from "./index";
import type { Platform } from "@/types";

export const STUDIO_AGENTS = ["ideas", "plan", "reel_script", "carousel", "description"] as const;
export type StudioAgent = (typeof STUDIO_AGENTS)[number];

export interface StudioRequest {
  agent: StudioAgent;
  niche: string; // settore / brand / nicchia
  topic?: string; // argomento specifico (per script, carosello, descrizione)
  audience?: string; // pubblico target
  count?: number; // n. idee o giorni del piano
  platform?: Platform;
  lang?: "it" | "en";
}

const LANG_NAME = { it: "italiano", en: "English" } as const;

function system(lang: "it" | "en"): string {
  const l = LANG_NAME[lang];
  return (
    `You are a world-class social media strategist and copywriter. ` +
    `Your single goal is to maximize follower growth and sales. ` +
    `Every output must have a scroll-stopping hook, deliver clear value, and drive action. ` +
    `Write everything in ${l}. Respond ONLY with the requested content, no preamble, no explanations.`
  );
}

function promptFor(req: StudioRequest): string {
  const niche = req.niche.trim();
  const audience = req.audience?.trim();
  const topic = req.topic?.trim();
  const platform = req.platform ? ` for ${req.platform}` : "";
  const n = req.count && req.count > 0 ? req.count : undefined;
  const aud = audience ? ` Target audience: ${audience}.` : "";

  switch (req.agent) {
    case "ideas":
      return (
        `Brand/niche: ${niche}.${aud} Research ${n ?? 8} fresh, high-potential content ideas ` +
        `(angles/topics) for short-form posts and reels${platform} that can grow followers and sales. ` +
        `For each idea give, on one line: a catchy title, then " — Hook: " with a scroll-stopping first line, ` +
        `then " · Format: " (reel, carousel, single post). Number them.`
      );
    case "plan":
      return (
        `Brand/niche: ${niche}.${aud} Create a ${n ?? 7}-day editorial plan${platform} to grow followers and sales. ` +
        `One line per day: "Day X — <format>: <topic>" then " · Goal: " (awareness/engagement/conversion) ` +
        `and " · Hook: " with the opening line. Vary formats and goals across the days.`
      );
    case "reel_script":
      return (
        `Write a reel script${platform} about: ${topic || niche}.${aud} ` +
        `Structure it scene by scene for maximum retention and sales. Use this layout:\n` +
        `HOOK (0-3s): <spoken line + on-screen text>\n` +
        `BODY: 3-5 short scenes, each "Scene N — Visual: <what to film> | Voiceover: <what to say> | On-screen: <caption>"\n` +
        `CTA: <clear call to action>\n` +
        `Keep the total under ~45 seconds of speech. Make the hook impossible to scroll past.`
      );
    case "carousel":
      return (
        `Write the copy for a carousel${platform} about: ${topic || niche}.${aud} ` +
        `Produce ${n ?? 7} slides. Format each as "Slide N: <headline>\\n<1-2 short lines of body>". ` +
        `Slide 1 must be a strong hook, the last slide a CTA to follow/buy. Punchy, value-packed.`
      );
    case "description":
      return (
        `Write an optimized ${platform ? platform + " " : ""}caption for a post about: ${topic || niche}.${aud} ` +
        `Start with a scroll-stopping first line, deliver value in short paragraphs, end with a CTA that drives ` +
        `follows and sales. Then add a final line with 8-12 relevant hashtags (mix of popular and niche).`
      );
  }
}

/** Esegue un agente dello Studio e ritorna il testo generato. */
export async function runStudioAgent(userId: number, req: StudioRequest): Promise<string> {
  const provider = getAiProvider(getAiConfig(userId));
  const out = await provider.complete(system(req.lang ?? "it"), promptFor(req));
  return out.trim();
}
