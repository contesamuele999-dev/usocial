/**
 * Database SQLite (better-sqlite3).
 * Singleton con schema idempotente (CREATE TABLE IF NOT EXISTS) + una piccola
 * migrazione che porta un DB "single-user" pre-esistente allo schema multi-utente.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import { env } from "./env";

let _db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS post_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  adapted_title TEXT,
  adapted_body TEXT,
  -- tipo di pubblicazione scelto per questa piattaforma (feed, reel, story, …)
  post_type TEXT,
  -- opzioni per-piattaforma scelte dall'utente, JSON (TikTok: privacy, commenti, …)
  options TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  external_url TEXT,
  error TEXT,
  published_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  UNIQUE(post_id, platform)
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  folder TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  -- Momento a partire dal quale il file puo' essere tolto dal disco: lo scrive
  -- il publisher dopo una pubblicazione riuscita (pubblicazione + 24 h). NULL =
  -- da conservare. Il ritardo esiste perche' cancellare subito toglieva il file
  -- da sotto ai post gia' in coda per le altre piattaforme.
  reclaim_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS post_media (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, media_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  scopes TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  meta TEXT NOT NULL DEFAULT '{}',
  UNIQUE(user_id, platform)
);

-- Chiavi API per gli agenti IA (CLI/MCP). Si salva solo l'hash SHA-256:
-- la chiave in chiaro viene mostrata una volta sola alla creazione.
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  level TEXT NOT NULL DEFAULT 'info',
  scope TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'post',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS lives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  broadcast_id TEXT NOT NULL DEFAULT '',
  ingest_url TEXT NOT NULL DEFAULT '',
  stream_key TEXT NOT NULL DEFAULT '',
  watch_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Ultima fotografia delle metriche di un post pubblicato, una riga per
-- piattaforma. Non e' uno storico: la pagina Statistiche mette in relazione i
-- numeri con la DATA DI PUBBLICAZIONE, quindi l'andamento nel tempo si ricava
-- gia' da qui e il DB resta piccolo (la VM ha un disco condiviso).
-- La colonna error conserva il motivo per cui una lettura non e' riuscita:
-- senza, un post senza numeri e uno con zero visualizzazioni sono uguali.
CREATE TABLE IF NOT EXISTS post_metrics (
  target_id INTEGER PRIMARY KEY REFERENCES post_targets(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER,
  platform TEXT NOT NULL,
  views INTEGER,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  clicks INTEGER,
  followers INTEGER,
  error TEXT,
  -- 1 = la piattaforma non espone quelle statistiche e non le esporra' mai
  -- (profilo personale LinkedIn, storia Instagram scaduta). Serve a non
  -- consigliare all'utente di ricollegare un account che va benissimo.
  unavailable INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Regole del risponditore automatico ai commenti ("commenta PAUSA e ti mando
-- la guida"). Nascono DISATTIVATE: una regola che parte da sola scriverebbe a
-- persone vere prima che l'utente abbia visto cosa dice.
CREATE TABLE IF NOT EXISTS autoreply_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  keyword TEXT NOT NULL,
  -- 'word' = parola intera (PAUSA non scatta su "pausapranzo"), 'contains' = ovunque
  match_mode TEXT NOT NULL DEFAULT 'word',
  -- piattaforme separate da virgola; vuoto = tutte quelle collegate
  platforms TEXT NOT NULL DEFAULT '',
  public_reply TEXT NOT NULL DEFAULT '',
  private_reply TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Commenti gia' esaminati. La chiave primaria (piattaforma, commento) e' cio'
-- che rende il risponditore idempotente: il motore rilegge gli stessi commenti
-- a ogni giro e senza questa riga scriverebbe di nuovo alla stessa persona a
-- ogni passaggio. Meta, per giunta, accetta UN SOLO messaggio privato per
-- commento: il secondo tentativo sarebbe comunque un errore.
CREATE TABLE IF NOT EXISTS comment_replies (
  platform TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  user_id INTEGER,
  rule_id INTEGER,
  target_id INTEGER,
  post_id INTEGER,
  author TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  -- 'replied' | 'skipped' (nessuna regola) | 'failed' | 'simulated'
  status TEXT NOT NULL DEFAULT 'skipped',
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (platform, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_targets_post ON post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_targets_retry ON post_targets(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_reclaim ON media(reclaim_at);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_lives_user ON lives(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_post_media_media ON post_media(media_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON post_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_post ON post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_autoreply_user ON autoreply_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_user ON comment_replies(user_id, created_at);
`;

function tableExists(db: Database.Database, table: string): boolean {
  return !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table);
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/**
 * Migrazione da schema single-user (pre-login) a multi-utente:
 * - aggiunge user_id a posts/media/logs se manca;
 * - ricrea accounts/settings (vecchia PK: platform/key) nella nuova forma per-utente.
 *   I dati di accounts/settings pre-esistenti erano globali e privi di utente:
 *   vengono azzerati (gli account vanno ricollegati dopo il primo login).
 */
function migrate(db: Database.Database) {
  if (tableExists(db, "posts") && !hasColumn(db, "posts", "user_id")) {
    db.exec("ALTER TABLE posts ADD COLUMN user_id INTEGER");
  }
  if (tableExists(db, "media") && !hasColumn(db, "media", "user_id")) {
    db.exec("ALTER TABLE media ADD COLUMN user_id INTEGER");
  }
  if (tableExists(db, "media") && !hasColumn(db, "media", "reclaim_at")) {
    db.exec("ALTER TABLE media ADD COLUMN reclaim_at TEXT");
  }
  if (tableExists(db, "logs") && !hasColumn(db, "logs", "user_id")) {
    db.exec("ALTER TABLE logs ADD COLUMN user_id INTEGER");
  }
  if (tableExists(db, "post_targets") && !hasColumn(db, "post_targets", "next_retry_at")) {
    db.exec("ALTER TABLE post_targets ADD COLUMN next_retry_at TEXT");
  }
  if (tableExists(db, "post_targets") && !hasColumn(db, "post_targets", "post_type")) {
    db.exec("ALTER TABLE post_targets ADD COLUMN post_type TEXT");
  }
  if (tableExists(db, "post_targets") && !hasColumn(db, "post_targets", "options")) {
    db.exec("ALTER TABLE post_targets ADD COLUMN options TEXT");
  }
  if (tableExists(db, "post_metrics") && !hasColumn(db, "post_metrics", "unavailable")) {
    db.exec("ALTER TABLE post_metrics ADD COLUMN unavailable INTEGER NOT NULL DEFAULT 0");
  }
  if (tableExists(db, "accounts") && !hasColumn(db, "accounts", "user_id")) {
    db.exec("DROP TABLE accounts");
  }
  if (tableExists(db, "settings") && !hasColumn(db, "settings", "user_id")) {
    db.exec("DROP TABLE settings");
  }
}

function init(db: Database.Database) {
  db.pragma("foreign_keys = ON");
  migrate(db);
  db.exec(SCHEMA);
}

/** Apre (o riusa) la connessione al DB. In dev sopravvive all'hot-reload via globalThis. */
export function getDb(): Database.Database {
  const g = globalThis as unknown as { __usocialDb?: Database.Database };
  if (g.__usocialDb) return g.__usocialDb;
  if (_db) return _db;

  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.mkdirSync(env.mediaDir, { recursive: true });

  const db = new Database(env.dbPath);
  db.pragma("journal_mode = WAL");
  init(db);

  _db = db;
  g.__usocialDb = db;
  return db;
}

/** Crea un DB in memoria con lo stesso schema (per i test). */
export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  init(db);
  return db;
}

/** Lettura/scrittura impostazioni chiave-valore per utente (config AI, ecc.). */
export function getSetting(userId: number, key: string, fallback = ""): string {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE user_id = ? AND key = ?")
    .get(userId, key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(userId: number, key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
    )
    .run(userId, key, value);
}
