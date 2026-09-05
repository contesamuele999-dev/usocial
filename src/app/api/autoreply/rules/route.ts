/**
 * GET  /api/autoreply/rules — regole del risponditore + ultime righe di registro.
 * POST /api/autoreply/rules — crea una regola.
 */
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { parseRule } from "@/lib/autoreply";
import { createAutoReplyRule, listAutoReplyRules, listCommentReplies } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser("autoreply", async (_req, _ctx, user) =>
  NextResponse.json({
    rules: listAutoReplyRules(user.id),
    log: listCommentReplies(user.id, 50),
  })
);

export const POST = withUser("autoreply", async (req, _ctx, user) => {
  const body = (await req.json()) as Record<string, unknown>;
  return NextResponse.json(createAutoReplyRule(user.id, parseRule(body)), { status: 201 });
});
