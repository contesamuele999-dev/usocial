/**
 * POST /api/studio — esegue un agente del "Cervello contenuti" col provider
 * AI dell'utente. Body: { agent, niche, topic?, audience?, count?, platform?, lang? } → { result }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { runStudioAgent, STUDIO_AGENTS } from "@/ai/studio";
import { PLATFORMS } from "@/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  agent: z.enum(STUDIO_AGENTS),
  niche: z.string().min(1, "Indica la nicchia o il brand"),
  topic: z.string().optional(),
  audience: z.string().optional(),
  count: z.number().int().min(1).max(30).optional(),
  platform: z.enum(PLATFORMS).optional(),
  lang: z.enum(["it", "en"]).optional(),
});

export const POST = withUser("studio", async (req, _ctx, user) => {
  const input = schema.parse(await req.json());
  try {
    const result = await runStudioAgent(user.id, input);
    return NextResponse.json({ result });
  } catch (e) {
    // Gli errori del provider AI (chiave mancante, quota esaurita, rete, output
    // troncato) sono problemi di configurazione, non bug del server: vanno
    // mostrati all'utente invece di diventare un opaco 500 "Errore interno".
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(msg, 502);
  }
});
