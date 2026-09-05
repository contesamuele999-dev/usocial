/**
 * Modulo Facebook — pubblica sulla Pagina tramite Meta Graph API.
 * Richiede un'app Meta con "Facebook Login for Business" e una Pagina gestita.
 * Alla connessione viene scelta la prima Pagina dell'utente e salvato
 * il suo page access token in `meta`.
 */
import type { Account } from "@/types";
import {
  apiFetch,
  type PostMetrics,
  type PublishInput,
  type SocialComment,
  type PublishMedia,
  type PublishResult,
  type SocialModule,
  type TokenSet,
} from "../types";
import { env } from "@/lib/env";
import { fileBlob, fileBlobRange } from "../upload";

/**
 * I permessi sui MESSAGGI non esistono finché l'app Meta non ha il prodotto
 * **Messenger**: chiederli comunque fa rispondere a Facebook
 * "Invalid Scopes: pages_messaging" alla schermata di consenso. Il login
 * prosegue (Meta ignora i permessi non validi), ma l'avviso comparirebbe a
 * ogni connessione — e il messaggio privato non funzionerebbe lo stesso.
 *
 * Quindi sono opt-in: aggiungi Messenger all'app, poi metti
 * META_SCOPE_MESSAGING=true nel .env e ricollega. Senza, il risponditore usa
 * la sola risposta pubblica, che non richiede nulla di tutto questo.
 */
const MESSAGING = process.env.META_SCOPE_MESSAGING === "true";

const GRAPH = "https://graph.facebook.com/v21.0";

async function uploadMultipart(
  url: string,
  fields: Record<string, string>,
  file?: { blob: Blob; name: string; field: string }
): Promise<Record<string, unknown>> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) {
    // Blob agganciato al file: i byte restano su disco (un reel da 114 MB in
    // RAM faceva finire il processo in OOM).
    form.append(file.field, file.blob, file.name);
  }
  const res = await fetch(url, { method: "POST", body: form });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string })?.message || JSON.stringify(json).slice(0, 300);
    throw new Error(`Facebook: ${msg}`);
  }
  return json;
}

/**
 * Video: upload resumable a fasi (start → transfer → finish).
 *
 * Perché: il POST multipart in un colpo solo su `/{page}/videos` non regge i
 * file grandi (timeout / errore lato Meta) e ogni retry ricaricava il video da
 * zero. Qui le fette sono decise dal server tramite `start_offset`/`end_offset`.
 */
async function publishVideo(
  pageId: string,
  pageToken: string,
  video: PublishMedia,
  message: string
): Promise<PublishResult> {
  const url = `${GRAPH}/${pageId}/videos`;

  const start = await apiFetch(url, {
    method: "POST",
    body: new URLSearchParams({
      upload_phase: "start",
      file_size: String(video.size),
      access_token: pageToken,
    }),
  });
  const sessionId = start.upload_session_id as string;
  const videoId = start.video_id as string;
  if (!sessionId || !videoId) {
    throw new Error(`Facebook: avvio upload video fallito — ${JSON.stringify(start).slice(0, 300)}`);
  }

  let offset = Number(start.start_offset);
  let endOffset = Number(start.end_offset);
  while (offset < endOffset) {
    const json = await uploadMultipart(
      url,
      {
        upload_phase: "transfer",
        upload_session_id: sessionId,
        start_offset: String(offset),
        access_token: pageToken,
      },
      {
        blob: await fileBlobRange(video.path, video.mime, offset, endOffset),
        name: "chunk.mp4",
        field: "video_file_chunk",
      }
    );
    const next = Number(json.start_offset);
    // Senza questo controllo un server che non avanza manderebbe il ciclo
    // all'infinito, tenendo occupato lo scheduler.
    if (!Number.isFinite(next) || next <= offset) {
      throw new Error(`Facebook: upload video bloccato all'offset ${offset}.`);
    }
    offset = next;
    endOffset = Number(json.end_offset);
  }

  const finish = await apiFetch(url, {
    method: "POST",
    body: new URLSearchParams({
      upload_phase: "finish",
      upload_session_id: sessionId,
      description: message,
      access_token: pageToken,
    }),
  });
  if (finish.success === false) {
    throw new Error(`Facebook: pubblicazione video non confermata — ${JSON.stringify(finish).slice(0, 300)}`);
  }
  return { externalId: videoId, externalUrl: `https://www.facebook.com/${videoId}` };
}

function pageAuth(account: Account): { pageId: string; pageToken: string } {
  const meta = JSON.parse(account.meta || "{}");
  if (!meta.pageId || !meta.pageToken) {
    throw new Error("Nessuna Pagina Facebook collegata: riconnetti l'account nelle Impostazioni.");
  }
  return { pageId: meta.pageId, pageToken: meta.pageToken };
}

export const facebookModule: SocialModule = {
  platform: "facebook",
  displayName: "Facebook",
  color: "#1877F2",
  limits: {
    maxChars: 63206,
    requiresMedia: false,
    supportsTitle: false,
    mediaTypes: ["image", "video"],
    maxMedia: 10,
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime"],
    // ponytail: solo il feed. Reels e Storie della Pagina usano endpoint
    // separati (/video_reels e /photo_stories, upload in più fasi): si
    // aggiungono quando servono davvero, non prima.
    postTypes: ["feed"],
  },
  oauth: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "business_management",
      // Impression e click del post nella pagina Statistiche. Aggiungerlo
      // obbliga a ricollegare l'account: i permessi si concedono al consenso.
      "read_insights",
      // Risponditore automatico: leggere e rispondere ai commenti della Pagina.
      "pages_manage_engagement",
      ...(MESSAGING ? ["pages_messaging"] : []),
    ],
    scopeSeparator: ",",
  },

  async fetchAccount(tokens: TokenSet) {
    // Scambia con un token long-lived (60 giorni)
    const { clientId, clientSecret } = env.oauth("facebook");
    const ll = await apiFetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokens.accessToken}`
    );
    const longToken = (ll.access_token as string) || tokens.accessToken;
    tokens.accessToken = longToken;
    tokens.expiresIn = (ll.expires_in as number) || 60 * 24 * 3600;

    const me = await apiFetch(`${GRAPH}/me?fields=id,name&access_token=${longToken}`);
    const pages = await apiFetch(`${GRAPH}/me/accounts?access_token=${longToken}`);
    const first = (pages.data as Record<string, unknown>[] | undefined)?.[0];
    if (!first) throw new Error("Nessuna Pagina Facebook trovata per questo utente.");
    return {
      accountId: me.id as string,
      accountName: `${me.name} → Pagina: ${first.name}`,
      meta: { pageId: first.id, pageToken: first.access_token, pageName: first.name },
    };
  },

  async publish(input: PublishInput, account: Account): Promise<PublishResult> {
    const { pageId, pageToken } = pageAuth(account);
    const message = input.body;
    const images = input.media.filter((m) => m.kind === "image");
    const videos = input.media.filter((m) => m.kind === "video");

    // Video: upload resumable a chunk
    if (videos.length > 0) return publishVideo(pageId, pageToken, videos[0], message);

    // Una o più immagini: upload non pubblicato + post con attached_media
    if (images.length > 0) {
      const mediaIds: string[] = [];
      for (const img of images) {
        const json = await uploadMultipart(
          `${GRAPH}/${pageId}/photos`,
          { published: "false", access_token: pageToken },
          { blob: await fileBlob(img.path, img.mime), name: "photo.jpg", field: "source" }
        );
        mediaIds.push(json.id as string);
      }
      const body = new URLSearchParams({ message, access_token: pageToken });
      mediaIds.forEach((id, i) => body.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
      const json = await apiFetch(`${GRAPH}/${pageId}/feed`, { method: "POST", body });
      return { externalId: json.id as string, externalUrl: `https://www.facebook.com/${json.id}` };
    }

    // Solo testo
    const body = new URLSearchParams({ message, access_token: pageToken });
    const json = await apiFetch(`${GRAPH}/${pageId}/feed`, { method: "POST", body });
    return { externalId: json.id as string, externalUrl: `https://www.facebook.com/${json.id}` };
  },

  async verifyToken(account: Account) {
    try {
      const me = await apiFetch(`${GRAPH}/me?fields=name&access_token=${account.accessToken}`);
      return { ok: true, message: `Token valido (${me.name})` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  /**
   * Metriche di un post della Pagina.
   *
   * Le due chiamate sono indipendenti: i contatori pubblici richiedono
   * `pages_read_engagement`, gli insight `read_insights`, e i due permessi si
   * concedono separatamente. Prima, se mancava il primo, si perdevano anche
   * impression e copertura che il token poteva benissimo leggere.
   */
  async insights(account: Account, externalId: string): Promise<PostMetrics> {
    const { pageId, pageToken } = pageAuth(account);
    const out: PostMetrics = {};
    let letto = false;
    let primoErrore: unknown = null;

    /**
     * `shares` non esiste su tutti i tipi di post: su alcuni (foto, contenuti
     * senza condivisioni) Meta risponde
     * "(#100) Tried accessing nonexisting field (shares)" e butta via anche
     * like e commenti, che invece ci sarebbero. Quindi: prima si chiede tutto,
     * e solo se il campo non esiste si ripiega sui contatori sicuri.
     */
    const readCounters = async (withShares: boolean) => {
      const fields = [
        "likes.summary(true).limit(0)",
        "comments.summary(true).limit(0)",
        ...(withShares ? ["shares"] : []),
      ].join(",");
      const base = await apiFetch(
        `${GRAPH}/${externalId}?fields=${fields}&access_token=${pageToken}`
      );
      const summary = (k: string) =>
        ((base[k] as { summary?: { total_count?: number } } | undefined)?.summary?.total_count) ??
        undefined;
      out.likes = summary("likes");
      out.comments = summary("comments");
      if (withShares) {
        out.shares = (base.shares as { count?: number } | undefined)?.count ?? undefined;
      }
      letto = true;
    };

    try {
      await readCounters(true);
    } catch (err) {
      if (String(err).includes("nonexisting field")) {
        try {
          await readCounters(false);
        } catch (retry) {
          primoErrore = retry;
        }
      } else {
        primoErrore = err;
      }
    }

    try {
      const res = await apiFetch(
        `${GRAPH}/${externalId}/insights?metric=post_impressions,post_impressions_unique,post_clicks&access_token=${pageToken}`
      );
      const data = (res.data as { name: string; values?: { value: number }[] }[]) || [];
      const val = (n: string) => data.find((d) => d.name === n)?.values?.[0]?.value;
      out.views = val("post_impressions");
      out.reach = val("post_impressions_unique");
      out.clicks = val("post_clicks");
      letto = true;
    } catch (err) {
      primoErrore = primoErrore ?? err;
    }

    // Nessuna delle due ha funzionato: è un problema di permessi vero, va
    // riportato con il messaggio originale di Meta (dice quale manca).
    if (!letto) throw primoErrore;

    try {
      const page = await apiFetch(
        `${GRAPH}/${pageId}?fields=followers_count&access_token=${pageToken}`
      );
      out.followers = (page.followers_count as number) ?? undefined;
    } catch {
      /* niente follower della Pagina */
    }
    return out;
  },

  comments: {
    publicReply: true,
    privateReply: MESSAGING,
    privateReplyWindowHours: 24 * 7,
  },

  async listComments(account: Account, externalId: string): Promise<SocialComment[]> {
    const { pageToken } = pageAuth(account);
    const res = await apiFetch(
      `${GRAPH}/${externalId}/comments?fields=id,message,created_time,from{id,name}&limit=100&access_token=${pageToken}`
    );
    const data = (res.data as Record<string, unknown>[]) || [];
    return data.map((c) => {
      const from = c.from as { id?: string; name?: string } | undefined;
      return {
        id: c.id as string,
        text: (c.message as string) || "",
        author: from?.name || "",
        authorId: from?.id,
        createdAt: (c.created_time as string) || new Date().toISOString(),
      };
    });
  },

  async replyToComment(account: Account, commentId: string, message: string) {
    const { pageToken } = pageAuth(account);
    await apiFetch(`${GRAPH}/${commentId}/comments`, {
      method: "POST",
      body: new URLSearchParams({ message, access_token: pageToken }),
    });
  },

  async privateReply(account: Account, comment: SocialComment, message: string) {
    const { pageToken } = pageAuth(account);
    await apiFetch(`${GRAPH}/${comment.id}/private_replies`, {
      method: "POST",
      body: new URLSearchParams({ message, access_token: pageToken }),
    });
  },

  /**
   * Meta non usa refresh token: il token long-lived (60 giorni) si estende
   * riscambiandolo con se stesso. Rinnovandolo periodicamente la connessione
   * resta valida a tempo indeterminato senza riautorizzare.
   * Il page token salvato in `meta` non scade finché il token utente è valido.
   */
  async refresh(account: Account): Promise<TokenSet> {
    const { clientId, clientSecret } = env.oauth("facebook");
    const r = await apiFetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${account.accessToken}`
    );
    return {
      accessToken: r.access_token as string,
      refreshToken: account.refreshToken,
      expiresIn: (r.expires_in as number) || 60 * 24 * 3600,
    };
  },
};
