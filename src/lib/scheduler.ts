/**
 * Scheduler dei post. Ogni 60 secondi:
 *  1) pubblica i post programmati la cui ora è arrivata (primo tentativo);
 *  2) ritenta i target falliti il cui backoff è scaduto (retry automatico).
 * All'avvio recupera le pubblicazioni interrotte da un riavvio.
 * Avviato una sola volta da src/instrumentation.ts.
 */
import { logger } from "./logger";

const INTERVAL_MS = 60_000;
/** Ogni ora si controllano i token social vicini alla scadenza. */
const TOKEN_INTERVAL_MS = 3600_000;

export function startScheduler() {
  const g = globalThis as unknown as { __usocialScheduler?: boolean };
  if (g.__usocialScheduler) return; // evita doppio avvio con l'hot-reload
  g.__usocialScheduler = true;

  logger.info("scheduler", "Scheduler avviato (controllo ogni 60s, retry automatico attivo)");

  // Recupero all'avvio: pubblicazioni rimaste "a metà" per un crash/riavvio.
  void recover();

  let running = false; // evita che due tick si sovrappongano (pubblicazioni lente)
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { duePosts, dueRetryTargetsByPost } = await import("./repo");
      const { publishPost } = await import("@/social/publisher");
      const now = new Date();

      // 1) post programmati arrivati a scadenza
      for (const post of duePosts(now)) {
        logger.info("scheduler", `Pubblico il post programmato #${post.id} "${post.title}"`);
        await publishPost(post.id);
      }

      // 2) retry dei target falliti pronti per un nuovo tentativo
      for (const [postId, targetIds] of dueRetryTargetsByPost(now)) {
        logger.info("scheduler", `Ritento ${targetIds.length} pubblicazione/i del post #${postId}`);
        await publishPost(postId, { onlyTargetIds: targetIds });
      }
    } catch (err) {
      logger.error("scheduler", "Errore nel tick dello scheduler", String(err));
    } finally {
      running = false;
    }
  };

  setInterval(tick, INTERVAL_MS);
  setTimeout(tick, 5_000); // primo controllo poco dopo l'avvio

  // Rinnovo proattivo dei token: senza questo, un post programmato fra mesi
  // troverebbe l'access token scaduto (TikTok 24 h, Google 1 h).
  const refreshTick = async () => {
    try {
      const { refreshExpiringAccounts } = await import("@/social/tokens");
      const n = await refreshExpiringAccounts();
      if (n > 0) logger.info("scheduler", `Rinnovati ${n} token social in scadenza`);
    } catch (err) {
      logger.error("scheduler", "Errore nel rinnovo dei token", String(err));
    }
  };
  setInterval(refreshTick, TOKEN_INTERVAL_MS);
  setTimeout(refreshTick, 15_000);
}

/** Rimette in coda i target rimasti in "publishing" (interrotti da un riavvio). */
async function recover() {
  try {
    const { recoverInterruptedTargets } = await import("./repo");
    const recovered = recoverInterruptedTargets(new Date());
    if (recovered.length > 0) {
      logger.warn(
        "scheduler",
        `Recuperate ${recovered.length} pubblicazioni interrotte da un riavvio: verranno ritentate`
      );
    }
  } catch (err) {
    logger.error("scheduler", "Recupero pubblicazioni interrotte fallito", String(err));
  }
}
