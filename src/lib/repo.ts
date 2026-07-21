/**
 * Repository: tutto l'accesso al DB passa da qui.
 * Ogni entità (post, media, account, impostazioni) è collegata a un utente:
 * le funzioni pubbliche ricevono `userId` e filtrano di conseguenza.
 * Le funzioni con suffisso `System` ignorano l'utente e sono a uso interno
 * (scheduler / publisher), che risalgono all'utente dal post stesso.
 */
import { getDb } from "./db";
import type {
  Account,
  Live,
  LiveStatus,
  MediaItem,
  Platform,
  Post,
  PostStatus,
  PostTarget,
  Template,
  TemplateKind,
} from "@/types";

// ---------- mapping righe DB -> tipi ----------

function rowToTarget(r: Record<string, unknown>): PostTarget {
  return {
    id: r.id as number,
    postId: r.post_id as number,
    platform: r.platform as Platform,
    adaptedTitle: r.adapted_title as string | null,
    adaptedBody: r.adapted_body as string | null,
    status: r.status as PostTarget["status"],
    externalId: r.external_id as string | null,
    externalUrl: r.external_url as string | null,
    error: r.error as string | null,
    publishedAt: r.published_at as string | null,
    attempts: r.attempts as number,
    nextRetryAt: r.next_retry_at as string | null,
  };
}

function rowToMedia(r: Record<string, unknown>): MediaItem {
  return {
    id: r.id as number,
    userId: r.user_id as number,
    filename: r.filename as string,
    originalName: r.original_name as string,
    mime: r.mime as string,
    size: r.size as number,
    folder: r.folder as string,
    tags: r.tags as string,
    createdAt: r.created_at as string,
  };
}

function rowToPost(r: Record<string, unknown>): Post {
  const db = getDb();
  const targets = (
    db.prepare("SELECT * FROM post_targets WHERE post_id = ? ORDER BY platform").all(r.id) as
      Record<string, unknown>[]
  ).map(rowToTarget);
  const media = (
    db
      .prepare(
        `SELECT m.* FROM media m JOIN post_media pm ON pm.media_id = m.id
         WHERE pm.post_id = ? ORDER BY pm.sort`
      )
      .all(r.id) as Record<string, unknown>[]
  ).map(rowToMedia);
  return {
    id: r.id as number,
    userId: r.user_id as number,
    title: r.title as string,
    body: r.body as string,
    hashtags: r.hashtags as string,
    status: r.status as PostStatus,
    scheduledAt: r.scheduled_at as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    targets,
    media,
  };
}

// ---------- POSTS ----------

export interface PostInput {
  title: string;
  body: string;
  hashtags: string;
  scheduledAt: string | null;
  status: PostStatus;
  platforms: Platform[];
  mediaIds: number[];
}

export function listPosts(
  userId: number,
  filter?: { status?: PostStatus | PostStatus[]; platform?: Platform; q?: string }
): Post[] {
  const db = getDb();
  let sql = "SELECT * FROM posts WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (filter?.q) {
    // ricerca full-text semplice su titolo, testo e hashtag
    sql += " AND (title LIKE ? OR body LIKE ? OR hashtags LIKE ?)";
    const like = `%${filter.q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY COALESCE(scheduled_at, created_at) DESC";
  let posts = (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToPost);
  if (filter?.platform) {
    posts = posts.filter((p) => p.targets.some((t) => t.platform === filter.platform));
  }
  return posts;
}

function loadPost(id: number, userId?: number): Post | null {
  const row =
    userId == null
      ? (getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as
          | Record<string, unknown>
          | undefined)
      : (getDb().prepare("SELECT * FROM posts WHERE id = ? AND user_id = ?").get(id, userId) as
          | Record<string, unknown>
          | undefined);
  return row ? rowToPost(row) : null;
}

/** Post di un utente specifico (usato dalle API). */
export function getPost(id: number, userId: number): Post | null {
  return loadPost(id, userId);
}

/** Post per id senza filtro utente (usato da scheduler/publisher). */
export function getPostSystem(id: number): Post | null {
  return loadPost(id);
}

/** Verifica che l'utente possieda i media indicati (evita di allegare media altrui). */
function ownedMediaIds(userId: number, mediaIds: number[]): number[] {
  if (mediaIds.length === 0) return [];
  const db = getDb();
  const placeholders = mediaIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id FROM media WHERE user_id = ? AND id IN (${placeholders})`)
    .all(userId, ...mediaIds) as { id: number }[];
  const owned = new Set(rows.map((r) => r.id));
  return mediaIds.filter((id) => owned.has(id)); // mantiene l'ordine di selezione
}

export function createPost(userId: number, input: PostInput): Post {
  const db = getDb();
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        "INSERT INTO posts (user_id, title, body, hashtags, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(userId, input.title, input.body, input.hashtags, input.status, input.scheduledAt);
    const postId = info.lastInsertRowid as number;
    syncTargets(postId, input.platforms);
    syncMedia(postId, ownedMediaIds(userId, input.mediaIds));
    return postId;
  });
  return getPost(tx(), userId)!;
}

export function updatePost(id: number, userId: number, input: PostInput): Post | null {
  const db = getDb();
  if (!getPost(id, userId)) return null;
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE posts SET title = ?, body = ?, hashtags = ?, status = ?, scheduled_at = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`
    ).run(input.title, input.body, input.hashtags, input.status, input.scheduledAt, id, userId);
    syncTargets(id, input.platforms);
    syncMedia(id, ownedMediaIds(userId, input.mediaIds));
  });
  tx();
  return getPost(id, userId);
}

/** Allinea le piattaforme selezionate senza perdere lo stato di quelle già pubblicate. */
function syncTargets(postId: number, platforms: Platform[]) {
  const db = getDb();
  const existing = db
    .prepare("SELECT platform FROM post_targets WHERE post_id = ?")
    .all(postId) as { platform: Platform }[];
  const keep = new Set(platforms);
  for (const e of existing) {
    if (!keep.has(e.platform)) {
      db.prepare("DELETE FROM post_targets WHERE post_id = ? AND platform = ?").run(
        postId,
        e.platform
      );
    }
  }
  const have = new Set(existing.map((e) => e.platform));
  for (const p of platforms) {
    if (!have.has(p)) {
      db.prepare("INSERT INTO post_targets (post_id, platform) VALUES (?, ?)").run(postId, p);
    }
  }
}

function syncMedia(postId: number, mediaIds: number[]) {
  const db = getDb();
  db.prepare("DELETE FROM post_media WHERE post_id = ?").run(postId);
  mediaIds.forEach((mediaId, i) => {
    db.prepare("INSERT OR IGNORE INTO post_media (post_id, media_id, sort) VALUES (?, ?, ?)").run(
      postId,
      mediaId,
      i
    );
  });
}

export function deletePost(id: number, userId: number): boolean {
  return getDb().prepare("DELETE FROM posts WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

export function duplicatePost(id: number, userId: number): Post | null {
  const src = getPost(id, userId);
  if (!src) return null;
  return createPost(userId, {
    title: src.title ? `${src.title} (copia)` : "",
    body: src.body,
    hashtags: src.hashtags,
    scheduledAt: null,
    status: "draft",
    platforms: src.targets.map((t) => t.platform),
    mediaIds: src.media.map((m) => m.id),
  });
}

export function setPostStatus(id: number, status: PostStatus) {
  getDb()
    .prepare(
      "UPDATE posts SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    )
    .run(status, id);
}

/** Sposta un post nel calendario mantenendo l'orario se già presente. */
export function reschedulePost(id: number, userId: number, scheduledAt: string | null) {
  getDb()
    .prepare(
      `UPDATE posts SET scheduled_at = ?,
       status = CASE WHEN ? IS NULL THEN 'draft' WHEN status = 'draft' THEN 'scheduled' ELSE status END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`
    )
    .run(scheduledAt, scheduledAt, id, userId);
}

/** Salva l'adattamento AI per una piattaforma. */
export function saveAdaptedText(
  postId: number,
  platform: Platform,
  adaptedTitle: string | null,
  adaptedBody: string | null
) {
  getDb()
    .prepare(
      "UPDATE post_targets SET adapted_title = ?, adapted_body = ? WHERE post_id = ? AND platform = ?"
    )
    .run(adaptedTitle, adaptedBody, postId, platform);
}

export function updateTarget(
  targetId: number,
  patch: Partial<
    Pick<PostTarget, "status" | "externalId" | "externalUrl" | "error" | "publishedAt" | "nextRetryAt">
  > & {
    incrementAttempts?: boolean;
  }
) {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.status !== undefined) (sets.push("status = ?"), params.push(patch.status));
  if (patch.externalId !== undefined) (sets.push("external_id = ?"), params.push(patch.externalId));
  if (patch.externalUrl !== undefined)
    (sets.push("external_url = ?"), params.push(patch.externalUrl));
  if (patch.error !== undefined) (sets.push("error = ?"), params.push(patch.error));
  if (patch.publishedAt !== undefined)
    (sets.push("published_at = ?"), params.push(patch.publishedAt));
  if (patch.nextRetryAt !== undefined)
    (sets.push("next_retry_at = ?"), params.push(patch.nextRetryAt));
  if (patch.incrementAttempts) sets.push("attempts = attempts + 1");
  if (!sets.length) return;
  params.push(targetId);
  db.prepare(`UPDATE post_targets SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

/** Post programmati (di TUTTI gli utenti) la cui ora è arrivata — usato dallo scheduler. */
export function duePosts(now: Date): Post[] {
  const rows = getDb()
    .prepare("SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at <= ?")
    .all(now.toISOString()) as Record<string, unknown>[];
  return rows.map(rowToPost);
}

/**
 * Target falliti pronti per un nuovo tentativo (next_retry_at scaduto), raggruppati
 * per post → mappa postId ⇒ elenco targetId. Usato dallo scheduler per il retry.
 */
export function dueRetryTargetsByPost(now: Date): Map<number, number[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, post_id FROM post_targets
       WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?`
    )
    .all(now.toISOString()) as { id: number; post_id: number }[];
  const byPost = new Map<number, number[]>();
  for (const r of rows) {
    const list = byPost.get(r.post_id) ?? [];
    list.push(r.id);
    byPost.set(r.post_id, list);
  }
  return byPost;
}

/**
 * Recupero dopo un riavvio: i target rimasti in "publishing" (pubblicazione
 * interrotta a metà da un crash/riavvio) vengono rimessi in coda per un nuovo
 * tentativo immediato. Ritorna gli id dei post coinvolti (per ricalcolarne lo stato).
 */
export function recoverInterruptedTargets(now: Date): number[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT post_id FROM post_targets WHERE status = 'publishing'")
    .all() as { post_id: number }[];
  db.prepare(
    `UPDATE post_targets
     SET status = 'failed', next_retry_at = ?, error = 'Pubblicazione interrotta da un riavvio: riprovo'
     WHERE status = 'publishing'`
  ).run(now.toISOString());
  // i post bloccati in "publishing" tornano coerenti col nuovo stato dei target
  db.prepare("UPDATE posts SET status = 'partial' WHERE status = 'publishing'").run();
  return rows.map((r) => r.post_id);
}

// ---------- MEDIA ----------

export function listMedia(userId: number, filter?: { q?: string; folder?: string }): MediaItem[] {
  let sql = "SELECT * FROM media WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (filter?.q) {
    sql += " AND (original_name LIKE ? OR tags LIKE ?)";
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  if (filter?.folder) {
    sql += " AND folder = ?";
    params.push(filter.folder);
  }
  sql += " ORDER BY created_at DESC";
  return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToMedia);
}

export function getMedia(id: number, userId: number): MediaItem | null {
  const row = getDb()
    .prepare("SELECT * FROM media WHERE id = ? AND user_id = ?")
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? rowToMedia(row) : null;
}

/**
 * Media per id senza filtro utente: usato SOLO per servire il file binario,
 * perché Instagram/Facebook scaricano i media da un URL pubblico e non possono
 * inviare il cookie di sessione. La sola gestione (lista/modifica) resta per-utente.
 */
export function getMediaSystem(id: number): MediaItem | null {
  const row = getDb().prepare("SELECT * FROM media WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToMedia(row) : null;
}

export function createMedia(userId: number, item: Omit<MediaItem, "id" | "userId" | "createdAt">): MediaItem {
  const info = getDb()
    .prepare(
      "INSERT INTO media (user_id, filename, original_name, mime, size, folder, tags) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(userId, item.filename, item.originalName, item.mime, item.size, item.folder, item.tags);
  return getMedia(info.lastInsertRowid as number, userId)!;
}

export function updateMediaMeta(id: number, userId: number, folder: string, tags: string): MediaItem | null {
  getDb()
    .prepare("UPDATE media SET folder = ?, tags = ? WHERE id = ? AND user_id = ?")
    .run(folder, tags, id, userId);
  return getMedia(id, userId);
}

/**
 * Titoli dei post ancora "in coda" (bozza/programmato/in pubblicazione/parziale)
 * che usano questo media. Se non è vuoto, il media non andrebbe cancellato:
 * un post programmato lo pubblicherebbe senza allegato (o fallirebbe).
 */
export function postsUsingMedia(id: number, userId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT p.title, p.id FROM posts p
       JOIN post_media pm ON pm.post_id = p.id
       WHERE pm.media_id = ? AND p.user_id = ?
         AND p.status IN ('draft','scheduled','publishing','partial')`
    )
    .all(id, userId) as { title: string; id: number }[];
  return rows.map((r) => r.title || `Post #${r.id}`);
}

export function deleteMedia(id: number, userId: number): MediaItem | null {
  const item = getMedia(id, userId);
  if (item) getDb().prepare("DELETE FROM media WHERE id = ? AND user_id = ?").run(id, userId);
  return item;
}

export function listFolders(userId: number): string[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT folder FROM media WHERE user_id = ? AND folder != '' ORDER BY folder")
    .all(userId) as { folder: string }[];
  return rows.map((r) => r.folder);
}

// ---------- ACCOUNTS ----------

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    userId: r.user_id as number,
    platform: r.platform as Platform,
    accountName: r.account_name as string,
    accountId: r.account_id as string,
    accessToken: r.access_token as string,
    refreshToken: r.refresh_token as string | null,
    expiresAt: r.expires_at as string | null,
    scopes: r.scopes as string,
    connectedAt: r.connected_at as string,
    meta: r.meta as string,
  };
}

export function getAccount(userId: number, platform: Platform): Account | null {
  const r = getDb()
    .prepare("SELECT * FROM accounts WHERE user_id = ? AND platform = ?")
    .get(userId, platform) as Record<string, unknown> | undefined;
  return r ? rowToAccount(r) : null;
}

export function listAccounts(userId: number): Account[] {
  const rows = getDb()
    .prepare("SELECT * FROM accounts WHERE user_id = ?")
    .all(userId) as Record<string, unknown>[];
  return rows.map(rowToAccount);
}

export function saveAccount(account: Account): void {
  getDb()
    .prepare(
      `INSERT INTO accounts (user_id, platform, account_name, account_id, access_token, refresh_token, expires_at, scopes, meta)
       VALUES (@userId, @platform, @accountName, @accountId, @accessToken, @refreshToken, @expiresAt, @scopes, @meta)
       ON CONFLICT(user_id, platform) DO UPDATE SET
         account_name = @accountName, account_id = @accountId, access_token = @accessToken,
         refresh_token = @refreshToken, expires_at = @expiresAt, scopes = @scopes, meta = @meta,
         connected_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    )
    .run(account as unknown as Record<string, unknown>);
}

export function deleteAccount(userId: number, platform: Platform): boolean {
  return (
    getDb()
      .prepare("DELETE FROM accounts WHERE user_id = ? AND platform = ?")
      .run(userId, platform).changes > 0
  );
}

// ---------- LOGS ----------

/** Log dell'utente + log di sistema (user_id NULL). */
export function listLogs(userId: number, limit = 200) {
  return getDb()
    .prepare(
      `SELECT id, level, scope, message, detail, created_at as createdAt
       FROM logs WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT ?`
    )
    .all(userId, limit);
}

// ---------- TEMPLATE (post e caroselli) ----------

function rowToTemplate(r: Record<string, unknown>): Template {
  let data: Template["data"];
  try {
    data = JSON.parse((r.data as string) || "{}");
  } catch {
    data = {} as Template["data"];
  }
  return {
    id: r.id as number,
    userId: r.user_id as number,
    name: r.name as string,
    kind: r.kind as TemplateKind,
    data,
    createdAt: r.created_at as string,
  };
}

export function listTemplates(userId: number, kind?: TemplateKind): Template[] {
  const db = getDb();
  const rows = (
    kind
      ? db.prepare("SELECT * FROM templates WHERE user_id = ? AND kind = ? ORDER BY name")
          .all(userId, kind)
      : db.prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY kind, name").all(userId)
  ) as Record<string, unknown>[];
  return rows.map(rowToTemplate);
}

export function getTemplate(id: number, userId: number): Template | null {
  const r = getDb()
    .prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
    .get(id, userId) as Record<string, unknown> | undefined;
  return r ? rowToTemplate(r) : null;
}

export function createTemplate(
  userId: number,
  name: string,
  kind: TemplateKind,
  data: Template["data"]
): Template {
  const info = getDb()
    .prepare("INSERT INTO templates (user_id, name, kind, data) VALUES (?, ?, ?, ?)")
    .run(userId, name, kind, JSON.stringify(data));
  return getTemplate(info.lastInsertRowid as number, userId)!;
}

export function updateTemplate(
  id: number,
  userId: number,
  name: string,
  data: Template["data"]
): Template | null {
  if (!getTemplate(id, userId)) return null;
  getDb()
    .prepare("UPDATE templates SET name = ?, data = ? WHERE id = ? AND user_id = ?")
    .run(name, JSON.stringify(data), id, userId);
  return getTemplate(id, userId);
}

export function deleteTemplate(id: number, userId: number): boolean {
  return (
    getDb().prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(id, userId).changes > 0
  );
}

// ---------- LIVE (dirette) ----------

function rowToLive(r: Record<string, unknown>): Live {
  return {
    id: r.id as number,
    userId: r.user_id as number,
    platform: r.platform as Platform,
    title: r.title as string,
    description: r.description as string,
    broadcastId: r.broadcast_id as string,
    ingestUrl: r.ingest_url as string,
    streamKey: r.stream_key as string,
    watchUrl: r.watch_url as string,
    status: r.status as LiveStatus,
    createdAt: r.created_at as string,
  };
}

export function listLives(userId: number): Live[] {
  const rows = getDb()
    .prepare("SELECT * FROM lives WHERE user_id = ? ORDER BY id DESC")
    .all(userId) as Record<string, unknown>[];
  return rows.map(rowToLive);
}

export function getLive(id: number, userId: number): Live | null {
  const r = getDb()
    .prepare("SELECT * FROM lives WHERE id = ? AND user_id = ?")
    .get(id, userId) as Record<string, unknown> | undefined;
  return r ? rowToLive(r) : null;
}

export function createLive(
  userId: number,
  data: Pick<Live, "platform" | "title" | "description" | "broadcastId" | "ingestUrl" | "streamKey" | "watchUrl">
): Live {
  const info = getDb()
    .prepare(
      `INSERT INTO lives (user_id, platform, title, description, broadcast_id, ingest_url, stream_key, watch_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created')`
    )
    .run(
      userId,
      data.platform,
      data.title,
      data.description,
      data.broadcastId,
      data.ingestUrl,
      data.streamKey,
      data.watchUrl
    );
  return getLive(info.lastInsertRowid as number, userId)!;
}

export function setLiveStatus(id: number, userId: number, status: LiveStatus): void {
  getDb().prepare("UPDATE lives SET status = ? WHERE id = ? AND user_id = ?").run(status, id, userId);
}

export function deleteLive(id: number, userId: number): boolean {
  return getDb().prepare("DELETE FROM lives WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

// ---------- CANCELLAZIONE ACCOUNT (GDPR / Meta data deletion) ----------

/**
 * Cancella un utente e TUTTI i suoi dati. Grazie ai vincoli ON DELETE CASCADE,
 * eliminare la riga `users` propaga a posts (→ post_targets, post_media), media,
 * accounts, settings e sessions. I log (senza FK) e i file media su disco vanno
 * rimossi a parte: ritorna i filename dei media così che il chiamante li cancelli.
 */
export function deleteUser(userId: number): string[] {
  const db = getDb();
  const files = (
    db.prepare("SELECT filename FROM media WHERE user_id = ?").all(userId) as { filename: string }[]
  ).map((r) => r.filename);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM logs WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  tx();
  return files;
}

// ---------- EXPORT ----------

/** Esporta i dati dell'utente (backup JSON). I token degli account sono esclusi. */
export function exportAll(userId: number) {
  const db = getDb();
  const posts = db.prepare("SELECT * FROM posts WHERE user_id = ?").all(userId) as { id: number }[];
  const postIds = posts.map((p) => p.id);
  const inClause = postIds.length ? `(${postIds.map(() => "?").join(",")})` : "(NULL)";
  return {
    exportedAt: new Date().toISOString(),
    posts,
    post_targets: db
      .prepare(`SELECT * FROM post_targets WHERE post_id IN ${inClause}`)
      .all(...postIds),
    media: db.prepare("SELECT * FROM media WHERE user_id = ?").all(userId),
    post_media: db.prepare(`SELECT * FROM post_media WHERE post_id IN ${inClause}`).all(...postIds),
    settings: db
      .prepare("SELECT key, value FROM settings WHERE user_id = ? AND key != 'ai_api_key'")
      .all(userId),
  };
}
