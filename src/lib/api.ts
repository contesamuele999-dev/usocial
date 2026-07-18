/**
 * Wrapper per le API route che richiedono l'utente autenticato.
 * Combina la gestione errori centralizzata con il recupero della sessione:
 * l'handler riceve l'utente già risolto (o la richiesta viene respinta con 401).
 */
import { withErrorHandling } from "./errors";
import { requireUser } from "./auth";
import type { User } from "@/types";

type AuthedHandler<Ctx> = (req: Request, ctx: Ctx, user: User) => Promise<Response>;

export function withUser<Ctx>(scope: string, handler: AuthedHandler<Ctx>) {
  return withErrorHandling<Ctx>(scope, async (req, ctx) => {
    const user = requireUser(req);
    return handler(req, ctx, user);
  });
}
