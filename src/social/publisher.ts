/**
 * Orchestratore di pubblicazione: prende un post e lo pubblica sulle piattaforme
 * selezionate, aggiornando gli stati. In caso di errore programma un nuovo
 * tentativo automatico con backoff crescente (fino a MAX_ATTEMPTS tentativi).
 * Usato dal pulsante "Pubblica ora", dallo scheduler e dal retry automatico.
 */
import path from "node:path";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  getAccount,
  getPostSystem,
  saveAccount,
  setPostStatus,
  updateTarget,
} from "@/lib/repo";
import type { Post, PostStatus, PostTarget, TargetStatus } from "@/types";
import { getModule } from "./registry";
import { expiryIso } from "./oauth";
import type { PublishInput, PublishMedia } from "./types";
import { filePath } from "@/lib/storage";

/** Numero massimo di tentativi per target (1 iniziale + retry). */
export const MAX_ATTEMPTS = 5;

/**
 * Backoff: minuti di attesa prima del prossimo tentativo, in base a quanti
 * tentativi sono già stati fatti. Crescita ~esponenziale con tetto a 60 min.
 * (dopo il 1° fallimento → 1 min, 2° → 5, 3° → 15, 4° → 60).
 */
export function backoffMinutes(attemptsDone: number): number {
  const schedule = [1, 5, 15, 60];
  return schedule[Math.min(attemptsDone - 1, schedule.length - 1)] ?? 60;
}

/** Stato complessivo del post a partire dagli stati dei suoi target. */
export function computePostStatus(statuses: TargetStatus[]): PostStatus {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "published")) return "published";
  if (statuses.some((s) => s === "published")) return "partial";
  return "failed";
}

/** Compone il testo finale per una piattaforma: testo adattato (se c'è) + hashtag. */
export function composeText(post: Post, target: PostTarget): { title: string; body: string } {
  const title = target.adaptedTitle ?? post.title;
  let body = target.adaptedBody ?? post.body;
  const hashtags = post.hashtags.trim();
  if (hashtags && !body.includes(hashtags)) {
    body = body.trimEnd() + "\n\n" + hashtags;
  }
  return { title, body };
}

function toPublishMedia(post: Post): PublishMedia[] {
  return post.media.map((m) => ({
    path: filePath(m.filename),
    mime: m.mime,
    size: m.size,
    url: `${env.appUrl}/api/media/${m.id}/file${path.extname(m.filename)}`,
    kind: m.mime.startsWith("video/") ? "video" : "image",
  }));
}

/** Rinnova il token se scaduto (per le piattaforme che lo supportano). */
async function ensureFreshToken(userId: number, platform: PostTarget["platform"]) {
  const account = getAccount(userId, platform);
  if (!account) return null;
  const mod = getModule(platform);
  const expired = account.expiresAt && new Date(account.expiresAt).getTime() < Date.now() + 60_000;
  if (expired && mod.refresh) {
    try {
      const tokens = await mod.refresh(account);
      if (tokens) {
        account.accessToken = tokens.accessToken;
        account.refreshToken = tokens.refreshToken ?? account.refreshToken;
        account.expiresAt = expiryIso(tokens.expiresIn);
        saveAccount(account);
        logger.info(platform, "Token rinnovato automaticamente", undefined, userId);
      }
    } catch (err) {
      logger.warn(platform, "Refresh token fallito", String(err), userId);
    }
  }
  return getAccount(userId, platform);
}

/** Pubblica un singolo target; in caso di errore programma il retry o si arrende. */
async function publishTarget(post: Post, target: PostTarget) {
  const userId = post.userId;
  const mod = getModule(target.platform);
  // segna "publishing" SUBITO (sincrono): protegge da tick concorrenti dello scheduler
  updateTarget(target.id, { status: "publishing", error: null, incrementAttempts: true });
  const attemptsDone = target.attempts + 1;

  try {
    const account = await ensureFreshToken(userId, target.platform);
    if (!account) throw new Error(`Account ${mod.displayName} non connesso (vai in Impostazioni).`);

    const { title, body } = composeText(post, target);
    const input: PublishInput = { title, body, media: toPublishMedia(post) };

    if (mod.limits.requiresMedia && input.media.length === 0) {
      throw new Error(`${mod.displayName} richiede almeno un media.`);
    }
    if (body.length > mod.limits.maxChars) {
      throw new Error(
        `Testo troppo lungo per ${mod.displayName} (${body.length}/${mod.limits.maxChars} caratteri). Usa l'AI per adattarlo.`
      );
    }

    const result = await mod.publish(input, account);
    updateTarget(target.id, {
      status: "published",
      externalId: result.externalId,
      externalUrl: result.externalUrl ?? null,
      publishedAt: new Date().toISOString(),
      error: null,
      nextRetryAt: null,
    });
    logger.info(target.platform, `Post #${post.id} pubblicato (${result.externalId})`, undefined, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (attemptsDone < MAX_ATTEMPTS) {
      const retryAt = new Date(Date.now() + backoffMinutes(attemptsDone) * 60_000);
      updateTarget(target.id, { status: "failed", error: message, nextRetryAt: retryAt.toISOString() });
      logger.warn(
        target.platform,
        `Pubblicazione post #${post.id} fallita (tentativo ${attemptsDone}/${MAX_ATTEMPTS}): riprovo alle ${retryAt.toLocaleTimeString("it-IT")}`,
        message,
        userId
      );
    } else {
      updateTarget(target.id, { status: "failed", error: message, nextRetryAt: null });
      logger.error(
        target.platform,
        `Pubblicazione post #${post.id} fallita definitivamente dopo ${MAX_ATTEMPTS} tentativi`,
        message,
        userId
      );
    }
  }
}

/**
 * Pubblica un post. Senza opzioni prova tutti i target pending/failed (usato da
 * "Pubblica ora" e dal primo tentativo programmato). Con `onlyTargetIds` prova
 * solo quei target (usato dal retry automatico per rispettare il backoff).
 */
export async function publishPost(
  postId: number,
  opts?: { onlyTargetIds?: number[] }
): Promise<Post | null> {
  const post = getPostSystem(postId);
  if (!post) return null;

  const onlySet = opts?.onlyTargetIds ? new Set(opts.onlyTargetIds) : null;
  const toPublish = post.targets.filter(
    (t) => (t.status === "pending" || t.status === "failed") && (!onlySet || onlySet.has(t.id))
  );
  if (toPublish.length === 0) return post;

  setPostStatus(postId, "publishing");
  for (const target of toPublish) {
    await publishTarget(post, target);
  }

  const updated = getPostSystem(postId)!;
  setPostStatus(postId, computePostStatus(updated.targets.map((t) => t.status)));
  return getPostSystem(postId);
}
