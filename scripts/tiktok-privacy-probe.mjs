/**
 * Prova l'init del Direct Post TikTok con ogni privacy_level ammesso — NON pubblica.
 *
 * Perché: con l'app auditata (`creator_info` restituisce PUBLIC_TO_EVERYONE) l'init
 * risponde comunque 403 `unaudited_client_can_only_post_to_private_accounts`.
 * Il modulo manda `SELF_ONLY` fisso: questo script verifica se è quello il
 * parametro rifiutato, provando i livelli uno per uno e stampando code e log_id.
 *
 * L'init riserva solo un upload_url: senza il PUT dei byte non nasce alcun post.
 *
 *   sudo docker run --rm -e DATA_DIR=/data \
 *     -v ~/usocial/data:/data -v ~/usocial/scripts:/scripts \
 *     node:24-alpine node /scripts/tiktok-privacy-probe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const API = "https://open.tiktokapis.com/v2";
const MAX_CHUNK = 64 * 1024 * 1024;
const DATA = path.resolve(process.env.DATA_DIR || "./data");
const MB = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

const db = new DatabaseSync(path.join(DATA, "usocial.db"));
const account = db.prepare("SELECT * FROM accounts WHERE platform='tiktok' LIMIT 1").get();
if (!account) {
  console.log("Nessun account TikTok collegato.");
  process.exit(0);
}
const auth = { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" };

// Video reale dell'ultimo post fallito: i parametri devono essere quelli veri.
const media = db
  .prepare(
    `SELECT m.* FROM media m
     JOIN post_media pm ON pm.media_id = m.id
     WHERE pm.post_id = (SELECT post_id FROM post_targets WHERE status='failed' ORDER BY id DESC LIMIT 1)
       AND m.mime LIKE 'video/%'
     LIMIT 1`
  )
  .get();
const file = media && path.join(DATA, "media", media.filename);
const size = file && fs.existsSync(file) ? fs.statSync(file).size : 20 * 1024 * 1024;
console.log(`\nVideo: ${media?.filename || "(nessuno, uso una size fittizia)"} — ${MB(size)}`);

const chunkSize = size <= MAX_CHUNK ? size : MAX_CHUNK;
const totalChunks = size <= MAX_CHUNK ? 1 : Math.floor(size / chunkSize);
console.log(`Piano: chunk_size ${MB(chunkSize)} x ${totalChunks}\n`);

// Livelli davvero permessi per questo creator, con SELF_ONLY sempre in coda.
const info = await fetch(`${API}/post/publish/creator_info/query/`, { method: "POST", headers: auth });
const levels = (await info.json())?.data?.privacy_level_options || ["SELF_ONLY"];
console.log(`privacy_level_options: ${levels.join(", ")}\n`);

for (const level of levels) {
  const res = await fetch(`${API}/post/publish/video/init/`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      post_info: { title: "prova diagnostica", privacy_level: level },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks,
      },
    }),
  });
  const json = await res.json();
  const err = json.error || {};
  const ok = res.ok && (!err.code || err.code === "ok");
  console.log(`── privacy_level: ${level}`);
  console.log(`   HTTP ${res.status}  ${ok ? "OK — init accettato" : `RIFIUTATO`}`);
  if (!ok) {
    console.log(`   code   : ${err.code}`);
    console.log(`   message: ${err.message}`);
    console.log(`   log_id : ${err.log_id}`);
  }
}
console.log("\nFatto. Nessun video caricato, nessun post creato.\n");
