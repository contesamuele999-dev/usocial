/**
 * Modulo TikTok — Content Posting API (Direct Post, upload da file).
 * Richiede un'app su developers.tiktok.com con gli scope video.publish e video.upload.
 *
 * Due modalità, scelte con il tipo di post:
 *  - "video": Direct Post, pubblica subito. Richiede che il Direct Post sia stato
 *    AUDITATO: senza audit TikTok lo accetta solo su account privati e altrimenti
 *    risponde 403 unaudited_client_can_only_post_to_private_accounts.
 *  - "draft": carica il video nelle bozze dell'account, che l'utente completa
 *    dall'app TikTok. Non richiede audit ed è il ripiego finché non arriva.
 */
import type { Account } from "@/types";
import {
  apiFetch,
  type CreatorInfo,
  type PublishInput,
  type PublishResult,
  type SocialModule,
  type TokenSet,
} from "../types";
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

/**
 * Codici di errore TikTok tradotti in istruzioni. Il `message` che arriva
 * dall'API è sempre lo stesso rimando alle linee guida: senza questa mappa
 * l'utente legge "Please review our integration guidelines" e non sa che fare.
 */
const HINTS: Record<string, string> = {
  unaudited_client_can_only_post_to_private_accounts:
    "il Direct Post non è auditato, quindi TikTok accetta la pubblicazione diretta solo su account PRIVATI. Scegli il tipo di post \"Bozza\" per caricare il video nelle bozze TikTok, oppure invia l'app per l'audit su developers.tiktok.com (Content Posting API → Direct Post → Apply).",
  access_token_invalid: "token scaduto o revocato: ricollega l'account TikTok nelle Impostazioni.",
  scope_not_authorized:
    "manca lo scope video.publish: ricollega l'account TikTok accettando tutti i permessi.",
  spam_risk_too_many_posts: "troppi post pubblicati di recente: TikTok chiede di attendere.",
  spam_risk_user_banned_from_posting: "l'account TikTok è temporaneamente bloccato dalla pubblicazione.",
  reached_active_user_cap: "l'app TikTok ha raggiunto il tetto di utenti attivi giornalieri.",
  file_format_check_failed: "formato video non accettato da TikTok: converti il file in MP4 (H.264/AAC).",
};

async function initUpload(
  account: Account,
  url: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    // TikTok segnala parte degli errori con HTTP 200 e `error.code` diverso da
    // "ok": apiFetch non li vede, vanno controllati a mano.
    const json = await apiFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const error = json.error as { code?: string; message?: string; log_id?: string } | undefined;
    if (error?.code && error.code !== "ok") {
      throw explain(new Error(`TikTok: ${error.message || ""} (${error.code}) log_id ${error.log_id}`));
    }
    return json;
  } catch (err) {
    throw explain(err);
  }
}

/**
 * `post_info` del Direct Post costruito con le scelte fatte dall'utente nel
 * pannello TikTok. Il privacy level NON ha un default: le linee guida vietano
 * di preselezionarlo, e senza scelta la pubblicazione va fermata prima.
 */
function postInfo(input: PublishInput): Record<string, unknown> {
  const o = input.options || {};
  if (!o.privacyLevel) {
    throw new Error(
      "TikTok: scegli chi può vedere il video nel pannello TikTok prima di pubblicare."
    );
  }
  // Un contenuto promozionale per un terzo non può essere privato: è TikTok a
  // rifiutarlo, tanto vale dirlo con parole nostre.
  if (o.brandedContent && o.privacyLevel === "SELF_ONLY") {
    throw new Error(
      "TikTok: un contenuto in promozione per un brand terzo non può essere pubblicato come privato."
    );
  }
  return {
    title: (input.title || input.body).slice(0, 150),
    privacy_level: o.privacyLevel,
    disable_comment: Boolean(o.disableComment),
    disable_duet: Boolean(o.disableDuet),
    disable_stitch: Boolean(o.disableStitch),
    brand_organic_toggle: Boolean(o.brandOrganic),
    brand_content_toggle: Boolean(o.brandedContent),
  };
}

/** Carica il video a fette sull'upload_url restituito dall'init. */
async function uploadChunks(
  uploadUrl: string,
  video: { path: string; mime: string; size: number },
  ranges: [number, number][]
) {
  for (const [i, [start, end]] of ranges.entries()) {
    const up = await fetch(uploadUrl, {
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
}

/** Sostituisce il messaggio dell'API con l'istruzione corrispondente, se nota. */
function explain(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  for (const [code, hint] of Object.entries(HINTS)) {
    if (message.includes(code)) return new Error(`TikTok: ${hint}`);
  }
  return err instanceof Error ? err : new Error(message);
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
    // "draft" carica nell'inbox TikTok invece di pubblicare: è l'unica via
    // finché l'app non passa l'audit del Direct Post.
    postTypes: ["video", "draft"],
  },
  oauth: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: `${API}/oauth/token/`,
    scopes: ["user.info.basic", "video.publish", "video.upload"],
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
    const draft = input.postType === "draft";

    // Gli account collegati prima che chiedessimo video.upload non possono
    // caricare bozze: meglio dirlo subito che farsi rifiutare dall'API.
    if (draft && account.scopes && !account.scopes.includes("video.upload")) {
      throw new Error(
        "TikTok: per la bozza serve il permesso video.upload — ricollega l'account TikTok nelle Impostazioni."
      );
    }

    const sourceInfo = {
      source: "FILE_UPLOAD",
      video_size: video.size,
      chunk_size: chunkSize,
      total_chunk_count: ranges.length,
    };

    // 1) init. La bozza usa l'endpoint inbox (nessun post_info: titolo e
    // privacy li sceglie l'utente nell'app TikTok al momento di pubblicare).
    const init = await initUpload(
      account,
      draft ? `${API}/post/publish/inbox/video/init/` : `${API}/post/publish/video/init/`,
      draft
        ? { source_info: sourceInfo }
        : { post_info: postInfo(input), source_info: sourceInfo }
    );
    const data = init.data as { publish_id?: string; upload_url?: string } | undefined;
    if (!data?.upload_url || !data?.publish_id) {
      throw new Error(`TikTok: init pubblicazione fallito — ${JSON.stringify(init).slice(0, 300)}`);
    }

    // 2) upload dei chunk in sequenza, letti dal disco in streaming
    await uploadChunks(data.upload_url, video, ranges);

    return { externalId: data.publish_id, externalUrl: undefined };
  },

  /**
   * Dati che le Content Sharing Guidelines impongono di mostrare prima del
   * Direct Post: su quale account si pubblica e quali privacy e interazioni
   * sono ammesse. `privacy_level_options` dipende dall'account (un profilo
   * privato non offre PUBLIC_TO_EVERYONE), quindi va letto ogni volta.
   */
  async creatorInfo(account: Account): Promise<CreatorInfo> {
    const res = await apiFetch(`${API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });
    const d = (res.data || {}) as Record<string, unknown>;
    return {
      nickname: (d.creator_nickname as string) || "Account TikTok",
      username: d.creator_username as string | undefined,
      avatarUrl: d.creator_avatar_url as string | undefined,
      privacyLevels: (d.privacy_level_options as string[]) || [],
      commentDisabled: Boolean(d.comment_disabled),
      duetDisabled: Boolean(d.duet_disabled),
      stitchDisabled: Boolean(d.stitch_disabled),
      maxDurationSec: d.max_video_post_duration_sec as number | undefined,
    };
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
