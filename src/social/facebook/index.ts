/**
 * Modulo Facebook — pubblica sulla Pagina tramite Meta Graph API.
 * Richiede un'app Meta con "Facebook Login for Business" e una Pagina gestita.
 * Alla connessione viene scelta la prima Pagina dell'utente e salvato
 * il suo page access token in `meta`.
 */
import fs from "node:fs";
import type { Account } from "@/types";
import { apiFetch, type PublishInput, type PublishResult, type SocialModule, type TokenSet } from "../types";
import { env } from "@/lib/env";

const GRAPH = "https://graph.facebook.com/v21.0";

async function uploadMultipart(
  url: string,
  fields: Record<string, string>,
  file?: { path: string; mime: string; name: string; field: string }
): Promise<Record<string, unknown>> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) {
    const buf = await fs.promises.readFile(file.path);
    form.append(file.field, new Blob([buf], { type: file.mime }), file.name);
  }
  const res = await fetch(url, { method: "POST", body: form });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string })?.message || JSON.stringify(json).slice(0, 300);
    throw new Error(`Facebook: ${msg}`);
  }
  return json;
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
  limits: { maxChars: 63206, requiresMedia: false, supportsTitle: false, mediaTypes: ["image", "video"], maxMedia: 10 },
  oauth: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "business_management"],
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

    // Video: upload diretto multipart
    if (videos.length > 0) {
      const v = videos[0];
      const json = await uploadMultipart(
        `${GRAPH}/${pageId}/videos`,
        { description: message, access_token: pageToken },
        { path: v.path, mime: v.mime, name: "video.mp4", field: "source" }
      );
      return { externalId: json.id as string, externalUrl: `https://www.facebook.com/${json.id}` };
    }

    // Una o più immagini: upload non pubblicato + post con attached_media
    if (images.length > 0) {
      const mediaIds: string[] = [];
      for (const img of images) {
        const json = await uploadMultipart(
          `${GRAPH}/${pageId}/photos`,
          { published: "false", access_token: pageToken },
          { path: img.path, mime: img.mime, name: "photo.jpg", field: "source" }
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
};
