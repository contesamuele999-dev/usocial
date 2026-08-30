/**
 * Contratto che ogni modulo social deve implementare.
 * Per aggiungere una piattaforma: creare src/social/<nome>/index.ts
 * che esporta un `SocialModule` e registrarlo in src/social/registry.ts.
 */
import type { Account, Platform, TargetOptions } from "@/types";

/** Token restituiti dallo scambio OAuth. */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  /** Secondi di validità (se noto). */
  expiresIn?: number | null;
  scopes?: string;
}

/** Specifica OAuth2 della piattaforma (usata dall'helper generico in oauth.ts). */
export interface OAuthSpec {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Nome del parametro client id (TikTok usa "client_key"). */
  clientIdParam?: string;
  /** Parametri extra sull'URL di autorizzazione (es. access_type=offline per Google). */
  extraAuthParams?: Record<string, string>;
  /** Separatore scope nell'URL (default: spazio). */
  scopeSeparator?: string;
}

/** Media pronto per la pubblicazione. */
export interface PublishMedia {
  /** Percorso assoluto del file su disco. */
  path: string;
  mime: string;
  size: number;
  /** URL pubblico (APP_URL/api/media/:id/file) — richiesto da Instagram. */
  url: string;
  kind: "image" | "video";
}

/** Contenuto finale da pubblicare (testo già adattato e completo di hashtag). */
export interface PublishInput {
  title: string;
  body: string;
  media: PublishMedia[];
  /** Tipo scelto dall'utente (`reel`, `story`, …); assente = predefinito della piattaforma. */
  postType?: string | null;
  /** Scelte fatte dall'utente nel pannello della piattaforma (TikTok: privacy, commenti…). */
  options?: TargetOptions | null;
}

/**
 * Dati che una piattaforma impone di mostrare PRIMA di pubblicare.
 * TikTok li richiede esplicitamente nelle Content Sharing Guidelines: chi
 * pubblica deve vedere su quale account sta pubblicando e scegliere privacy e
 * interazioni, che l'app non può decidere per lui.
 */
export interface CreatorInfo {
  nickname: string;
  username?: string;
  avatarUrl?: string;
  /** Livelli di privacy ammessi per questo account, nell'ordine dato dall'API. */
  privacyLevels: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec?: number;
}

export interface PublishResult {
  externalId: string;
  externalUrl?: string;
}

/** Vincoli della piattaforma, usati per validazione e prompt AI. */
export interface PlatformLimits {
  maxChars: number;
  requiresMedia: boolean;
  supportsTitle: boolean;
  mediaTypes: ("image" | "video")[];
  maxMedia: number;
  /**
   * MIME accettati dalla piattaforma. Serve alla UI per avvisare PRIMA della
   * pubblicazione (es. Instagram accetta solo JPEG, non PNG né WebP).
   * Se assente, si controlla solo `mediaTypes`.
   */
  mimeTypes?: string[];
  /**
   * Tipi di pubblicazione realmente supportati dal modulo (il primo è il
   * predefinito). Gli id sono tradotti nella UI con `postType.<id>`.
   * Si elencano SOLO quelli che il modulo sa davvero pubblicare: un tipo
   * mostrato ma non implementato produrrebbe un post sbagliato o un errore.
   */
  postTypes?: string[];
}

export interface VerifyResult {
  ok: boolean;
  message: string;
}

export interface SocialModule {
  platform: Platform;
  displayName: string;
  /** Colore usato nell'interfaccia (badge, calendario). */
  color: string;
  limits: PlatformLimits;
  oauth: OAuthSpec;
  /** Dopo lo scambio OAuth: recupera id/nome account e metadati (es. page_id). */
  fetchAccount(tokens: TokenSet): Promise<{ accountId: string; accountName: string; meta: Record<string, unknown> }>;
  /** Pubblica il contenuto. Deve lanciare Error con messaggio chiaro in caso di fallimento. */
  publish(input: PublishInput, account: Account): Promise<PublishResult>;
  /** Verifica che il token sia ancora valido. */
  verifyToken(account: Account): Promise<VerifyResult>;
  /** Opzioni di pubblicazione da mostrare all'utente (solo dove la piattaforma le impone). */
  creatorInfo?(account: Account): Promise<CreatorInfo>;
  /** Rinnova il token (solo per piattaforme con refresh token). */
  refresh?(account: Account): Promise<TokenSet | null>;
}

/** Helper: fetch con errore leggibile se la risposta non è 2xx. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const error = json.error as { message?: string; code?: string | number } | undefined;
    const detail =
      error?.message ||
      (json as { error_description?: string }).error_description ||
      (json as { message?: string }).message ||
      text.slice(0, 500);
    // Il codice è la parte diagnostica: TikTok mette in `message` un rimando
    // generico alle linee guida e la causa vera solo in `error.code`.
    const code = error?.code !== undefined && error.code !== "ok" ? ` (${error.code})` : "";
    throw new Error(`HTTP ${res.status}: ${detail}${code}`);
  }
  return json;
}
