/**
 * POST /api/meta/deauthorize — "Disinstalla URL di callback" delle app Meta
 * (Facebook, Instagram, Threads).
 *
 * Meta lo chiama quando una persona toglie l'autorizzazione a uSocial dalle
 * impostazioni del proprio profilo. Senza questo callback il token resterebbe
 * salvato qui, ormai morto, e l'utente vedrebbe l'account "connesso" finché non
 * lo scollega a mano.
 *
 * ⚠️ Endpoint PUBBLICO (nessun cookie: la richiesta arriva dai server di Meta).
 * L'autenticazione è la firma del `signed_request`, verificata con la chiave
 * segreta dell'app.
 */
import { NextResponse } from "next/server";
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

  if (!data?.user_id) {
    // Si risponde comunque 200: a Meta interessa solo che l'endpoint risponda,
    // e un 4xx qui fa comparire l'app come "non raggiungibile" nella console.
    logger.warn("oauth", "Callback di disinstallazione Meta non valido o non firmato");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const removed = disconnectByMetaUserId(data.user_id);
  if (removed.length === 0) {
    logger.info("oauth", `Disinstallazione Meta per un id non collegato (${data.user_id})`);
  }
  return NextResponse.json({ ok: true, disconnected: removed.length });
}

/** Meta verifica talvolta che l'indirizzo esista con una GET. */
export function GET() {
  return NextResponse.json({ ok: true });
}
