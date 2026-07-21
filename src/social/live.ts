/**
 * Gestione dirette (live) sulle piattaforme che espongono un'API RTMP.
 * Supportate: YouTube (Data API liveBroadcasts/liveStreams) e Facebook
 * (Graph API live_videos). Instagram, TikTok e LinkedIn NON offrono API di
 * live a terze parti: per loro l'app fa solo l'annuncio/cross-post.
 *
 * Ogni provider ritorna URL di ingest RTMP + stream key (da usare con OBS o con
 * il ponte browser→server del progetto) e il link per gli spettatori.
 */
import type { Account, Platform } from "@/types";
import { apiFetch } from "./types";

export interface LiveDetails {
  broadcastId: string;
  ingestUrl: string;
  streamKey: string;
  watchUrl: string;
}

export interface LiveProvider {
  createLive(account: Account, title: string, description: string): Promise<LiveDetails>;
  endLive(account: Account, broadcastId: string): Promise<void>;
}

/** Le piattaforme con API di live utilizzabili. */
export const LIVE_PLATFORMS: Platform[] = ["youtube", "facebook"];

/* ----------------------------- YouTube ----------------------------- */

const YT = "https://www.googleapis.com/youtube/v3";

const youtubeLive: LiveProvider = {
  async createLive(account, title, description) {
    const auth = { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" };

    // 1) crea il broadcast (avvio/stop automatici quando arriva/termina lo stream)
    const broadcast = await apiFetch(`${YT}/liveBroadcasts?part=snippet,status,contentDetails`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        snippet: { title: title || "Diretta", description, scheduledStartTime: new Date().toISOString() },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
        contentDetails: { enableAutoStart: true, enableAutoStop: true },
      }),
    });
    const broadcastId = broadcast.id as string;

    // 2) crea lo stream RTMP
    const stream = await apiFetch(`${YT}/liveStreams?part=snippet,cdn`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        snippet: { title: title || "Diretta" },
        cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
      }),
    });
    const streamId = stream.id as string;
    const ing = (stream.cdn as { ingestionInfo?: { ingestionAddress?: string; streamName?: string } })
      .ingestionInfo;

    // 3) collega stream ↔ broadcast
    await apiFetch(`${YT}/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    return {
      broadcastId,
      ingestUrl: ing?.ingestionAddress || "",
      streamKey: ing?.streamName || "",
      watchUrl: `https://www.youtube.com/watch?v=${broadcastId}`,
    };
  },

  async endLive(account, broadcastId) {
    await apiFetch(
      `${YT}/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=id`,
      { method: "POST", headers: { Authorization: `Bearer ${account.accessToken}` } }
    ).catch(() => {});
  },
};

/* ----------------------------- Facebook ----------------------------- */

const GRAPH = "https://graph.facebook.com/v21.0";

function pageAuth(account: Account): { pageId: string; pageToken: string } {
  const meta = JSON.parse(account.meta || "{}");
  if (!meta.pageId || !meta.pageToken) {
    throw new Error("Nessuna Pagina Facebook collegata: riconnetti l'account nelle Impostazioni.");
  }
  return { pageId: meta.pageId, pageToken: meta.pageToken };
}

const facebookLive: LiveProvider = {
  async createLive(account, title, description) {
    const { pageId, pageToken } = pageAuth(account);
    const body = new URLSearchParams({
      status: "LIVE_NOW",
      title: title || "Diretta",
      description,
      access_token: pageToken,
    });
    const res = await apiFetch(`${GRAPH}/${pageId}/live_videos`, { method: "POST", body });
    const id = res.id as string;
    // stream_url tipo: rtmps://.../rtmp/<streamKey>
    const streamUrl = (res.stream_url as string) || (res.secure_stream_url as string) || "";
    const cut = streamUrl.lastIndexOf("/");
    return {
      broadcastId: id,
      ingestUrl: cut > 0 ? streamUrl.slice(0, cut) : streamUrl,
      streamKey: cut > 0 ? streamUrl.slice(cut + 1) : "",
      watchUrl: (res.permalink_url as string)
        ? `https://www.facebook.com${res.permalink_url as string}`
        : `https://www.facebook.com/${id}`,
    };
  },

  async endLive(account, broadcastId) {
    const { pageToken } = pageAuth(account);
    const body = new URLSearchParams({ end_live_video: "true", access_token: pageToken });
    await apiFetch(`${GRAPH}/${broadcastId}`, { method: "POST", body }).catch(() => {});
  },
};

/* ----------------------------- registro ----------------------------- */

const providers: Partial<Record<Platform, LiveProvider>> = {
  youtube: youtubeLive,
  facebook: facebookLive,
};

export function getLiveProvider(platform: Platform): LiveProvider {
  const p = providers[platform];
  if (!p) throw new Error(`Le dirette via API non sono supportate per ${platform}.`);
  return p;
}
