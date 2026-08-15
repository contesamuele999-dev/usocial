/**
 * Modulo LinkedIn — pubblica sul profilo personale via UGC Posts API.
 * Richiede un'app LinkedIn con i prodotti "Sign In with LinkedIn using OpenID Connect"
 * e "Share on LinkedIn" (scope: openid profile w_member_social).
 */
import type { Account } from "@/types";
import { apiFetch, type PublishInput, type PublishResult, type SocialModule, type TokenSet } from "../types";
import { fileBody } from "../upload";

const API = "https://api.linkedin.com/v2";

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
    const headers = {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    };

    // Upload immagini (registerUpload + PUT binario)
    const assets: string[] = [];
    for (const m of input.media.filter((x) => x.kind === "image")) {
      const reg = await apiFetch(`${API}/assets?action=registerUpload`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
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
      if (!up.ok) throw new Error(`LinkedIn: upload immagine fallito (HTTP ${up.status})`);
      assets.push(asset);
    }

    const postBody = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: input.body },
          shareMediaCategory: assets.length ? "IMAGE" : "NONE",
          media: assets.map((a) => ({ status: "READY", media: a })),
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
};
