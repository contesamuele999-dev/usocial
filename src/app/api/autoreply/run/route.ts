/**
 * POST /api/autoreply/run — esegue subito un giro del risponditore.
 * `?simulate=1` legge i commenti e riporta cosa manderebbe, senza inviare
 * niente: è il modo di provare una regola senza scrivere a persone vere.
 * `?platform=…&comment=…` invia la risposta a quel solo commento (pulsante
 * "Invia" sotto una riga dell'anteprima).
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { runAutoReply } from "@/lib/autoreply";
import { clearSimulatedReplies, listCommentReplies } from "@/lib/repo";
import { PLATFORMS, type Platform } from "@/types";

export const dynamic = "force-dynamic";

export const POST = withUser("autoreply", async (req, _ctx, user) => {
  const params = new URL(req.url).searchParams;
  const simulate = params.get("simulate") === "1";
  const platform = params.get("platform") as Platform;
  const commentId = params.get("comment");
  const only = commentId && PLATFORMS.includes(platform) ? { platform, commentId } : undefined;
  const result = await runAutoReply(user.id, simulate && !only, true, only);
  // Una simulazione non deve lasciare traccia che impedisca al giro vero di
  // trattare quegli stessi commenti.
  if (simulate) clearSimulatedReplies(user.id);
  return NextResponse.json({ ...result, log: listCommentReplies(user.id, 50) });
});
