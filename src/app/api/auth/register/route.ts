/**
 * POST /api/auth/register — crea un nuovo utente ed effettua il login.
 * La registrazione può essere disabilitata con ALLOW_REGISTRATION=false
 * (ma il primo utente in assoluto è sempre consentito, per il setup iniziale).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, withErrorHandling } from "@/lib/errors";
import { env } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  countUsers,
  createSession,
  createUser,
  sessionCookieOptions,
} from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Email non valida"),
  name: z.string().min(1, "Inserisci un nome"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export const POST = withErrorHandling("auth", async (req) => {
  const { email, name, password } = schema.parse(await req.json());

  // Il primo utente crea sempre l'account (setup); dopo, rispetta il flag.
  if (!env.allowRegistration && countUsers() > 0) {
    throw new AppError("La registrazione di nuovi utenti è disabilitata", 403);
  }

  const user = createUser(email, name, password);
  const token = createSession(user.id);
  logger.info("auth", `Nuovo utente registrato: ${user.email}`, undefined, user.id);

  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE));
  return res;
});
