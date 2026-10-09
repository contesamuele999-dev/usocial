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
import { AppError } from "@/lib/errors";
import { allAccountsSystem, saveAccount } from "@/lib/repo";
import type { Account, Platform } from "@/types";
import { apiFetch } from "./types";

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

// ---------------------------------------------------------------------------
// Scelta a mano, dalle Impostazioni. La scelta automatica sopra indovina; qui
// decide l'utente fra le Pagine concesse, senza rifare il login.

const GRAPH = "https://graph.facebook.com/v21.0";

interface GrantedPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username: string };
}

async function grantedPages(account: Account): Promise<GrantedPage[]> {
  const res = await apiFetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${account.accessToken}`
  );
  const pages = (res.data as GrantedPage[] | undefined) || [];
  return account.platform === "instagram" ? pages.filter((p) => p.instagram_business_account) : pages;
}

const label = (account: Account, p: GrantedPage) =>
  account.platform === "instagram" ? `@${p.instagram_business_account!.username}` : p.name;

/** Pagine (o account Instagram) fra cui scegliere, con quella in uso segnata. */
export async function listPages(account: Account) {
  const current = JSON.parse(account.meta || "{}").pageId;
  return (await grantedPages(account)).map((p) => ({
    id: p.id,
    name: label(account, p),
    selected: p.id === current,
  }));
}

/** Punta l'account su un'altra Pagina concessa e lo salva. */
export async function selectPage(account: Account, pageId: string): Promise<Account> {
  const page = (await grantedPages(account)).find((p) => p.id === pageId);
  if (!page) {
    throw new AppError(
      "Questa Pagina non è fra quelle concesse: ricollega e spuntala in «Modifica accesso»."
    );
  }
  const meta = JSON.parse(account.meta || "{}");
  Object.assign(meta, { pageId: page.id, pageToken: page.access_token, pageName: label(account, page) });
  if (account.platform === "instagram") {
    const ig = page.instagram_business_account!;
    Object.assign(meta, { igUserId: ig.id, username: ig.username });
    account.accountId = ig.id;
    account.accountName = `@${ig.username}`;
  } else {
    account.accountName = account.accountName.replace(/→.*$/, `→ ${page.name}`);
  }
  account.meta = JSON.stringify(meta);
  saveAccount(account);
  return account;
}
