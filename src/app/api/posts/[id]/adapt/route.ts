/**
 * POST /api/posts/:id/adapt — adatta il testo con l'AI per ogni piattaforma
 * selezionata e salva le versioni adattate sui target del post.
 */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { getPost, saveAdaptedText } from "@/lib/repo";
import { runAiAction } from "@/ai/actions";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>("ai", async (_req, { params }, user) => {
  const { id } = await params;
  const post = getPost(Number(id), user.id);
  if (!post) throw new NotFoundError("Post non trovato");

  for (const target of post.targets) {
    const adapted = await runAiAction(user.id, {
      action: "adapt",
      text: post.body,
      title: post.title,
      platform: target.platform,
    });
    saveAdaptedText(post.id, target.platform, null, adapted);
    logger.info("ai", `Testo adattato per ${target.platform} (post #${post.id})`, undefined, user.id);
  }
  return NextResponse.json(getPost(post.id, user.id));
});
