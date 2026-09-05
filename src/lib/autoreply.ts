/**
 * Risponditore automatico ai commenti.
 *
 * Lo schema è quello di "commenta PAUSA e ti mando la guida": una regola
 * riconosce una parola chiave nei commenti dei post pubblicati e risponde —
 * pubblicamente sotto al commento, in privato a chi l'ha scritto, o entrambi.
 *
 * Tre cose che non sono dettagli:
 *
 *  1. **Non deve rispondersi da solo.** La risposta pubblica è a sua volta un
 *     commento: senza escludere l'autore-account il motore si innescherebbe in
 *     un ciclo, rispondendo alla propria risposta a ogni giro.
 *  2. **Un commento si tratta una volta sola.** Ogni commento esaminato viene
 *     registrato, anche quando nessuna regola combacia: il motore rilegge gli
 *     stessi commenti a ogni passaggio, e Meta accetta comunque un solo
 *     messaggio privato per commento.
 *  3. **La finestra di 7 giorni.** Il messaggio privato agganciato a un
 *     commento Meta lo accetta entro una settimana; dopo, si ripiega sulla sola
 *     risposta pubblica invece di collezionare errori.
 */
import { AppError } from "./errors";
import { logger } from "./logger";
import {
  getAccount,
  listAutoReplyRules,
  type AutoReplyRuleInput,
  metricTargets,
  recordCommentReply,
  seenCommentIds,
  type AutoReplyRule,
} from "./repo";
import { getModule } from "@/social/registry";
import type { SocialComment } from "@/social/types";
import { PLATFORMS, type Platform } from "@/types";

/**
 * Valida e normalizza una regola arrivata dalla UI o da un agente.
 *
 * Vive qui e non nella rotta perché Next ammette solo export noti nei file di
 * rotta, e perché una regola mal scritta è ciò che separa un messaggio utile
 * da un DM mandato a chi non ha chiesto niente.
 */
export function parseRule(body: Record<string, unknown>): AutoReplyRuleInput {
  const keyword = String(body.keyword || "").trim();
  if (!keyword) throw new AppError("Serve una parola chiave da riconoscere nei commenti.");
  if (keyword.length > 60) throw new AppError("La parola chiave è troppo lunga (max 60 caratteri).");

  const publicReply = String(body.publicReply || "").trim();
  const privateReply = String(body.privateReply || "").trim();
  if (!publicReply && !privateReply) {
    throw new AppError("Scrivi almeno una risposta: pubblica, privata o entrambe.");
  }

  const platforms = Array.isArray(body.platforms)
    ? (body.platforms.filter((p) => PLATFORMS.includes(p as Platform)) as Platform[])
    : [];

  return {
    name: String(body.name || "").trim().slice(0, 80),
    keyword,
    matchMode: body.matchMode === "contains" ? "contains" : "word",
    platforms,
    publicReply: publicReply.slice(0, 1000),
    privateReply: privateReply.slice(0, 1000),
    enabled: !!body.enabled,
  };
}

/** Da quanto indietro si guardano i post: oltre, i commenti sono comunque fuori finestra. */
export const LOOKBACK_DAYS = 7;

/** Tetto di risposte per esecuzione: un post virale non deve svuotare la quota API. */
const MAX_REPLIES_PER_RUN = 30;

/**
 * La parola chiave combacia col testo del commento?
 *
 * `word` cerca la parola intera, così "PAUSA" non scatta dentro
 * "pausapranzo"; i confini sono definiti a mano perché `\b` di JavaScript non
 * considera lettere accentate e la chiave potrebbe essere "PERCHÉ".
 */
export function matches(text: string, keyword: string, mode: "word" | "contains"): boolean {
  const haystack = text.toLowerCase();
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;
  if (mode === "contains") return haystack.includes(needle);

  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) return false;
    const before = haystack[i - 1];
    const after = haystack[i + needle.length];
    const isLetter = (c: string | undefined) => !!c && /[\p{L}\p{N}_]/u.test(c);
    if (!isLetter(before) && !isLetter(after)) return true;
    from = i + 1;
  }
}

/** Prima regola attiva che combacia con questo commento su questa piattaforma. */
export function ruleFor(
  comment: SocialComment,
  rules: AutoReplyRule[],
  platform: Platform
): AutoReplyRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.platforms.length > 0 && !rule.platforms.includes(platform)) continue;
    if (matches(comment.text, rule.keyword, rule.matchMode)) return rule;
  }
  return null;
}

/** Sostituisce i segnaposto ammessi nel testo della risposta. */
export function fillTemplate(template: string, comment: SocialComment): string {
  return template.replace(/\{autore\}|\{author\}/g, comment.author ? `@${comment.author}` : "");
}

/** Il commento è ancora dentro la finestra in cui la piattaforma accetta il DM? */
export function withinPrivateWindow(
  comment: SocialComment,
  windowHours: number | undefined,
  now = Date.now()
): boolean {
  if (!windowHours) return true;
  const age = now - new Date(comment.createdAt).getTime();
  return Number.isFinite(age) ? age <= windowHours * 3600_000 : true;
}

export interface AutoReplyResult {
  /** Commenti nuovi esaminati. */
  scanned: number;
  /** Commenti a cui è stata data una risposta (pubblica, privata o entrambe). */
  replied: number;
  /** Messaggi privati effettivamente inviati. */
  privateSent: number;
  failed: number;
  errors: { platform: Platform; message: string }[];
  /** In simulazione non viene inviato nulla: si registra solo cosa succederebbe. */
  simulated: boolean;
  /** Anteprima di cosa verrebbe mandato (solo in simulazione). */
  preview: {
    platform: Platform;
    author: string;
    text: string;
    rule: string;
    publicReply: string;
    privateReply: string;
  }[];
}

/**
 * Esegue un giro del risponditore per un utente.
 *
 * `simulate` legge i commenti e decide cosa farebbe, senza mandare niente e
 * senza consumare la finestra dei 7 giorni: serve a vedere cosa direbbero le
 * regole prima di puntarle su persone vere.
 */
export async function runAutoReply(userId: number, simulate = false): Promise<AutoReplyResult> {
  const res: AutoReplyResult = {
    scanned: 0,
    replied: 0,
    privateSent: 0,
    failed: 0,
    errors: [],
    simulated: simulate,
    preview: [],
  };

  const rules = listAutoReplyRules(userId).filter((r) => simulate || r.enabled);
  if (rules.length === 0) return res;

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
  const targets = metricTargets(since, userId);
  /** Un errore per piattaforma: sono tutti lo stesso problema di permessi. */
  const reported = new Set<Platform>();
  /** Commenti già visti, caricati una volta sola per piattaforma. */
  const seen = new Map<Platform, Set<string>>();

  for (const target of targets) {
    if (res.replied >= MAX_REPLIES_PER_RUN) break;

    const mod = getModule(target.platform);
    if (!mod.comments || !mod.listComments) continue;
    const account = getAccount(userId, target.platform);
    if (!account) continue;
    // Nessuna regola vale per questa piattaforma: inutile chiamare l'API.
    const applicable = rules.filter(
      (r) => r.platforms.length === 0 || r.platforms.includes(target.platform)
    );
    if (applicable.length === 0) continue;

    if (!seen.has(target.platform)) seen.set(target.platform, seenCommentIds(userId, target.platform));
    const already = seen.get(target.platform)!;

    let comments: SocialComment[];
    try {
      comments = await mod.listComments(account, target.externalId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!reported.has(target.platform)) {
        reported.add(target.platform);
        res.errors.push({ platform: target.platform, message });
      }
      continue;
    }

    for (const comment of comments) {
      if (already.has(comment.id)) continue;
      // Un commento nostro: è la risposta che abbiamo scritto noi. Trattarlo
      // come nuovo significherebbe rispondere a se stessi, all'infinito.
      if (comment.authorId && comment.authorId === account.accountId) {
        already.add(comment.id);
        continue;
      }
      if (res.replied >= MAX_REPLIES_PER_RUN) break;

      res.scanned++;
      const rule = ruleFor(comment, applicable, target.platform);

      const base = {
        userId,
        platform: target.platform,
        commentId: comment.id,
        targetId: target.targetId,
        postId: target.postId,
        author: comment.author,
        text: comment.text,
      };

      if (!rule) {
        // Si registra anche il "niente da fare": al giro dopo non va riesaminato.
        if (!simulate) recordCommentReply({ ...base, ruleId: null, status: "skipped" });
        already.add(comment.id);
        continue;
      }

      const publicText = fillTemplate(rule.publicReply, comment);
      const privateText = fillTemplate(rule.privateReply, comment);
      const canPrivate =
        !!privateText &&
        !!mod.comments.privateReply &&
        !!mod.privateReply &&
        withinPrivateWindow(comment, mod.comments.privateReplyWindowHours);

      if (simulate) {
        res.preview.push({
          platform: target.platform,
          author: comment.author,
          text: comment.text.slice(0, 120),
          rule: rule.name || rule.keyword,
          publicReply: publicText,
          privateReply: canPrivate ? privateText : "",
        });
        res.replied++;
        already.add(comment.id);
        continue;
      }

      const done: string[] = [];
      const problems: string[] = [];

      // Le due azioni sono INDIPENDENTI di proposito. Il permesso sui messaggi
      // (pages_messaging / instagram_manage_messages) si concede a parte e può
      // benissimo mancare: se un DM fallito impedisse anche la risposta
      // pubblica, ogni singolo commento finirebbe in errore e sotto al post
      // non comparirebbe niente.
      if (canPrivate) {
        try {
          await mod.privateReply!(account, comment, privateText);
          done.push("DM");
          res.privateSent++;
        } catch (err) {
          problems.push(`DM: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (publicText && mod.replyToComment) {
        try {
          await mod.replyToComment(account, comment.id, publicText);
          done.push("risposta pubblica");
        } catch (err) {
          problems.push(
            `risposta pubblica: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      const status = done.length ? "replied" : problems.length ? "failed" : "skipped";
      if (done.length) res.replied++;
      if (problems.length) {
        res.failed++;
        const first = problems[0];
        if (!reported.has(target.platform)) {
          reported.add(target.platform);
          res.errors.push({ platform: target.platform, message: first });
        }
      }
      // Registrato in ogni caso: senza, il commento verrebbe riesaminato a
      // ogni giro e un DM già partito ne farebbe partire un altro.
      recordCommentReply({
        ...base,
        ruleId: rule.id,
        status,
        detail:
          [done.length ? `inviato: ${done.join(" + ")}` : "", ...problems]
            .filter(Boolean)
            .join(" · ") || "nessuna azione configurata",
      });

      already.add(comment.id);
    }
  }

  if (!simulate && (res.replied > 0 || res.failed > 0)) {
    logger.info(
      "autoreply",
      `Risposte automatiche: ${res.replied} commenti gestiti (${res.privateSent} messaggi privati), ${res.failed} falliti`,
      res.errors.length ? JSON.stringify(res.errors) : undefined,
      userId
    );
  }
  return res;
}
