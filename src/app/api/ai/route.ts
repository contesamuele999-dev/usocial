/**
 * POST /api/ai — esegue un'azione AI su un testo, col provider dell'utente.
 * Body: { action, text, title?, platform? } → { result }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { runAiAction } from "@/ai/actions";
import { PLATFORMS } from "@/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum([
    "adapt",
    "short",
    "long",
    "titles",
    "hashtags",
    "improve",
    "cta",
    "to_short_post",
    "to_linkedin_article",
    "youtube_description",
  ]),
  text: z.string().min(1, "Serve un testo su cui lavorare"),
  title: z.string().optional(),
  platform: z.enum(PLATFORMS).optional(),
});

export const POST = withUser("ai", async (req, _ctx, user) => {
  const input = schema.parse(await req.json());
  const result = await runAiAction(user.id, input);
  return NextResponse.json({ result });
});
