/**
 * Modulo Threads — Threads API di Meta (graph.threads.net).
 *
 * Non è la Graph API di Facebook: host, id applicazione e token sono suoi.
 * Serve un'app su developers.facebook.com con il caso d'uso "Threads API"
 * aggiunto; da lì si prendono "Threads App ID" e "Threads App Secret"
 * (THREADS_CLIENT_ID / THREADS_CLIENT_SECRET nel file .env), diversi da quelli
 * Meta usati per Facebook e Instagram.
 *
 * ⚠️ Come Instagram, Threads SCARICA i media da un URL pubblico: APP_URL deve
 * essere raggiungibile da internet, altrimenti il container resta in errore.
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
import { env } from "@/lib/env";

const API = "https://graph.threads.net/v1.0";
/** Scambio e rinnovo del token stanno sulla radice, non sotto /v1.0. */
const ROOT = "https://graph.threads.net";

/** Quanto si attende l'elaborazione di un container (video lunghi compresi). */
const CONTAINER_TIMEOUT_MS = 300_000;

function threadsUser(account: Account): { userId: string; token: string } {
  const meta = JSON.parse(account.meta || "{}");
  return { userId: (meta.threadsUserId as string) || account.accountId, token: account.accessToken };
}

/**
 * Attende che un container sia pronto per la pubblicazione.
 *
 * Meta stessa raccomanda di aspettare ~30 secondi prima di pubblicare: il
 * container di un video appena creato è `IN_PROGRESS` e pubblicarlo subito
 * fallisce. Qui si interroga lo stato invece di dormire a caso.
 */
async function waitContainer(containerId: string, token: string): Promise<void> {
  const start = Date.now();
  for (;;) {
    const st = await apiFetch(
      `${API}/${containerId}?fields=status,error_message&access_token=${token}`
    );
    const status = st.status as string;
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        `Threads: elaborazione del media fallita (${(st.error_message as string) || status}).`
      );
    }
    if (Date.now() - start > CONTAINER_TIMEOUT_MS) {
      throw new Error("Threads: timeout nell'elaborazione del media.");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

export const threadsModule: SocialModule = {
  platform: "threads",
  displayName: "Threads",
  color: "#000000",
  limits: {
    // 500 caratteri per post, come sull'app.
    maxChars: 500,
    requiresMedia: false,
    supportsTitle: false,
    mediaTypes: ["image", "video"],
    // Il carosello arriva a 20 elementi; il post singolo ne ha uno.
    maxMedia: 20,
    mimeTypes: ["image/jpeg", "image/png", "video/mp4", "video/quicktime"],
    postTypes: ["post", "carousel"],
  },
  oauth: {
    // Il consenso si chiede su threads.net, non su facebook.com.
    authorizeUrl: "https://threads.net/oauth/authorize",
    tokenUrl: `${ROOT}/oauth/access_token`,
    scopes: [
      "threads_basic",
      "threads_content_publish",
      "threads_manage_insights",
      // Risponditore automatico: leggere le risposte a un post e rispondere.
      "threads_manage_replies",
    ],
    scopeSeparator: ",",
  },

  async fetchAccount(tokens: TokenSet) {
    const { clientSecret } = env.oauth("threads");
    // Il token appena scambiato dura un'ora: va convertito subito in
    // long-lived (60 giorni), altrimenti un post programmato a domani trova un
    // token già morto.
    try {
      const ll = await apiFetch(
        `${ROOT}/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${tokens.accessToken}`
      );
      if (ll.access_token) {
        tokens.accessToken = ll.access_token as string;
        tokens.expiresIn = (ll.expires_in as number) || 60 * 24 * 3600;
      }
    } catch {
      // Se lo scambio non riesce si prosegue col token corto: l'utente vede
      // comunque l'account collegato e il rinnovo automatico riproverà.
    }

    const me = await apiFetch(
      `${API}/me?fields=id,username&access_token=${tokens.accessToken}`
    );
    const username = (me.username as string) || "";
    return {
      accountId: me.id as string,
      accountName: username ? `@${username}` : "Profilo Threads",
      meta: { threadsUserId: me.id as string, username },
    };
  },

  async publish(input: PublishInput, account: Account): Promise<PublishResult> {
    const { userId, token } = threadsUser(account);
    const text = input.body.slice(0, 500);
    const videos = input.media.filter((m) => m.kind === "video");

    if (!text.trim() && input.media.length === 0) {
      throw new Error("Threads richiede del testo oppure almeno un media.");
    }

    const type =
      input.postType === "carousel" || input.media.length > 1
        ? "carousel"
        : input.media.length === 1
          ? "single"
          : "text";

    if (type === "carousel" && input.media.length < 2) {
      throw new Error("Il carosello Threads richiede almeno 2 media.");
    }
    if (videos.length > 1 && type !== "carousel") {
      throw new Error("Threads accetta un solo video per post.");
    }

    /** Crea un container per un singolo media (o per il post di solo testo). */
    const createContainer = async (
      m: PublishInput["media"][number] | null,
      extra: Record<string, string> = {}
    ) => {
      const params = new URLSearchParams({ access_token: token, ...extra });
      if (!m) {
        params.set("media_type", "TEXT");
      } else if (m.kind === "video") {
        params.set("media_type", "VIDEO");
        params.set("video_url", m.url);
      } else {
        params.set("media_type", "IMAGE");
        params.set("image_url", m.url);
      }
      const json = await apiFetch(`${API}/${userId}/threads`, { method: "POST", body: params });
      return json.id as string;
    };

    let creationId: string;

    if (type === "carousel") {
      const children: string[] = [];
      for (const m of input.media.slice(0, 20)) {
        const id = await createContainer(m, { is_carousel_item: "true" });
        // Solo i video hanno un'elaborazione vera; per le foto la chiamata
        // torna già pronta ed evitiamo un giro di polling inutile.
        if (m.kind === "video") await waitContainer(id, token);
        children.push(id);
      }
      const params = new URLSearchParams({
        media_type: "CAROUSEL",
        children: children.join(","),
        text,
        access_token: token,
      });
      const json = await apiFetch(`${API}/${userId}/threads`, { method: "POST", body: params });
      creationId = json.id as string;
      await waitContainer(creationId, token);
    } else if (type === "single") {
      const m = input.media[0];
      creationId = await createContainer(m, { text });
      if (m.kind === "video") await waitContainer(creationId, token);
    } else {
      creationId = await createContainer(null, { text });
    }

    const pub = await apiFetch(`${API}/${userId}/threads_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    const id = pub.id as string;

    // Il permalink si legge dopo la pubblicazione; se il campo non è
    // disponibile si torna comunque l'id, che basta per le statistiche.
    let permalink: string | undefined;
    try {
      const info = await apiFetch(`${API}/${id}?fields=permalink&access_token=${token}`);
      permalink = (info.permalink as string) || undefined;
    } catch {
      /* permalink non disponibile: non è un errore di pubblicazione */
    }

    return { externalId: id, externalUrl: permalink };
  },

  async verifyToken(account: Account) {
    try {
      const me = await apiFetch(`${API}/me?fields=username&access_token=${account.accessToken}`);
      return { ok: true, message: `Token valido (@${me.username})` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  /**
   * Il token long-lived si rinnova con th_refresh_token (altri 60 giorni).
   * Meta lo accetta solo su token con almeno 24 ore di vita: prima di allora
   * la chiamata fallisce ed è giusto che il rinnovo venga solo riprovato dopo.
   */
  async refresh(account: Account): Promise<TokenSet> {
    const r = await apiFetch(
      `${ROOT}/refresh_access_token?grant_type=th_refresh_token&access_token=${account.accessToken}`
    );
    return {
      accessToken: r.access_token as string,
      refreshToken: account.refreshToken,
      expiresIn: (r.expires_in as number) || 60 * 24 * 3600,
    };
  },

  comments: {
    publicReply: true,
    // Threads non ha una API per i messaggi privati: qui la guida si manda
    // solo con una risposta pubblica.
    privateReply: false,
  },

  async listComments(account: Account, externalId: string): Promise<SocialComment[]> {
    const { token } = threadsUser(account);
    const res = await apiFetch(
      `${API}/${externalId}/replies?fields=id,text,username,timestamp&access_token=${token}`
    );
    const data = (res.data as Record<string, unknown>[]) || [];
    return data.map((c) => ({
      id: c.id as string,
      text: (c.text as string) || "",
      author: (c.username as string) || "",
      createdAt: (c.timestamp as string) || new Date().toISOString(),
    }));
  },

  /**
   * Su Threads una risposta è un post come gli altri, con `reply_to_id`:
   * stessi due passaggi della pubblicazione normale (container + publish).
   */
  async replyToComment(account: Account, commentId: string, message: string) {
    const { userId, token } = threadsUser(account);
    const created = await apiFetch(`${API}/${userId}/threads`, {
      method: "POST",
      body: new URLSearchParams({
        media_type: "TEXT",
        text: message.slice(0, 500),
        reply_to_id: commentId,
        access_token: token,
      }),
    });
    await apiFetch(`${API}/${userId}/threads_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: created.id as string, access_token: token }),
    });
  },

  /** Metriche del singolo post (richiede lo scope threads_manage_insights). */
  async insights(account: Account, externalId: string): Promise<PostMetrics> {
    const { token } = threadsUser(account);
    const res = await apiFetch(
      `${API}/${externalId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${token}`
    );
    const data = (res.data as { name: string; values?: { value: number }[] }[]) || [];
    const val = (name: string) => data.find((d) => d.name === name)?.values?.[0]?.value;
    const reposts = val("reposts") ?? 0;
    const quotes = val("quotes") ?? 0;
    const shares = val("shares") ?? 0;
    return {
      views: val("views"),
      likes: val("likes"),
      comments: val("replies"),
      // Su Threads "condividere" si fa in tre modi: sommarli dà un numero
      // confrontabile con le altre piattaforme.
      shares: reposts + quotes + shares,
    };
  },
};
