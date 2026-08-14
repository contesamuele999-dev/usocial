/**
 * Modulo Instagram — Content Publishing API (Meta Graph).
 * Richiede un account Instagram Business/Creator collegato a una Pagina Facebook.
 * ⚠️ Instagram scarica i media da un URL pubblico: APP_URL deve essere
 * raggiungibile da internet (es. tramite tunnel/reverse proxy) per pubblicare media.
 */
import type { Account } from "@/types";
import { apiFetch, type PublishInput, type PublishResult, type SocialModule, type TokenSet } from "../types";
import { env } from "@/lib/env";

const GRAPH = "https://graph.facebook.com/v21.0";

function igAuth(account: Account): { igUserId: string; token: string } {
  const meta = JSON.parse(account.meta || "{}");
  if (!meta.igUserId) {
    throw new Error(
      "Nessun account Instagram Business collegato alla Pagina: riconnetti l'account nelle Impostazioni."
    );
  }
  return { igUserId: meta.igUserId, token: account.accessToken };
}

/** Attende che un container media sia pronto (necessario per i video). */
async function waitContainer(containerId: string, token: string, timeoutMs = 120_000) {
  const start = Date.now();
  for (;;) {
    const st = await apiFetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${token}`);
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR") throw new Error("Instagram: elaborazione media fallita.");
    if (Date.now() - start > timeoutMs) throw new Error("Instagram: timeout elaborazione media.");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export const instagramModule: SocialModule = {
  platform: "instagram",
  displayName: "Instagram",
  color: "#E1306C",
  limits: {
    maxChars: 2200,
    requiresMedia: true,
    supportsTitle: false,
    mediaTypes: ["image", "video"],
    maxMedia: 10,
    // La Graph API accetta solo JPEG per le foto e MP4/MOV per i video:
    // PNG, GIF e WebP vanno convertiti prima di pubblicare.
    mimeTypes: ["image/jpeg", "video/mp4", "video/quicktime"],
  },
  oauth: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "business_management",
    ],
    scopeSeparator: ",",
  },

  async fetchAccount(tokens: TokenSet) {
    const { clientId, clientSecret } = env.oauth("instagram");
    const ll = await apiFetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokens.accessToken}`
    );
    tokens.accessToken = (ll.access_token as string) || tokens.accessToken;
    tokens.expiresIn = (ll.expires_in as number) || 60 * 24 * 3600;

    const pages = await apiFetch(
      `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${tokens.accessToken}`
    );
    const withIg = (pages.data as Record<string, unknown>[] | undefined)?.find(
      (p) => p.instagram_business_account
    );
    if (!withIg) {
      throw new Error("Nessun account Instagram Business collegato alle tue Pagine Facebook.");
    }
    const ig = withIg.instagram_business_account as { id: string; username: string };
    return {
      accountId: ig.id,
      accountName: `@${ig.username}`,
      meta: { igUserId: ig.id, username: ig.username, pageId: withIg.id },
    };
  },

  async publish(input: PublishInput, account: Account): Promise<PublishResult> {
    const { igUserId, token } = igAuth(account);
    if (input.media.length === 0) {
      throw new Error("Instagram richiede almeno un'immagine o un video.");
    }
    const caption = input.body;

    // helper: crea un container per un singolo media
    const createContainer = async (m: PublishInput["media"][number], extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ access_token: token, ...extra });
      if (m.kind === "video") {
        params.set("media_type", "REELS");
        params.set("video_url", m.url);
      } else {
        params.set("image_url", m.url);
      }
      const json = await apiFetch(`${GRAPH}/${igUserId}/media`, { method: "POST", body: params });
      return json.id as string;
    };

    let creationId: string;

    if (input.media.length === 1) {
      const m = input.media[0];
      creationId = await createContainer(m, { caption });
      if (m.kind === "video") await waitContainer(creationId, token);
    } else {
      // Carosello: container per ogni elemento + container CAROUSEL
      const children: string[] = [];
      for (const m of input.media.slice(0, 10)) {
        const id = await createContainer(m, { is_carousel_item: "true" });
        if (m.kind === "video") await waitContainer(id, token);
        children.push(id);
      }
      const params = new URLSearchParams({
        media_type: "CAROUSEL",
        children: children.join(","),
        caption,
        access_token: token,
      });
      const json = await apiFetch(`${GRAPH}/${igUserId}/media`, { method: "POST", body: params });
      creationId = json.id as string;
    }

    const pub = await apiFetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    return {
      externalId: pub.id as string,
      externalUrl: `https://www.instagram.com/`,
    };
  },

  async verifyToken(account: Account) {
    try {
      const meta = JSON.parse(account.meta || "{}");
      const me = await apiFetch(
        `${GRAPH}/${meta.igUserId}?fields=username&access_token=${account.accessToken}`
      );
      return { ok: true, message: `Token valido (@${me.username})` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  /** Come Facebook: il token long-lived si estende riscambiandolo (vedi social/tokens.ts). */
  async refresh(account: Account): Promise<TokenSet> {
    const { clientId, clientSecret } = env.oauth("instagram");
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
