/**
 * Autenticazione: utenti (email + password) e sessioni su DB.
 * Nessuna dipendenza esterna: hashing con scrypt (Node crypto), sessioni
 * identificate da un token casuale salvato in un cookie httpOnly.
 */
import crypto from "node:crypto";
import { getDb } from "./db";
import { AppError } from "./errors";
import { SESSION_COOKIE } from "./constants";
import type { User } from "@/types";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

// ---------- password ----------

/** Ritorna "salt:hash" (scrypt). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ---------- utenti ----------

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as number,
    email: r.email as string,
    name: r.name as string,
    createdAt: r.created_at as string,
  };
}

export function countUsers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as Record<string, unknown> | undefined;
  return r ? { ...rowToUser(r), passwordHash: r.password_hash as string } : null;
}

export function getUserById(id: number): User | null {
  const r = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return r ? rowToUser(r) : null;
}

export function createUser(email: string, name: string, password: string): User {
  const normalized = email.toLowerCase().trim();
  if (getUserByEmail(normalized)) {
    throw new AppError("Esiste già un account con questa email", 409);
  }
  const info = getDb()
    .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
    .run(normalized, name.trim(), hashPassword(password));
  return getUserById(info.lastInsertRowid as number)!;
}

// ---------- sessioni ----------

/** Crea una sessione e ritorna il token da mettere nel cookie. */
export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString();
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt);
  return token;
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** Ritorna l'utente della sessione, oppure null se assente/scaduta. */
export function getSessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const row = getDb().prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
    | { user_id: number; expires_at: string }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return getUserById(row.user_id);
}

// ---------- chiavi API (agenti IA: CLI, MCP, script) ----------

export interface ApiKeyInfo {
  id: number;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Crea una chiave API. Il valore in chiaro è restituito UNA sola volta:
 * a DB resta solo l'hash, come per le password.
 */
export function createApiKey(userId: number, name: string): { key: string } & ApiKeyInfo {
  const key = `usk_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = key.slice(0, 12);
  const info = getDb()
    .prepare("INSERT INTO api_keys (user_id, name, key_hash, prefix) VALUES (?, ?, ?, ?)")
    .run(userId, name.trim() || "agente IA", hashKey(key), prefix);
  const row = getDb()
    .prepare("SELECT * FROM api_keys WHERE id = ?")
    .get(info.lastInsertRowid as number) as Record<string, unknown>;
  return {
    key,
    id: row.id as number,
    name: row.name as string,
    prefix,
    createdAt: row.created_at as string,
    lastUsedAt: null,
  };
}

export function listApiKeys(userId: number): ApiKeyInfo[] {
  const rows = getDb()
    .prepare("SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC")
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    prefix: r.prefix as string,
    createdAt: r.created_at as string,
    lastUsedAt: r.last_used_at as string | null,
  }));
}

export function deleteApiKey(id: number, userId: number): boolean {
  return getDb().prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

/** Utente proprietario della chiave (aggiorna l'ultimo utilizzo), o null. */
export function getUserByApiKey(key: string): User | null {
  const row = getDb().prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(hashKey(key)) as
    | { id: number; user_id: number }
    | undefined;
  if (!row) return null;
  getDb()
    .prepare("UPDATE api_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(row.id);
  return getUserById(row.user_id);
}

// ---------- lettura cookie dalla request ----------

export function readSessionToken(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") || "";
  return cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
}

/**
 * Utente corrente o null.
 * Due modi di autenticarsi: cookie di sessione (browser) oppure
 * `Authorization: Bearer usk_…` (agenti IA via API/MCP).
 */
export function getRequestUser(req: Request): User | null {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) return getUserByApiKey(bearer);
  return getSessionUser(readSessionToken(req));
}

/** Utente corrente o errore 401. */
export function requireUser(req: Request): User {
  const user = getRequestUser(req);
  if (!user) throw new AppError("Autenticazione richiesta", 401);
  return user;
}

/** Attributi del cookie di sessione (SameSite=Lax così torna dopo il redirect OAuth). */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
    secure: process.env.NODE_ENV === "production",
  };
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 3600;
