/**
 * Tipi condivisi dell'applicazione (frontend + backend).
 */

/** Piattaforme supportate. Aggiungerne una = aggiungere un modulo in src/social/. */
export const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "linkedin"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Stato complessivo di un post. */
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";

/** Stato di pubblicazione su una singola piattaforma. */
export type TargetStatus = "pending" | "publishing" | "published" | "failed";

/** Utente dell'app (multi-utente con login email/password). */
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
  hashtags: string;
  status: PostStatus;
  scheduledAt: string | null; // ISO string
  createdAt: string;
  updatedAt: string;
  targets: PostTarget[];
  media: MediaItem[];
}

/** Una riga per ogni piattaforma selezionata per il post. */
/**
 * Opzioni che la piattaforma impone di far scegliere all'utente prima di
 * pubblicare. Oggi le usa solo TikTok: le Content Sharing Guidelines
 * richiedono che privacy, commenti, duetti e stitch siano decisi nella UI
 * dell'app e non dal codice.
 */
export interface TargetOptions {
  privacyLevel?: string;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  /** Contenuto promozionale: "il tuo brand" (organico). */
  brandOrganic?: boolean;
  /** Contenuto promozionale per un terzo (branded content). */
  brandedContent?: boolean;
}

export interface PostTarget {
  id: number;
  postId: number;
  platform: Platform;
  /** Testo adattato dall'AI per questa piattaforma (null = usa il testo base). */
  adaptedTitle: string | null;
  adaptedBody: string | null;
  /**
   * Tipo di pubblicazione su questa piattaforma (`feed`, `carousel`, `reel`,
   * `story`, `short`, `video`, `post`). null = predefinito della piattaforma,
   * dedotto dai media allegati.
   */
  postType: string | null;
  /** Opzioni scelte dall'utente per questa piattaforma (TikTok: privacy, commenti…). */
  options: TargetOptions | null;
  status: TargetStatus;
  externalId: string | null;
  externalUrl: string | null;
  error: string | null;
  publishedAt: string | null;
  attempts: number;
  /** Se valorizzato (ISO) e nel futuro: la pubblicazione fallita verrà ritentata a quell'ora. */
  nextRetryAt: string | null;
}

/** Post ancora in coda che usa un media (Libreria: "in attesa di pubblicazione"). */
export interface MediaUsage {
  postId: number;
  title: string;
  status: PostStatus;
  scheduledAt: string | null;
}

export interface MediaItem {
  id: number;
  userId: number;
  filename: string; // nome file su disco (univoco)
  originalName: string;
  mime: string;
  size: number;
  folder: string;
  tags: string;
  createdAt: string;
}

/** Account social connesso (uno per piattaforma per ciascun utente). */
export interface Account {
  userId: number;
  platform: Platform;
  accountName: string;
  accountId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string;
  connectedAt: string;
  /** JSON extra specifico della piattaforma (es. page_id di Facebook). */
  meta: string;
}

export interface LogEntry {
  id: number;
  level: "info" | "warn" | "error";
  scope: string;
  message: string;
  detail: string | null;
  createdAt: string;
}

/** Azioni AI disponibili. */
export type AiAction =
  | "adapt" // adatta il testo a una piattaforma
  | "short" // versione corta
  | "long" // versione lunga
  | "titles" // 5 titoli efficaci
  | "hashtags" // suggerisci hashtag
  | "improve" // migliora leggibilità
  | "cta" // genera call-to-action
  | "to_short_post" // da testo lungo a post breve
  | "to_linkedin_article" // da post breve ad articolo LinkedIn
  | "youtube_description"; // descrizione YouTube

export interface AiRequest {
  action: AiAction;
  text: string;
  title?: string;
  platform?: Platform;
}

/** ---------- Template (post e caroselli riutilizzabili) ---------- */
export type TemplateKind = "post" | "carousel";

/** Kit grafico usato per l'anteprima dei caroselli. */
export interface BrandKit {
  bg: string; // colore sfondo slide
  text: string; // colore testo
  accent: string; // colore accento (numeri, barre)
  font: string; // font family CSS
}

export interface CarouselSlide {
  headline: string;
  body: string;
}

/** Struttura di un template "post": corpo con segnaposto {…}, hashtag, piattaforme. */
export interface PostTemplateData {
  body: string;
  hashtags: string;
  platforms: Platform[];
}

/** Struttura di un template "carosello": brand kit + slide + hashtag. */
export interface CarouselTemplateData {
  brand: BrandKit;
  slides: CarouselSlide[];
  hashtags: string;
}

export interface Template {
  id: number;
  userId: number;
  name: string;
  kind: TemplateKind;
  data: PostTemplateData | CarouselTemplateData;
  createdAt: string;
}

/** ---------- Live (dirette streaming) ---------- */
export type LiveStatus = "created" | "live" | "ended" | "error";

export interface Live {
  id: number;
  userId: number;
  platform: Platform;
  title: string;
  description: string;
  broadcastId: string; // id della diretta sulla piattaforma
  ingestUrl: string; // server RTMP di ingest
  streamKey: string; // chiave di streaming
  watchUrl: string; // link per gli spettatori
  status: LiveStatus;
  createdAt: string;
}
