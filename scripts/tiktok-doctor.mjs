/**
 * Diagnostica dell'integrazione TikTok — sola lettura, non pubblica nulla.
 *
 * Perché serve: apiFetch (src/social/types.ts) tiene solo `error.message`, ma la
 * causa vera di un 403 sta in `error.code` e il supporto TikTok chiede `log_id`.
 * Questo script rifà le stesse chiamate del modulo e stampa le risposte grezze.
 *
 * Uso (sull'host, dove ./data è montato dal container):
 *   node scripts/tiktok-doctor.mjs
 * Oppure dentro il container:
 *   docker compose cp scripts/tiktok-doctor.mjs usocial:/app/doctor.mjs
 *   docker compose exec usocial node /app/doctor.mjs
 */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const API = "https://open.tiktokapis.com/v2";
const dbPath = path.join(path.resolve(process.env.DATA_DIR || "./data"), "usocial.db");

function openDb() {
  try {
    return new DatabaseSync(dbPath, { readOnly: true });
  } catch {
    return new DatabaseSync(dbPath); // versioni di Node senza l'opzione readOnly
  }
}

/** Token mascherato: serve sapere che c'è, non qual è. */
const mask = (t) => (t ? `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} char)` : "(assente)");

async function call(label, url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  console.log(`\n── ${label}`);
  console.log(`   HTTP ${res.status}`);
  try {
    const json = JSON.parse(text);
    const err = json.error || {};
    if (err.code && err.code !== "ok") {
      console.log(`   error.code : ${err.code}`);
      console.log(`   message    : ${err.message}`);
      console.log(`   log_id     : ${err.log_id}`);
    }
    if (json.data) console.log(`   data       : ${JSON.stringify(json.data)}`);
  } catch {
    console.log(`   body: ${text.slice(0, 500)}`);
  }
}

const db = openDb();
const rows = db
  .prepare("SELECT user_id, account_name, account_id, access_token, expires_at, scopes, connected_at FROM accounts WHERE platform = 'tiktok'")
  .all();

if (rows.length === 0) {
  console.log("Nessun account TikTok collegato nel database.");
  process.exit(0);
}

for (const a of rows) {
  console.log(`\n══ Account TikTok "${a.account_name}" (utente #${a.user_id})`);
  console.log(`   open_id      : ${a.account_id}`);
  console.log(`   collegato il : ${a.connected_at}`);
  console.log(`   scadenza     : ${a.expires_at || "(ignota)"}`);
  if (a.expires_at && new Date(a.expires_at) < new Date()) {
    console.log("   ⚠ access token SCADUTO secondo il database");
  }
  console.log(`   access_token : ${mask(a.access_token)}`);
  // Scope davvero concessi al token: se manca video.publish il Direct Post fallisce
  // anche con l'app auditata — va ricollegato l'account.
  console.log(`   scopes       : ${a.scopes || "(non registrati)"}`);
  if (a.scopes && !a.scopes.includes("video.publish")) {
    console.log("   ⚠ il token NON contiene video.publish");
  }

  const auth = { Authorization: `Bearer ${a.access_token}` };

  await call("user/info (il token è vivo?)", `${API}/user/info/?fields=open_id,display_name`, {
    headers: auth,
  });

  // Restituisce privacy_level_options, limiti di durata e i flag dell'account:
  // è la stessa porta d'ingresso che TikTok controlla prima del Direct Post.
  await call("post/publish/creator_info/query (permessi di pubblicazione)", `${API}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json; charset=UTF-8" },
  });
}
