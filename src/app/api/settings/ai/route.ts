/**
 * /api/settings/ai — configurazione del provider AI dell'utente.
 * GET restituisce la config (API key mascherata), PUT la aggiorna.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { setSetting } from "@/lib/db";
import { getAiConfig } from "@/ai";

export const dynamic = "force-dynamic";

export const GET = withUser("settings", async (_req, _ctx, user) => {
  const config = getAiConfig(user.id);
  return NextResponse.json({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    hasApiKey: !!config.apiKey,
  });
});

export const PUT = withUser("settings", async (req, _ctx, user) => {
  const input = z
    .object({
      provider: z.enum(["mock", "anthropic", "openai", "gemini", "ollama"]),
      model: z.string().default(""),
      apiKey: z.string().default(""),
      baseUrl: z.string().default(""),
    })
    .parse(await req.json());
  setSetting(user.id, "ai_provider", input.provider);
  setSetting(user.id, "ai_model", input.model);
  setSetting(user.id, "ai_base_url", input.baseUrl);
  if (input.apiKey) setSetting(user.id, "ai_api_key", input.apiKey); // vuoto = non toccare la key
  return NextResponse.json({ ok: true });
});
