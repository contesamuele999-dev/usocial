/**
 * GET /api/logs — ultimi log dell'utente + log di sistema (pubblicazioni, errori API).
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listLogs } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("logs", async (req, _ctx, user) => {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 200), 1000);
  return NextResponse.json(listLogs(user.id, limit));
});
