/**
 * Callback che Meta chiama da sola su Facebook, Instagram e Threads:
 *  - "Disinstalla" (deauthorize), quando una persona toglie l'autorizzazione;
 *  - "Elimina" (data deletion), quando chiede la cancellazione dei suoi dati.
 *
 * Non sono richieste normali dell'app: arrivano da Meta come POST
 * `application/x-www-form-urlencoded` con un solo campo, `signed_request`,
 * firmato con la chiave segreta dell'app. Vanno verificate, altrimenti
 * chiunque potrebbe scollegare l'account di qualcun altro conoscendone l'id.
 */
import crypto from "node:crypto";
import { logger } from "@/lib/logger";
import { accountsByExternalId, deleteAccount } from "@/lib/repo";
import type { Account } from "@/types";

/** Contenuto utile del signed_request (gli altri campi non ci servono). */
interface SignedRequest {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
}

/** base64url → Buffer (Meta usa l'alfabeto URL-safe, senza padding). */
function fromBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Chiavi con cui può essere firmata la richiesta.
 *
 * Lo stesso indirizzo è configurato su più app Meta (Facebook/Instagram da una
 * parte, Threads dall'altra, con segreti diversi): si prova con tutte quelle
 * configurate e basta che una combaci.
 */
function appSecrets(): string[] {
  return [process.env.META_CLIENT_SECRET, process.env.THREADS_CLIENT_SECRET].filter(
    (s): s is string => !!s
  );
}

/**
 * Verifica la firma e restituisce il contenuto, o null se la richiesta non è
 * autentica. Il confronto è a tempo costante: una verifica con `===` lascerebbe
 * misurare la firma giusta un byte alla volta.
 */
export function parseSignedRequest(raw: string): SignedRequest | null {
  const [encodedSig, payload] = raw.split(".", 2);
  if (!encodedSig || !payload) return null;

  let data: SignedRequest;
  try {
    data = JSON.parse(fromBase64Url(payload).toString("utf8")) as SignedRequest;
  } catch {
    return null;
  }
  // Meta firma con HMAC-SHA256: un algoritmo diverso significa richiesta
  // costruita a mano, non un aggiornamento della piattaforma.
  if (data.algorithm && data.algorithm.toUpperCase() !== "HMAC-SHA256") return null;

  const given = fromBase64Url(encodedSig);
  for (const secret of appSecrets()) {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest();
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return data;
  }
  return null;
}

/**
 * Scollega gli account corrispondenti all'id Meta e cancella i token.
 *
 * Cancella SOLO il collegamento social, non l'account uSocial: la richiesta
 * riguarda i dati ottenuti dalla piattaforma, non i post e i media scritti
 * dall'utente. Per cancellare tutto c'è la pagina /data-deletion.
 */
export function disconnectByMetaUserId(metaUserId: string): Account[] {
  const accounts = accountsByExternalId(metaUserId);
  for (const account of accounts) {
    deleteAccount(account.userId, account.platform);
    logger.info(
      account.platform,
      `Account scollegato su richiesta di Meta (${account.accountName})`,
      undefined,
      account.userId
    );
  }
  return accounts;
}

/**
 * Corpo della richiesta: Meta manda un form, ma alcune integrazioni di prova
 * mandano JSON. Si accettano entrambi invece di rispondere 400 a Meta.
 */
export async function readSignedRequest(req: Request): Promise<string | null> {
  const type = req.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) {
      const json = (await req.json()) as { signed_request?: string };
      return json.signed_request || null;
    }
    const form = await req.formData();
    const value = form.get("signed_request");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
