/**
 * Modulo LinkedIn — pubblica sul profilo personale via UGC Posts API.
 * Richiede un'app LinkedIn con i prodotti "Sign In with LinkedIn using OpenID Connect"
 * e "Share on LinkedIn" (scope: openid profile w_member_social).
 */
import type { Account } from "@/types";
import {
  apiFetch,
  type PostMetrics,
  type PublishInput,
  type PublishMedia,
  type PublishResult,
  type SocialModule,
  type TokenSet,
} from "../types";
import { fileBody } from "../upload";

const API = "https://api.linkedin.com/v2";

/**
 * Ricette di upload: LinkedIn distingue foto e video già in fase di
 * `registerUpload`, e la ricetta scelta decide come il file viene elaborato.
 * Il modulo prima filtrava via i video (`filter(kind === "image")`): il file
 * non veniva mai caricato e sul feed restava il solo testo del post.
 */
const RECIPE = {
  image: "urn:li:digitalmediaRecipe:feedshare-image",
  video: "urn:li:digitalmediaRecipe:feedshare-video",
} as const;

/** Quanto si aspetta che LinkedIn finisca di transcodificare un video. */
const VIDEO_READY_TIMEOUT_MS = 300_000;

function authHeaders(account: Account) {
  return {
    Authorization: `Bearer ${account.accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/**
 * Carica un file e restituisce l'URN dell'asset.
 * Due passaggi imposti da LinkedIn: `registerUpload` dà un URL monouso, poi il
 * binario si manda con una PUT su quell'URL (in streaming, così un video da
 * 200 MB non passa dalla RAM del processo).
 */
async function uploadAsset(m: PublishMedia, author: string, account: Account): Promise<string> {
  const reg = await apiFetch(`${API}/assets?action=registerUpload`, {
    method: "POST",
    headers: authHeaders(account),
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: [RECIPE[m.kind]],
        owner: author,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  });
  const value = reg.value as Record<string, unknown>;
  const mech = (value.uploadMechanism as Record<string, unknown>)[
    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
  ] as { uploadUrl: string };
  const asset = value.asset as string;

  const up = await fetch(mech.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Length": String(m.size),
    },
    ...fileBody(m.path),
  });
  if (!up.ok) {
    const label = m.kind === "video" ? "video" : "immagine";
    throw new Error(`LinkedIn: upload ${label} fallito (HTTP ${up.status})`);
  }
  return asset;
}

/**
 * Attende che LinkedIn abbia finito di elaborare un video.
 *
 * Serve davvero: pubblicare uno share che punta a un asset ancora in
 * `PROCESSING` produce un post in cui il video non compare — di nuovo il
 * sintomo "si vede solo la descrizione". Se lo stato non è leggibile con
 * questo token non si blocca nulla: si pubblica e ci pensa LinkedIn.
 */
async function waitVideoReady(asset: string, account: Account): Promise<void> {
  const id = asset.split(":").pop();
  if (!id) return;
  const start = Date.now();
  for (;;) {
    let status = "";
    try {
      const res = await apiFetch(`${API}/assets/${id}`, {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      const recipes = (res.recipes as { status?: string }[] | undefined) || [];
      status = recipes[0]?.status || (res.status as string) || "";
    } catch {
      return; // stato non interrogabile: si prosegue con la pubblicazione
    }
    if (status === "AVAILABLE") return;
    if (status === "CLIENT_ERROR" || status === "SERVER_ERROR") {
      throw new Error("LinkedIn: elaborazione del video fallita (formato non supportato?).");
    }
    if (Date.now() - start > VIDEO_READY_TIMEOUT_MS) {
      throw new Error(
        "LinkedIn: il video è ancora in elaborazione dopo 5 minuti. Riprova con un file più corto o più leggero."
      );
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

export const linkedinModule: SocialModule = {
  platform: "linkedin",
  displayName: "LinkedIn",
  color: "#0A66C2",
  limits: {
    maxChars: 3000,
    requiresMedia: false,
    supportsTitle: false,
    mediaTypes: ["image", "video"],
    maxMedia: 9,
    // Un post LinkedIn contiene UN video oppure fino a 9 immagini: le due cose
    // non si mescolano, lo share ha una sola `shareMediaCategory`.
    maxMediaByKind: { video: 1 },
    noMixedMedia: true,
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "video/mp4"],
    postTypes: ["post"],
  },
  oauth: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
  },

  async fetchAccount(tokens: TokenSet) {
    const me = await apiFetch(`${API}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    return {
      accountId: me.sub as string,
      accountName: (me.name as string) || "Profilo LinkedIn",
      meta: {},
    };
  },

  async publish(input: PublishInput, account: Account): Promise<PublishResult> {
    const author = `urn:li:person:${account.accountId}`;
    const headers = authHeaders(account);

    const videos = input.media.filter((m) => m.kind === "video");
    const images = input.media.filter((m) => m.kind === "image");
    if (videos.length > 1) throw new Error("LinkedIn accetta un solo video per post.");
    if (videos.length && images.length) {
      throw new Error("LinkedIn non accetta foto e video nello stesso post: scegline uno dei due.");
    }

    const toUpload = videos.length ? videos : images.slice(0, 9);
    const assets: string[] = [];
    for (const m of toUpload) {
      const asset = await uploadAsset(m, author, account);
      if (m.kind === "video") await waitVideoReady(asset, account);
      assets.push(asset);
    }

    const isVideo = videos.length > 0;
    const postBody = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: input.body },
          shareMediaCategory: isVideo ? "VIDEO" : assets.length ? "IMAGE" : "NONE",
          media: assets.map((a) => ({
            status: "READY",
            media: a,
            // Il titolo compare sotto al player nel feed.
            ...(isVideo && input.title ? { title: { text: input.title.slice(0, 200) } } : {}),
          })),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch(`${API}/ugcPosts`, {
      method: "POST",
      headers,
      body: JSON.stringify(postBody),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn: pubblicazione fallita — ${text.slice(0, 300)}`);
    }
    const id = res.headers.get("x-restli-id") || "";
    return {
      externalId: id,
      externalUrl: id ? `https://www.linkedin.com/feed/update/${id}/` : undefined,
    };
  },

  async verifyToken(account: Account) {
    try {
      const me = await apiFetch(`${API}/userinfo`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      return { ok: true, message: `Token valido (${me.name})` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  /**
   * Reazioni e commenti di uno share.
   * Le impression di un post personale LinkedIn non sono esposte da nessuna
   * API pubblica (esistono solo per le Pagine aziendali, con il prodotto
   * "Community Management API"): restano a zero e la pagina Statistiche lo dice.
   */
  async insights(account: Account, externalId: string): Promise<PostMetrics> {
    const urn = encodeURIComponent(externalId);
    const res = await apiFetch(`${API}/socialActions/${urn}`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    const likes = (res.likesSummary as { totalLikes?: number } | undefined)?.totalLikes ?? 0;
    const comments =
      (res.commentsSummary as { totalFirstLevelComments?: number } | undefined)
        ?.totalFirstLevelComments ?? 0;
    return { likes, comments };
  },
};
