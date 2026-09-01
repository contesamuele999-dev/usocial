/**
 * Orchestratore di pubblicazione: prende un post e lo pubblica sulle piattaforme
 * selezionate, aggiornando gli stati. In caso di errore programma un nuovo
 * tentativo automatico con backoff crescente (fino a MAX_ATTEMPTS tentativi).
 * Usato dal pulsante "Pubblica ora", dallo scheduler e dal retry automatico.
 */
import path from "node:path";
import { env } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  deleteMediaSystem,
  dueReclaimableMedia,
  getAccount,
  getPostSystem,
  scheduleMediaReclaim,
  setPostStatus,
  updateTarget,
} from "@/lib/repo";
import { getSetting } from "@/lib/db";
import type { Post, PostStatus, PostTarget, TargetStatus } from "@/types";
import { getModule } from "./registry";
import { needsRefresh, refreshAccount } from "./tokens";
import type { PublishInput, PublishMedia } from "./types";
import { deleteFile, filePath } from "@/lib/storage";

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

/**
 * Garantisce un access token valido al momento della pubblicazione.
 * Il rinnovo periodico lo fa già lo scheduler (src/social/tokens.ts): qui è
 * l'ultima rete di sicurezza per i post pubblicati a mano dopo mesi.
 */
async function ensureFreshToken(userId: number, platform: PostTarget["platform"]) {
  const account = getAccount(userId, platform);
  if (!account) return null;
  if (needsRefresh(account)) await refreshAccount(account);
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
    const input: PublishInput = {
      title,
      body,
      media: toPublishMedia(post),
      postType: target.postType,
      options: target.options,
    };

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
    const message = errorMessage(err);
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

/** Quanto si aspetta prima di togliere dal disco i media di un post pubblicato. */
export const MEDIA_RECLAIM_DELAY_MS = 24 * 3600_000;

/**
 * Programma la liberazione del disco dopo una pubblicazione riuscita: i media
 * che nessun contenuto in coda usa più vengono marcati per la rimozione fra
 * MEDIA_RECLAIM_DELAY_MS. A cancellarli davvero è `sweepReclaimableMedia`,
 * chiamata dallo scheduler.
 *
 * Prima la cancellazione era immediata, e bastava che il post successivo (es.
 * TikTok subito dopo Instagram e Facebook) venisse creato un istante dopo la
 * pubblicazione per trovarsi senza allegato: "TikTok richiede almeno un media".
 * Il giorno di margine copre quella finestra.
 */
function scheduleMediaCleanup(post: Post) {
  const at = new Date(Date.now() + MEDIA_RECLAIM_DELAY_MS);
  const marked = scheduleMediaReclaim(post.id, at);
  if (marked > 0) {
    logger.info(
      "media",
      `Post #${post.id} pubblicato: ${marked} media verranno rimossi dal disco dopo il ${at.toLocaleString("it-IT")}`,
      undefined,
      post.userId
    );
  }
}

/**
 * Toglie dal disco i media scaduti (pubblicati da oltre un giorno e non usati
 * da nessun contenuto in coda). Chiamata periodicamente dallo scheduler.
 * Disattivabile per utente con `autoCleanupMedia` = "off" (Impostazioni →
 * Spazio): l'impostazione si legge qui, non alla programmazione, così
 * disattivarla salva anche i media già marcati.
 */
export async function sweepReclaimableMedia(now = new Date()): Promise<number> {
  const freed = new Map<number, { bytes: number; count: number }>();
  for (const media of dueReclaimableMedia(now)) {
    if (getSetting(media.userId, "autoCleanupMedia", "on") !== "on") continue;
    deleteMediaSystem(media.id);
    await deleteFile(media.filename);
    const acc = freed.get(media.userId) ?? { bytes: 0, count: 0 };
    freed.set(media.userId, { bytes: acc.bytes + media.size, count: acc.count + 1 });
  }
  let total = 0;
  for (const [userId, { bytes, count }] of freed) {
    total += count;
    logger.info(
      "media",
      `Pulizia automatica: rimossi ${count} media dal disco (${(bytes / 1024 / 1024).toFixed(1)} MB liberati)`,
      undefined,
      userId
    );
  }
  return total;
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
  const status = computePostStatus(updated.targets.map((t) => t.status));
  setPostStatus(postId, status);
  if (status === "published") scheduleMediaCleanup(updated);
  return getPostSystem(postId);
}
