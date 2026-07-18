/**
 * GET /api/auth/me — dati dell'utente loggato (o 401 se non autenticato).
 */
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/errors";
import { getRequestUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling("auth", async (req) => {
  const user = getRequestUser(req);
  if (!user) {
    return NextResponse.json({ user: null, allowRegistration: env.allowRegistration }, { status: 200 });
  }
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    allowRegistration: env.allowRegistration,
  });
});
