/**
 * GET  /api/stats?days=30 — statistiche dei post pubblicati (solo lettura da DB).
 * POST /api/stats?days=30 — rilegge le metriche dalle piattaforme e poi risponde
 *   con le statistiche aggiornate.
 *
 * La separazione è voluta: aprire la pagina non deve mai dipendere dalle API
 * social (lente, a volte in errore); l'aggiornamento è un gesto esplicito
 * dell'utente, oltre a quello automatico dello scheduler.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { buildStats, DEFAULT_DAYS, refreshMetrics } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Finestre ammesse: evita che un `?days=100000` scandagli tutto l'archivio. */
const ALLOWED_DAYS = [7, 30, 90];

function daysOf(req: Request): number {
  const raw = Number(new URL(req.url).searchParams.get("days"));
  return ALLOWED_DAYS.includes(raw) ? raw : DEFAULT_DAYS;
}

export const GET = withUser("stats", async (req, _ctx, user) =>
  NextResponse.json(buildStats(user.id, daysOf(req)))
);

export const POST = withUser("stats", async (req, _ctx, user) => {
  const days = daysOf(req);
  const refresh = await refreshMetrics(user.id, days);
  return NextResponse.json({ ...buildStats(user.id, days), refresh });
});
