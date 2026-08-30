/**
 * Modulo TikTok — Content Posting API (Direct Post, upload da file).
 * Richiede un'app su developers.tiktok.com con lo scope video.publish approvato.
 * Nota: finché l'app TikTok non è "audited", i post vengono creati come privati.
 */
import type { Account } from "@/types";
import { apiFetch, type PublishInput, type PublishResult, type SocialModule, type TokenSet } from "../types";
import { refreshWithToken } from "../oauth";
import { fileBodyRange } from "../upload";

const API = "https://open.tiktokapis.com/v2";

/** Vincoli di chunking della Content Posting API. */
const MAX_CHUNK = 64 * 1024 * 1024;

/**
 * Divide il video secondo le regole di TikTok: fino a 64 MB si manda in un
 * pezzo solo; sopra, si usano chunk da 64 MB e l'ULTIMO assorbe il resto della
 * divisione: TikTok pretende `total_chunk_count = floor(size / chunk_size)`,
 * quindi l'ultimo chunk può superare i 64 MB — resta comunque sotto i 128 MB
 * ammessi, perché il resto della divisione per 64 MB è a sua volta < 64 MB.
 *
 * Perché: prima si mandava sempre `total_chunk_count: 1` con `chunk_size` pari
 * all'intero file — sopra i 64 MB l'init rispondeva `invalid_params` e i retry
 * ripetevano lo stesso errore fino a esaurirli.
 */
export function chunkPlan(size: number): { chunkSize: number; ranges: [number, number][] } {
  if (size <= MAX_CHUNK) return { chunkSize: size, ranges: [[0, size]] };
  const chunkSize = MAX_CHUNK;
  const total = Math.floor(size / chunkSize);
  const ranges: [number, number][] = [];
  for (let i = 0; i < total; i++) {
    const start = i * chunkSize;
    ranges.push([start, i === total - 1 ? size : start + chunkSize]);
  }
  return { chunkSize, ranges };
}

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
    postTypes: ["video"],
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
    const { chunkSize, ranges } = chunkPlan(video.size);

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
          chunk_size: chunkSize,
          total_chunk_count: ranges.length,
        },
      }),
    });
    const data = init.data as { publish_id?: string; upload_url?: string } | undefined;
    if (!data?.upload_url || !data?.publish_id) {
      throw new Error(`TikTok: init pubblicazione fallito — ${JSON.stringify(init).slice(0, 300)}`);
    }

    // 2) upload dei chunk in sequenza, letti dal disco in streaming
    for (const [i, [start, end]] of ranges.entries()) {
      const up = await fetch(data.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": video.mime,
          "Content-Length": String(end - start),
          "Content-Range": `bytes ${start}-${end - 1}/${video.size}`,
        },
        ...fileBodyRange(video.path, start, end),
      });
      if (!up.ok) {
        const detail = (await up.text().catch(() => "")).slice(0, 300);
        throw new Error(
          `TikTok: upload chunk ${i + 1}/${ranges.length} fallito (HTTP ${up.status})${detail ? ` — ${detail}` : ""}`
        );
      }
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
