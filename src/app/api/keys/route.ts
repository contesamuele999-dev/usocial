/**
 * /api/keys — chiavi API per gli agenti IA (CLI, MCP, script).
 * GET    — elenco (solo prefisso: la chiave in chiaro non è recuperabile)
 * POST   — crea una chiave { name } e la restituisce UNA sola volta
 * DELETE — revoca ?id=123
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { createApiKey, deleteApiKey, listApiKeys } from "@/lib/auth";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withUser("keys", async (_req, _ctx, user) =>
  NextResponse.json(listApiKeys(user.id))
);

export const POST = withUser("keys", async (req, _ctx, user) => {
  const { name } = z
    .object({ name: z.string().default("agente IA") })
    .parse(await req.json().catch(() => ({})));
  const created = createApiKey(user.id, name);
  logger.info("keys", `Creata chiave API "${created.name}"`, undefined, user.id);
  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withUser("keys", async (req, _ctx, user) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!deleteApiKey(id, user.id)) throw new NotFoundError("Chiave non trovata");
  logger.info("keys", `Revocata chiave API #${id}`, undefined, user.id);
  return NextResponse.json({ ok: true });
});
