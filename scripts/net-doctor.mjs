/**
 * Diagnostica di rete degli upload video — NON pubblica nulla.
 *
 * Perché serve: `fetch()` di Node fallisce con un generico "fetch failed" e
 * nasconde la causa in `cause`. Questo script rifà le stesse chiamate dei
 * moduli Facebook e TikTok stampando causa, codice e tempi, così si distingue
 * un DNS rotto da un file mancante da un timeout su upload lento.
 *
 * Non serve ricostruire l'immagine: basta `git pull` e un container usa-e-getta.
 *   sudo docker run --rm -e DATA_DIR=/data \
 *     -v ~/usocial/data:/data -v ~/usocial/scripts:/scripts \
 *     node:24-alpine node /scripts/net-doctor.mjs
 *
 * Argomento opzionale: id del post da provare (default: l'ultimo fallito).
 *
 * Sicurezza: di Facebook si esegue solo `start` + UN chunk `transfer` — il post
 * nasce solo con `finish`, che qui non viene mai chiamato. Di TikTok si esegue
 * l'`init` e si carica un chunk solo se il video ne ha più di uno (con un chunk
 * solo l'upload completerebbe la pubblicazione, quindi si salta).
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const GRAPH = "https://graph.facebook.com/v21.0";
const TIKTOK = "https://open.tiktokapis.com/v2";
const MAX_CHUNK = 64 * 1024 * 1024;
const DATA = path.resolve(process.env.DATA_DIR || "./data");
const MB = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** Srotola la catena di `cause`: è lì che Node mette l'errore vero. */
function describe(err) {
  const parts = [];
  const seen = new Set();
  let cur = err;
  while (cur instanceof Error && !seen.has(cur)) {
    seen.add(cur);
    const bits = [cur.message];
    if (cur.code && !cur.message.includes(cur.code)) bits.push(`[${cur.code}]`);
    const host = cur.hostname || cur.address;
    if (host) bits.push(`${cur.syscall ? `${cur.syscall} ` : ""}${host}${cur.port ? `:${cur.port}` : ""}`);
    parts.push(bits.join(" "));
    cur = cur.cause;
  }
  return parts.join("\n        <- ") || String(err);
}

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    console.log(`   OK  ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return out;
  } catch (err) {
    console.log(`   KO  ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`        ${describe(err)}`);
    return null;
  }
}

const db = new DatabaseSync(path.join(DATA, "usocial.db"));
const postId =
  Number(process.argv[2]) ||
  db.prepare("SELECT post_id FROM post_targets WHERE status='failed' ORDER BY id DESC LIMIT 1").get()
    ?.post_id;
if (!postId) {
  console.log("Nessun post fallito nel database. Passa un id: node net-doctor.mjs 12");
  process.exit(0);
}
const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(postId);
console.log(`\n== Post #${postId} "${post?.title || ""}" (utente #${post?.user_id})`);
for (const t of db
  .prepare("SELECT platform, status, attempts, error FROM post_targets WHERE post_id=?")
  .all(postId)) {
  console.log(`   ${t.platform.padEnd(10)} ${t.status.padEnd(10)} tentativi ${t.attempts}  ${t.error || ""}`);
}

// -- 1) il file c'è ancora? la size nel DB è quella vera?
const media = db
  .prepare(
    "SELECT m.* FROM media m JOIN post_media pm ON pm.media_id=m.id WHERE pm.post_id=? ORDER BY pm.sort"
  )
  .all(postId);
console.log(`\n-- Media del post (${media.length})`);
let video = null;
for (const m of media) {
  const p = path.join(DATA, "media", m.filename);
  const exists = fs.existsSync(p);
  const real = exists ? fs.statSync(p).size : 0;
  const warn = !exists
    ? "  !! FILE MANCANTE"
    : real !== m.size
      ? `  !! size reale ${MB(real)} != DB ${MB(m.size)}`
      : "";
  console.log(`   ${m.filename}  ${m.mime}  ${MB(m.size)}${warn}`);
  if (!video && m.mime.startsWith("video/") && exists) video = { ...m, path: p, size: real };
}

// -- 2) gli host rispondono? (DNS + TLS + rotta)
console.log("\n-- Raggiungibilita host");
for (const [name, url] of [
  ["graph.facebook.com", `${GRAPH}/me`],
  ["open.tiktokapis.com", `${TIKTOK}/user/info/`],
]) {
  await timed(name, async () => {
    const res = await fetch(url); // 400/401 va benissimo: significa che risponde
    console.log(`     HTTP ${res.status}`);
  });
}

if (!video) {
  console.log("\nNessun video utilizzabile: mi fermo qui.");
  process.exit(0);
}
console.log(`\n-- Video di prova: ${video.filename} (${MB(video.size)})`);

// -- 3) Facebook: start + un chunk di transfer (nessun post viene creato)
const fb = db.prepare("SELECT * FROM accounts WHERE platform='facebook' AND user_id=?").get(post.user_id);
console.log("\n-- Facebook: upload resumable (senza finish, non pubblica)");
if (!fb) {
  console.log("   account non collegato");
} else {
  const meta = JSON.parse(fb.meta || "{}");
  const url = `${GRAPH}/${meta.pageId}/videos`;
  const start = await timed("upload_phase=start", async () => {
    const res = await fetch(url, {
      method: "POST",
      body: new URLSearchParams({
        upload_phase: "start",
        file_size: String(video.size),
        access_token: meta.pageToken,
      }),
    });
    const json = await res.json();
    console.log(`     HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    return res.ok ? json : null;
  });
  if (start?.upload_session_id) {
    const from = Number(start.start_offset);
    const to = Number(start.end_offset);
    console.log(`   chunk richiesto da Meta: ${MB(to - from)}`);
    await timed(`upload_phase=transfer (${MB(to - from)})`, async () => {
      const blob = (await fs.openAsBlob(video.path, { type: video.mime })).slice(from, to, video.mime);
      const form = new FormData();
      form.append("upload_phase", "transfer");
      form.append("upload_session_id", start.upload_session_id);
      form.append("start_offset", String(from));
      form.append("access_token", meta.pageToken);
      form.append("video_file_chunk", blob, "chunk.mp4");
      const res = await fetch(url, { method: "POST", body: form });
      console.log(`     HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    });
  }
}

// -- 4) TikTok: init + un chunk solo se il video ne ha più di uno
const tt = db.prepare("SELECT * FROM accounts WHERE platform='tiktok' AND user_id=?").get(post.user_id);
console.log("\n-- TikTok: init upload");
if (!tt) {
  console.log("   account non collegato");
} else {
  const chunkSize = video.size <= MAX_CHUNK ? video.size : MAX_CHUNK;
  const total = video.size <= MAX_CHUNK ? 1 : Math.floor(video.size / chunkSize);
  console.log(`   piano: chunk_size ${MB(chunkSize)} x ${total}`);
  const init = await timed("video/init", async () => {
    const res = await fetch(`${TIKTOK}/post/publish/video/init/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tt.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        post_info: { title: "test", privacy_level: "SELF_ONLY" },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: video.size,
          chunk_size: chunkSize,
          total_chunk_count: total,
        },
      }),
    });
    const json = await res.json();
    console.log(`     HTTP ${res.status} ${JSON.stringify(json.error || {}).slice(0, 250)}`);
    return res.ok ? json.data : null;
  });
  if (init?.upload_url && total > 1) {
    await timed(`PUT chunk 1/${total} (${MB(chunkSize)})`, async () => {
      const res = await fetch(init.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": video.mime,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes 0-${chunkSize - 1}/${video.size}`,
        },
        body: fs.createReadStream(video.path, { start: 0, end: chunkSize - 1 }),
        duplex: "half",
      });
      console.log(`     HTTP ${res.status}`);
    });
  } else if (init?.upload_url) {
    console.log("   chunk unico: salto l'upload per non pubblicare davvero.");
  }
}
console.log("\nFatto. Nessun contenuto e stato pubblicato.\n");
