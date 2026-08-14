/**
 * Modulo TikTok — Content Posting API (Direct Post, upload da file).
 * Richiede un'app su developers.tiktok.com con lo scope video.publish approvato.
 * Nota: finché l'app TikTok non è "audited", i post vengono creati come privati.
 */
import fs from "node:fs";
import type { Account } from "@/types";
import { apiFetch, type PublishInput, type PublishResult, type SocialModule, type TokenSet } from "../types";
import { refreshWithToken } from "../oauth";

const API = "https://open.tiktokapis.com/v2";

export const tiktokModule: SocialModule = {
  platform: "tiktok",
  displayName: "TikTok",
  color: "#010101",
  limits: {
    maxChars: 2200,
    requiresMedia: true,
    supportsTitle: true,
    mediaTypes: ["video"],
    maxMedia: 1,
    // WebM non è accettato: le registrazioni in-app vanno convertite in MP4.
    mimeTypes: ["video/mp4", "video/quicktime"],
  },
  oauth: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: `${API}/oauth/token/`,
    scopes: ["user.info.basic", "video.publish"],
    clientIdParam: "client_key",
    scopeSeparator: ",",
  },

  async fetchAccount(tokens: TokenSet) {
    // Nota: il campo `username` richiede lo scope `user.info.profile`, che l'app
    // non chiede. Restiamo su open_id e display_name (coperti da user.info.basic).
    const info = await apiFetch(
      `${API}/user/info/?fields=open_id,display_name`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
    );
    const user = (info.data as { user?: Record<string, unknown> })?.user || {};
    return {
      accountId: (user.open_id as string) || "",
      accountName: (user.display_name as string) || "Account TikTok",
      meta: {},
    };
  },

  async publish(input: PublishInput, account: Account): Promise<PublishResult> {
    const video = input.media.find((m) => m.kind === "video");
    if (!video) throw new Error("TikTok richiede un video.");

    // 1) inizializza il direct post con upload da file
    const init = await apiFetch(`${API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: (input.title || input.body).slice(0, 150),
          privacy_level: "SELF_ONLY", // diventa PUBLIC_TO_EVERYONE quando l'app è approvata
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: video.size,
          chunk_size: video.size,
          total_chunk_count: 1,
        },
      }),
    });
    const data = init.data as { publish_id?: string; upload_url?: string } | undefined;
    if (!data?.upload_url || !data?.publish_id) {
      throw new Error(`TikTok: init pubblicazione fallito — ${JSON.stringify(init).slice(0, 300)}`);
    }

    // 2) upload del video in un unico chunk
    const buf = await fs.promises.readFile(video.path);
    const up = await fetch(data.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": video.mime,
        "Content-Length": String(buf.length),
        "Content-Range": `bytes 0-${buf.length - 1}/${buf.length}`,
      },
      body: new Uint8Array(buf),
    });
    if (!up.ok) {
      throw new Error(`TikTok: upload video fallito (HTTP ${up.status})`);
    }

    return { externalId: data.publish_id, externalUrl: undefined };
  },

  async verifyToken(account: Account) {
    try {
      const info = await apiFetch(`${API}/user/info/?fields=display_name`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      const user = (info.data as { user?: { display_name?: string } })?.user;
      return { ok: true, message: `Token valido (${user?.display_name || "ok"})` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  async refresh(account: Account) {
    if (!account.refreshToken) return null;
    return refreshWithToken("tiktok", `${API}/oauth/token/`, account.refreshToken, "client_key");
  },
};
