/**
 * Gestione centralizzata degli errori per le API route.
 * Ogni route handler viene avvolto da `withErrorHandling`:
 * gli errori noti (AppError) diventano risposte JSON con lo status giusto,
 * quelli imprevisti vengono loggati e diventano 500.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "./logger";
import { SESSION_COOKIE } from "./constants";

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
        const res = NextResponse.json(
          { error: err.message, detail: err.detail },
          { status: err.status }
        );
        // 401 = il cookie c'è ma la sessione non vale più (scaduta, database
        // ripristinato, logout da un altro dispositivo). Va CANCELLATO qui,
        // altrimenti si innesca un giro infinito: il client manda a /login, il
        // middleware vede il cookie e rimanda alla dashboard, che richiama le
        // API, che rispondono di nuovo 401… e la pagina non si apre mai.
        if (err.status === 401) res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error(scope, message, err instanceof Error ? err.stack : undefined);
      return NextResponse.json({ error: "Errore interno", detail: message }, { status: 500 });
    }
  };
}

/**
 * Messaggio leggibile da un errore, srotolando la catena di `cause`.
 *
 * Perché: `fetch()` di Node fallisce SEMPRE con "fetch failed" e mette la causa
 * reale in `cause` (ENOTFOUND, ECONNRESET, UND_ERR_HEADERS_TIMEOUT, ENOENT…).
 * Senza srotolarla, negli esiti di pubblicazione resta un messaggio che non
 * dice nulla e non si capisce se sia rete, file mancante o timeout.
 */
export function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts: string[] = [];
  const seen = new Set<Error>();
  let cur: unknown = err;
  while (cur instanceof Error && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as Error & {
      code?: string;
      syscall?: string;
      hostname?: string;
      address?: string;
      port?: number;
    };
    const bits = [e.message];
    if (e.code && !e.message.includes(e.code)) bits.push(`[${e.code}]`);
    const host = e.hostname || e.address;
    if (host) bits.push(`${e.syscall ? `${e.syscall} ` : ""}${host}${e.port ? `:${e.port}` : ""}`);
    const line = bits.join(" ");
    if (line && line !== parts[parts.length - 1]) parts.push(line);
    cur = e.cause;
  }
  return parts.join(" ← ");
}
