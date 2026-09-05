/**
 * Modulo Instagram — Content Publishing API (Meta Graph).
 * Richiede un account Instagram Business/Creator collegato a una Pagina Facebook.
 * ⚠️ Instagram scarica i media da un URL pubblico: APP_URL deve essere
 * raggiungibile da internet (es. tramite tunnel/reverse proxy) per pubblicare media.
 */
import type { Account } from "@/types";
import {
  apiFetch,
  type PostMetrics,
  type PublishInput,
  type PublishResult,
  type SocialModule,
  type TokenSet,
} from "../types";
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
    postTypes: ["feed", "carousel", "reel", "story"],
  },
  oauth: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      // Serve alla pagina Statistiche. È lo stesso permesso che Meta concede
      // insieme agli altri: aggiungerlo obbliga però a ricollegare l'account.
      "instagram_manage_insights",
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

    // Tipo scelto dall'utente; se manca si deduce dai media (più di uno =
    // carosello, un video = reel, un'immagine = post nel feed).
    const type =
      input.postType ||
      (input.media.length > 1 ? "carousel" : input.media[0].kind === "video" ? "reel" : "feed");

    if (type === "carousel" && input.media.length < 2) {
      throw new Error("Il carosello richiede almeno 2 media.");
    }
    if (type === "reel" && input.media[0].kind !== "video") {
      throw new Error("Un reel richiede un video.");
    }

    // helper: crea un container per un singolo media
    const createContainer = async (m: PublishInput["media"][number], extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ access_token: token, ...extra });
      if (m.kind === "video") {
        // STORIES per le storie, REELS per tutto il resto: i video nel feed
        // vengono comunque pubblicati come reel da Instagram.
        params.set("media_type", type === "story" ? "STORIES" : "REELS");
        params.set("video_url", m.url);
      } else {
        if (type === "story") params.set("media_type", "STORIES");
        params.set("image_url", m.url);
      }
      const json = await apiFetch(`${GRAPH}/${igUserId}/media`, { method: "POST", body: params });
      return json.id as string;
    };

    let creationId: string;

    if (type !== "carousel" && input.media.length >= 1) {
      const m = input.media[0];
      // Le storie non accettano didascalia.
      creationId = await createContainer(m, type === "story" ? {} : { caption });
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

  /**
   * Metriche di un post Instagram.
   *
   * Due chiamate perché la Graph API le tiene separate: i contatori pubblici
   * (like, commenti) stanno sul media, le metriche di copertura sotto
   * `/insights`. Le seconde possono fallire da sole (un post più vecchio del
   * permesso, un formato senza insight): in quel caso si restituiscono
   * comunque like e commenti invece di perdere tutto.
   */
  async insights(account: Account, externalId: string): Promise<PostMetrics> {
    const { igUserId, token } = igAuth(account);
    const out: PostMetrics = {};

    const base = await apiFetch(
      `${GRAPH}/${externalId}?fields=like_count,comments_count&access_token=${token}`
    );
    out.likes = (base.like_count as number) ?? undefined;
    out.comments = (base.comments_count as number) ?? undefined;

    try {
      // `views` ha sostituito `impressions`, deprecata per i contenuti creati
      // dopo luglio 2024: chiederla ancora farebbe fallire tutta la chiamata.
      const res = await apiFetch(
        `${GRAPH}/${externalId}/insights?metric=views,reach,saved,shares&access_token=${token}`
      );
      const data = (res.data as { name: string; values?: { value: number }[] }[]) || [];
      const val = (n: string) => data.find((d) => d.name === n)?.values?.[0]?.value;
      out.views = val("views");
      out.reach = val("reach");
      out.saves = val("saved");
      out.shares = val("shares");
    } catch {
      /* insight non disponibili per questo media: restano like e commenti */
    }

    try {
      const prof = await apiFetch(
        `${GRAPH}/${igUserId}?fields=followers_count&access_token=${token}`
      );
      out.followers = (prof.followers_count as number) ?? undefined;
    } catch {
      /* niente follower: il tasso di engagement non verrà calcolato */
    }
    return out;
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
