/**
 * POST /api/auth/logout — chiude la sessione corrente e cancella il cookie.
 */
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/errors";
import { SESSION_COOKIE, deleteSession, readSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling("auth", async (req) => {
  const token = readSessionToken(req);
  if (token) deleteSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
