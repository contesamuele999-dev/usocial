/**
 * Modulo YouTube — upload video via YouTube Data API v3 (upload resumable).
 * Richiede un progetto Google Cloud con la YouTube Data API abilitata.
 * Il refresh token viene ottenuto con access_type=offline&prompt=consent.
 */
import fs from "node:fs";
import type { Account } from "@/types";
import { apiFetch, type PublishInput, type PublishResult, type SocialModule, type TokenSet } from "../types";
import { refreshWithToken } from "../oauth";

export const youtubeModule: SocialModule = {
  platform: "youtube",
  displayName: "YouTube",
  color: "#FF0000",
  limits: { maxChars: 5000, requiresMedia: true, supportsTitle: true, mediaTypes: ["video"], maxMedia: 1 },
  oauth: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },

  async fetchAccount(tokens: TokenSet) {
    const ch = await apiFetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
    );
    const first = (ch.items as Record<string, unknown>[] | undefined)?.[0];
    if (!first) throw new Error("Nessun canale YouTube trovato per questo account Google.");
    const snippet = first.snippet as { title: string };
    return {
      accountId: first.id as string,
      accountName: snippet.title,
      meta: { channelId: first.id },
    };
  },

  async publish(input: PublishInput, account: Account): Promise<PublishResult> {
    const video = input.media.find((m) => m.kind === "video");
    if (!video) throw new Error("YouTube richiede un video.");

    const metadata = {
      snippet: {
        title: input.title || input.body.slice(0, 90) || "Video",
        description: input.body,
        categoryId: "22", // People & Blogs
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    };

    // 1) inizializza la sessione di upload resumable
    const init = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": video.mime,
          "X-Upload-Content-Length": String(video.size),
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!init.ok) {
      throw new Error(`YouTube: init upload fallito — ${(await init.text()).slice(0, 300)}`);
    }
    const uploadUrl = init.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube: URL di upload mancante.");

    // 2) carica i byte del video
    const buf = await fs.promises.readFile(video.path);
    const up = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": video.mime, "Content-Length": String(buf.length) },
      body: new Uint8Array(buf),
    });
    if (!up.ok) {
      throw new Error(`YouTube: upload fallito — ${(await up.text()).slice(0, 300)}`);
    }
    const json = (await up.json()) as { id: string };
    return { externalId: json.id, externalUrl: `https://www.youtube.com/watch?v=${json.id}` };
  },

  async verifyToken(account: Account) {
    try {
      const ch = await apiFetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${account.accessToken}` } }
      );
      const first = (ch.items as Record<string, unknown>[] | undefined)?.[0];
      const title = (first?.snippet as { title?: string } | undefined)?.title || "canale";
      return { ok: true, message: `Token valido (${title})` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  async refresh(account: Account) {
    if (!account.refreshToken) return null;
    return refreshWithToken("youtube", "https://oauth2.googleapis.com/token", account.refreshToken);
  },
};
