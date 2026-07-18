/**
 * Gestione centralizzata degli errori per le API route.
 * Ogni route handler viene avvolto da `withErrorHandling`:
 * gli errori noti (AppError) diventano risposte JSON con lo status giusto,
 * quelli imprevisti vengono loggati e diventano 500.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "./logger";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public detail?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Risorsa non trovata") {
    super(message, 404);
  }
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

export function withErrorHandling<Ctx>(scope: string, handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Dati non validi", detail: err.flatten() },
          { status: 422 }
        );
      }
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error(scope, message, err instanceof Error ? err.stack : undefined);
      return NextResponse.json({ error: "Errore interno", detail: message }, { status: 500 });
    }
  };
}
