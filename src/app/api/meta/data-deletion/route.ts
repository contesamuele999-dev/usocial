/**
 * POST /api/meta/data-deletion — "Elimina URL di callback" delle app Meta
 * (Facebook, Instagram, Threads).
 *
 * Meta lo chiama quando una persona chiede la cancellazione dei dati che uSocial
 * ha ottenuto dalla piattaforma, e si aspetta in risposta un JSON con
 * `url` (una pagina dove l'utente può controllare lo stato) e
 * `confirmation_code`. Per questo non basta puntare a una pagina qualsiasi.
 *
 * Cosa viene cancellato: il collegamento social, cioè token, id e nome profilo
 * ricevuti da Meta. NON i post, i media e l'account uSocial, che appartengono
 * all'utente e non a Meta — per quelli c'è /data-deletion (o Impostazioni →
 * Elimina il mio account).
 *
 * ⚠️ Endpoint PUBBLICO: l'autenticazione è la firma del `signed_request`.
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  disconnectByMetaUserId,
  parseSignedRequest,
  readSignedRequest,
} from "@/social/meta-callbacks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await readSignedRequest(req);
  const data = raw ? parseSignedRequest(raw) : null;
  // Codice di riscontro mostrato all'utente da Meta; finisce nei log così è
  // rintracciabile se qualcuno scrive citandolo.
  const code = crypto.randomBytes(8).toString("hex");
  const statusUrl = `${env.appUrl}/data-deletion?code=${code}`;

  if (!data?.user_id) {
    logger.warn("oauth", "Callback di cancellazione dati Meta non valido o non firmato");
    return NextResponse.json({ url: statusUrl, confirmation_code: code });
  }

  const removed = disconnectByMetaUserId(data.user_id);
  logger.info(
    "oauth",
    `Cancellazione dati richiesta da Meta (codice ${code}): ${removed.length} collegamenti rimossi`,
    removed.map((a) => a.platform).join(", ") || undefined
  );

  return NextResponse.json({ url: statusUrl, confirmation_code: code });
}

export function GET() {
  return NextResponse.json({ ok: true });
}
