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
export interface PostTarget {
  id: number;
  postId: number;
  platform: Platform;
  /** Testo adattato dall'AI per questa piattaforma (null = usa il testo base). */
  adaptedTitle: string | null;
  adaptedBody: string | null;
  status: TargetStatus;
  externalId: string | null;
  externalUrl: string | null;
  error: string | null;
  publishedAt: string | null;
  attempts: number;
  /** Se valorizzato (ISO) e nel futuro: la pubblicazione fallita verrà ritentata a quell'ora. */
  nextRetryAt: string | null;
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
