/**
 * /api/templates
 * GET  — lista template dell'utente (opz. ?kind=post|carousel)
 * POST — crea un template { name, kind, data }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { createTemplate, listTemplates } from "@/lib/repo";
import { PLATFORMS } from "@/types";

export const dynamic = "force-dynamic";

const brand = z.object({ bg: z.string(), text: z.string(), accent: z.string(), font: z.string() });
const postData = z.object({
  body: z.string(),
  hashtags: z.string(),
  platforms: z.array(z.enum(PLATFORMS)),
});
const carouselData = z.object({
  brand,
  slides: z.array(z.object({ headline: z.string(), body: z.string() })),
  hashtags: z.string(),
});

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("post"), name: z.string().min(1), data: postData }),
  z.object({ kind: z.literal("carousel"), name: z.string().min(1), data: carouselData }),
]);

export const GET = withUser("templates", async (req, _ctx, user) => {
  const kind = new URL(req.url).searchParams.get("kind");
  const list = listTemplates(user.id, kind === "post" || kind === "carousel" ? kind : undefined);
  return NextResponse.json(list);
});

export const POST = withUser("templates", async (req, _ctx, user) => {
  const input = createSchema.parse(await req.json());
  const tpl = createTemplate(user.id, input.name, input.kind, input.data);
  return NextResponse.json(tpl, { status: 201 });
});
