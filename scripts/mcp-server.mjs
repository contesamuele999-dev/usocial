#!/usr/bin/env node
/**
 * Server MCP di uSocial — permette a Claude Code (e a qualsiasi altro agente
 * che parli MCP) di caricare media, creare, programmare e pubblicare post
 * direttamente dalla CLI.
 *
 * Configurazione (due variabili d'ambiente):
 *   USOCIAL_URL      — es. https://usocial.example.com (default http://localhost:3000)
 *   USOCIAL_API_KEY  — chiave "usk_…" creata in uSocial → Impostazioni → Agenti IA
 *
 * Registrazione in Claude Code:
 *   claude mcp add usocial --env USOCIAL_URL=... --env USOCIAL_API_KEY=usk_... -- node scripts/mcp-server.mjs
 *
 * Nessuna dipendenza: JSON-RPC su stdio, come previsto dal transport stdio MCP.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";

const BASE = (process.env.USOCIAL_URL || "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.USOCIAL_API_KEY || "";
const PROTOCOL_VERSION = "2024-11-05";

/** MIME per estensione: il server rifiuta i tipi non supportati. */
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

async function call(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

/** Upload di un file locale in streaming (nessun limite pratico di dimensione). */
async function uploadFile(filePath, folder) {
  const abs = path.resolve(filePath);
  const stat = await fs.promises.stat(abs);
  const mime = MIME[path.extname(abs).toLowerCase()];
  if (!mime) throw new Error(`Estensione non supportata: ${path.extname(abs)}`);
  const res = await fetch(`${BASE}/api/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "x-filename": encodeURIComponent(path.basename(abs)),
      ...(folder ? { "x-folder": folder } : {}),
    },
    body: Readable.toWeb(fs.createReadStream(abs)),
    duplex: "half",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

const TOOLS = [
  {
    name: "usocial_platforms",
    description:
      "Elenca le piattaforme social (Facebook, Instagram, TikTok, YouTube, LinkedIn) con stato di connessione e limiti (caratteri, tipi di media ammessi, numero massimo di media).",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/api/platforms"),
  },
  {
    name: "usocial_list_posts",
    description: "Elenca i post dell'utente. Filtri opzionali: status (draft|scheduled|published|failed|partial), platform, q (ricerca testo).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        platform: { type: "string" },
        q: { type: "string" },
      },
    },
    run: (a) => {
      const p = new URLSearchParams();
      for (const k of ["status", "platform", "q"]) if (a[k]) p.set(k, a[k]);
      return call("GET", `/api/posts?${p}`);
    },
  },
  {
    name: "usocial_get_post",
    description: "Dettaglio di un post: testo, media, stato per ogni piattaforma, errori ed eventuale prossimo tentativo.",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    run: (a) => call("GET", `/api/posts/${a.id}`),
  },
  {
    name: "usocial_upload_media",
    description:
      "Carica un file locale (immagine o video) nella libreria di uSocial e ritorna il media con il suo id, da usare in mediaIds. Formati: jpg, png, gif, webp, mp4, mov, webm.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Percorso del file sul disco locale" },
        folder: { type: "string", description: "Cartella della libreria (opzionale)" },
      },
      required: ["path"],
    },
    run: (a) => uploadFile(a.path, a.folder),
  },
  {
    name: "usocial_list_media",
    description: "Elenca i media in libreria (id, nome, tipo, dimensione).",
    inputSchema: { type: "object", properties: { q: { type: "string" }, folder: { type: "string" } } },
    run: (a) => {
      const p = new URLSearchParams();
      for (const k of ["q", "folder"]) if (a[k]) p.set(k, a[k]);
      return call("GET", `/api/media?${p}`);
    },
  },
  {
    name: "usocial_create_post",
    description:
      "Crea un post. Con scheduledAt (ISO 8601) e status='scheduled' viene pubblicato automaticamente a quell'ora; con status='draft' resta bozza.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        hashtags: { type: "string" },
        platforms: { type: "array", items: { type: "string" } },
        mediaIds: { type: "array", items: { type: "number" } },
        scheduledAt: { type: "string", description: "Data/ora ISO 8601, es. 2026-09-01T18:30:00Z" },
        status: { type: "string", enum: ["draft", "scheduled"] },
      },
      required: ["body"],
    },
    run: (a) =>
      call("POST", "/api/posts", {
        title: a.title || "",
        body: a.body,
        hashtags: a.hashtags || "",
        platforms: a.platforms || [],
        mediaIds: a.mediaIds || [],
        scheduledAt: a.scheduledAt || null,
        status: a.status || (a.scheduledAt ? "scheduled" : "draft"),
      }),
  },
  {
    name: "usocial_update_post",
    description: "Aggiorna un post esistente (stessi campi di usocial_create_post).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number" },
        title: { type: "string" },
        body: { type: "string" },
        hashtags: { type: "string" },
        platforms: { type: "array", items: { type: "string" } },
        mediaIds: { type: "array", items: { type: "number" } },
        scheduledAt: { type: "string" },
        status: { type: "string", enum: ["draft", "scheduled"] },
      },
      required: ["id"],
    },
    run: async (a) => {
      const current = await call("GET", `/api/posts/${a.id}`);
      return call("PUT", `/api/posts/${a.id}`, {
        title: a.title ?? current.title,
        body: a.body ?? current.body,
        hashtags: a.hashtags ?? current.hashtags,
        platforms: a.platforms ?? current.targets.map((t) => t.platform),
        mediaIds: a.mediaIds ?? current.media.map((m) => m.id),
        scheduledAt: a.scheduledAt ?? current.scheduledAt,
        status: a.status ?? (current.status === "scheduled" ? "scheduled" : "draft"),
      });
    },
  },
  {
    name: "usocial_publish_post",
    description: "Pubblica subito un post su tutte le piattaforme selezionate. Ritorna l'esito per piattaforma.",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    run: (a) => call("POST", `/api/posts/${a.id}/publish`),
  },
  {
    name: "usocial_delete_post",
    description: "Elimina un post.",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    run: (a) => call("DELETE", `/api/posts/${a.id}`),
  },
  {
    name: "usocial_storage",
    description: "Spazio occupato dai media dell'utente e quota residua.",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/api/storage"),
  },
];

// ---------- JSON-RPC su stdio ----------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { method, params } = msg;
  if (method === "initialize") {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "usocial", version: "1.0.0" },
    };
  }
  if (method === "tools/list") {
    return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
  }
  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) throw new Error(`Tool sconosciuto: ${params?.name}`);
    if (!KEY) throw new Error("USOCIAL_API_KEY non impostata: crea una chiave in Impostazioni → Agenti IA.");
    const result = await tool.run(params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (method === "ping") return {};
  throw new Error(`Metodo non supportato: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === undefined) return; // notifica (es. notifications/initialized): nessuna risposta
  try {
    send({ jsonrpc: "2.0", id: msg.id, result: await handle(msg) });
  } catch (err) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: String(err?.message || err) } });
  }
});
