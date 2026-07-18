/**
 * POST /api/auth/login — verifica le credenziali e apre una sessione.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, withErrorHandling } from "@/lib/errors";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  getUserByEmail,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "Inserisci la password"),
});

export const POST = withErrorHandling("auth", async (req) => {
  const { email, password } = schema.parse(await req.json());
  const user = getUserByEmail(email);
  // messaggio generico: non rivelare se l'email esiste
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AppError("Email o password non corretti", 401);
  }
  const token = createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE));
  return res;
});
