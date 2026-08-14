/**
 * /api/settings — preferenze semplici dell'utente (chiave → valore).
 * Solo le chiavi in KEYS sono leggibili/scrivibili da qui: le impostazioni AI
 * hanno la loro route dedicata (/api/settings/ai).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/** chiave → valore di default. */
const KEYS: Record<string, string> = {
  /** "on" = i media vengono rimossi dal disco quando il post è pubblicato ovunque. */
  autoCleanupMedia: "on",
};

export const GET = withUser("settings", async (_req, _ctx, user) => {
  const out: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(KEYS)) out[key] = getSetting(user.id, key, fallback);
  return NextResponse.json(out);
});

export const PUT = withUser("settings", async (req, _ctx, user) => {
  const body = z.record(z.string()).parse(await req.json());
  for (const [key, value] of Object.entries(body)) {
    if (key in KEYS) setSetting(user.id, key, value);
  }
  const out: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(KEYS)) out[key] = getSetting(user.id, key, fallback);
  return NextResponse.json(out);
});
