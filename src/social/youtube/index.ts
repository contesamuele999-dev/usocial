/**
 * Modulo YouTube — upload video via YouTube Data API v3 (upload resumable).
 * Richiede un progetto Google Cloud con la YouTube Data API abilitata.
 * Il refresh token viene ottenuto con access_type=offline&prompt=consent.
 */
import type { Account } from "@/types";
import {
  apiFetch,
  type PostMetrics,
  type PublishInput,
  type PublishResult,
  type SocialComment,
  type SocialModule,
  type TokenSet,
} from "../types";
import { refreshWithToken } from "../oauth";
import { fileBody } from "../upload";

export const youtubeModule: SocialModule = {
  platform: "youtube",
  displayName: "YouTube",
  color: "#FF0000",
  limits: {
    maxChars: 5000,
    requiresMedia: true,
    supportsTitle: true,
    mediaTypes: ["video"],
    maxMedia: 1,
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    postTypes: ["video", "short"],
  },
  oauth: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      // Risponditore automatico ai commenti: leggere basta readonly, ma per
      // SCRIVERE una risposta Google pretende force-ssl.
      "https://www.googleapis.com/auth/youtube.force-ssl",
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

    // Non esiste un flag "Short" nell'API: YouTube classifica come Short i video
    // verticali sotto il minuto. L'hashtag #Shorts nella descrizione è il
    // segnale ufficiale suggerito da Google per rafforzare la classificazione.
    const isShort = input.postType === "short";
    const description = isShort && !/#shorts/i.test(input.body) ? `${input.body}\n\n#Shorts` : input.body;

    const metadata = {
      snippet: {
        title: input.title || input.body.slice(0, 90) || "Video",
        description,
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

    // 2) carica i byte del video, letti dal disco in streaming
    const up = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": video.mime, "Content-Length": String(video.size) },
      ...fileBody(video.path),
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

  /**
   * Statistiche pubbliche del video + iscritti del canale.
   * Bastano gli scope già chiesti alla connessione (`youtube.readonly`).
   */
  async insights(account: Account, externalId: string): Promise<PostMetrics> {
    const headers = { Authorization: `Bearer ${account.accessToken}` };
    const res = await apiFetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(externalId)}`,
      { headers }
    );
    const item = (res.items as { statistics?: Record<string, string> }[] | undefined)?.[0];
    if (!item) throw new Error("YouTube: video non trovato (rimosso o reso privato).");
    const st = item.statistics || {};
    const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));
    const out: PostMetrics = {
      views: num(st.viewCount),
      likes: num(st.likeCount),
      comments: num(st.commentCount),
    };
    try {
      const ch = await apiFetch(
        "https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true",
        { headers }
      );
      const chan = (ch.items as { statistics?: Record<string, string> }[] | undefined)?.[0];
      out.followers = num(chan?.statistics?.subscriberCount);
    } catch {
      /* iscritti non leggibili: il tasso di engagement non verrà calcolato */
    }
    return out;
  },

  comments: {
    publicReply: true,
    privateReply: false, // YouTube non ha messaggi privati via API
  },

  async listComments(account: Account, externalId: string): Promise<SocialComment[]> {
    const res = await apiFetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=100&videoId=${encodeURIComponent(externalId)}`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } }
    );
    const items = (res.items as Record<string, unknown>[]) || [];
    return items.map((item) => {
      const top = (item.snippet as { topLevelComment?: { id?: string; snippet?: Record<string, unknown> } })
        ?.topLevelComment;
      const sn = (top?.snippet || {}) as Record<string, unknown>;
      const channel = sn.authorChannelId as { value?: string } | undefined;
      return {
        id: (top?.id as string) || (item.id as string),
        text: (sn.textOriginal as string) || (sn.textDisplay as string) || "",
        author: (sn.authorDisplayName as string) || "",
        authorId: channel?.value,
        createdAt: (sn.publishedAt as string) || new Date().toISOString(),
      };
    });
  },

  async replyToComment(account: Account, commentId: string, message: string) {
    await apiFetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ snippet: { parentId: commentId, textOriginal: message } }),
    });
  },

  async refresh(account: Account) {
    if (!account.refreshToken) return null;
    return refreshWithToken("youtube", "https://oauth2.googleapis.com/token", account.refreshToken);
  },
};
