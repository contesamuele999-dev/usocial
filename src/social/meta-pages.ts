/**
 * Quale Pagina collegare quando lo stesso profilo Facebook gestisce più brand.
 *
 * Meta tiene UNA sola autorizzazione per persona e app: due account uSocial
 * (un brand ciascuno) collegati con lo stesso profilo Facebook condividono il
 * consenso. Due conseguenze:
 *
 *  1. `/me/accounts` restituisce le Pagine di entrambi i brand, e prendere la
 *     prima collegava il brand sbagliato. Si salta quella già usata da un altro
 *     account uSocial.
 *  2. Se in "Modifica accesso" si spunta solo la Pagina del brand nuovo, Meta
 *     toglie l'accesso a quella dell'altro, e lì la pubblicazione muore con
 *     `(190) ... before impersonating a user's page`. Non si può impedire da
 *     qui: si avvisa subito, invece di scoprirlo alla prima storia fallita.
 */
import { allAccountsSystem } from "@/lib/repo";
import type { Platform } from "@/types";

export function pickPage<T extends { id: string }>(
  /** Tutte le Pagine concesse in questo consenso. */
  pages: T[],
  platform: Platform,
  userId: number,
  /** Id Facebook della persona che ha appena fatto il login. */
  metaUserId: string,
  usable: (page: T) => boolean = () => true
): { page: T | undefined; lost: string[] } {
  const others = allAccountsSystem()
    .filter((a) => a.platform === platform && a.userId !== userId)
    .map((a) => ({ account: a, meta: JSON.parse(a.meta || "{}") }));
  const taken = new Set(others.map((o) => o.meta.pageId as string));
  const candidates = pages.filter(usable);
  const granted = new Set(pages.map((p) => p.id));

  return {
    page: candidates.find((p) => !taken.has(p.id)) ?? candidates[0],
    lost: others
      .filter(
        (o) =>
          (o.meta.metaUserId ?? o.account.accountId) === metaUserId &&
          o.meta.pageId &&
          !granted.has(o.meta.pageId)
      )
      .map((o) => (o.meta.pageName as string) || o.account.accountName),
  };
}
