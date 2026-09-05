/**
 * POST /api/autoreply/run — esegue subito un giro del risponditore.
 * `?simulate=1` legge i commenti e riporta cosa manderebbe, senza inviare
 * niente: è il modo di provare una regola senza scrivere a persone vere.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { runAutoReply } from "@/lib/autoreply";
import { clearSimulatedReplies, listCommentReplies } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const POST = withUser("autoreply", async (req, _ctx, user) => {
  const simulate = new URL(req.url).searchParams.get("simulate") === "1";
  const result = await runAutoReply(user.id, simulate);
  // Una simulazione non deve lasciare traccia che impedisca al giro vero di
  // trattare quegli stessi commenti.
  if (simulate) clearSimulatedReplies(user.id);
  return NextResponse.json({ ...result, log: listCommentReplies(user.id, 50) });
});
