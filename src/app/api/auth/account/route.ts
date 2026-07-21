/**
 * DELETE /api/auth/account — cancella l'account dell'utente autenticato e TUTTI
 * i suoi dati (post, media, account social collegati, impostazioni, log, sessioni).
 * Operazione irreversibile. Usata anche per soddisfare le richieste di
 * "data deletion" richieste dalle piattaforme (es. Meta/Facebook).
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { deleteUser } from "@/lib/repo";
import { deleteFile } from "@/lib/storage";
import { deleteSession, readSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const DELETE = withUser("auth", async (req, _ctx, user) => {
  // Rimuove riga utente (+ cascade) e log; ritorna i file media da eliminare dal disco.
  const files = deleteUser(user.id);
  await Promise.all(files.map((f) => deleteFile(f)));

  // Chiude la sessione corrente e cancella il cookie.
  const token = readSessionToken(req);
  if (token) deleteSession(token);

  logger.info("auth", `Account #${user.id} eliminato con tutti i dati (${files.length} file media)`);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
