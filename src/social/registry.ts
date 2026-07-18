/**
 * Registro dei moduli social. Per aggiungere una piattaforma:
 * 1. crea src/social/<nome>/index.ts che esporta un SocialModule;
 * 2. importalo qui e aggiungilo alla mappa;
 * 3. aggiungi il nome a PLATFORMS in src/types/index.ts.
 */
import type { Platform } from "@/types";
import type { SocialModule } from "./types";
import { facebookModule } from "./facebook";
import { instagramModule } from "./instagram";
import { tiktokModule } from "./tiktok";
import { youtubeModule } from "./youtube";
import { linkedinModule } from "./linkedin";

const modules: Record<Platform, SocialModule> = {
  facebook: facebookModule,
  instagram: instagramModule,
  tiktok: tiktokModule,
  youtube: youtubeModule,
  linkedin: linkedinModule,
};

export function getModule(platform: Platform): SocialModule {
  const mod = modules[platform];
  if (!mod) throw new Error(`Piattaforma non supportata: ${platform}`);
  return mod;
}

export function allModules(): SocialModule[] {
  return Object.values(modules);
}

/** Info piattaforme sicure da mandare al frontend (senza logica server). */
export function platformInfo() {
  return allModules().map((m) => ({
    platform: m.platform,
    displayName: m.displayName,
    color: m.color,
    limits: m.limits,
  }));
}
