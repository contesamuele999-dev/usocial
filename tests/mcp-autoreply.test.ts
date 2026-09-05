/**
 * Server MCP, strumenti del risponditore automatico.
 *
 * Qui si prova una cosa sola ma importante: che i valori PREDEFINITI siano
 * quelli innocui. Un agente IA che chiama questi strumenti senza pensarci non
 * deve poter far partire commenti pubblici e messaggi privati verso persone
 * vere — deve chiederlo esplicitamente.
 *
 * Il server MCP viene avviato davvero, come processo figlio, e puntato su un
 * finto uSocial che si limita a registrare le richieste ricevute.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http from "node:http";
import readline from "node:readline";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

interface Recorded {
  method: string;
  url: string;
  body: Record<string, unknown> | null;
}

let server: http.Server;
let child: ChildProcessWithoutNullStreams;
let received: Recorded[] = [];
/** Risposte pronte per le GET che gli strumenti fanno prima di scrivere. */
const canned: Record<string, unknown> = {
  "/api/autoreply/rules": {
    rules: [
      {
        id: 7,
        name: "Guida",
        keyword: "PAUSA",
        matchMode: "word",
        platforms: [],
        publicReply: "Controlla i messaggi",
        privateReply: "Ecco la guida",
        enabled: false,
      },
    ],
    log: [],
  },
};

/** Manda una richiesta JSON-RPC al server MCP e aspetta la risposta con quell'id. */
function rpc(id: number, method: string, params?: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout su ${method}`)), 10_000);
    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      let msg: { id?: number; result?: Record<string, unknown>; error?: { message?: string } };
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id !== id) return;
      clearTimeout(timer);
      rl.close();
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result || {});
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

/** Chiama uno strumento e restituisce la richiesta HTTP che ne è derivata. */
async function callTool(id: number, name: string, args: Record<string, unknown> = {}) {
  received = [];
  await rpc(id, "tools/call", { name, arguments: args });
  return received;
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received.push({
        method: req.method || "",
        url: req.url || "",
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
      });
      res.writeHead(200, { "content-type": "application/json" });
      const path = (req.url || "").split("?")[0];
      res.end(JSON.stringify(canned[path] ?? { ok: true }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  child = spawn("node", ["scripts/mcp-server.mjs"], {
    env: {
      ...process.env,
      USOCIAL_URL: `http://127.0.0.1:${port}`,
      USOCIAL_API_KEY: "usk_test",
    },
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
  await rpc(1, "initialize");
});

afterAll(async () => {
  child?.kill();
  await new Promise<void>((r) => server.close(() => r()));
});

describe("strumenti MCP del risponditore", () => {
  it("espone gli strumenti del risponditore", async () => {
    const res = (await rpc(2, "tools/list")) as { tools: { name: string }[] };
    const names = res.tools.map((t) => t.name);
    expect(names).toContain("usocial_autoreply_rules");
    expect(names).toContain("usocial_autoreply_create_rule");
    expect(names).toContain("usocial_autoreply_run");
  });

  it("crea le regole SPENTE se non viene chiesto il contrario", async () => {
    // Una regola attiva scrive a persone vere ogni cinque minuti: non deve
    // poter nascere accesa perché l'agente ha omesso un campo.
    const reqs = await callTool(3, "usocial_autoreply_create_rule", { keyword: "PAUSA", publicReply: "ciao" });
    expect(reqs[0].method).toBe("POST");
    expect(reqs[0].body).toMatchObject({ keyword: "PAUSA", enabled: false });
  });

  it("lascia attivare la regola quando è una scelta esplicita", async () => {
    const reqs = await callTool(4, "usocial_autoreply_create_rule", {
      keyword: "PAUSA",
      publicReply: "ciao",
      enabled: true,
    });
    expect(reqs[0].body).toMatchObject({ enabled: true });
  });

  it("l'esecuzione è una PROVA A VUOTO se non si chiede di inviare davvero", async () => {
    const reqs = await callTool(5, "usocial_autoreply_run");
    expect(reqs[0].url).toContain("simulate=1");
  });

  it("invia davvero solo con simulate:false", async () => {
    const reqs = await callTool(6, "usocial_autoreply_run", { simulate: false });
    expect(reqs[0].url).not.toContain("simulate");
  });

  it("l'aggiornamento parziale non spegne né riaccende la regola per sbaglio", async () => {
    // L'API riscrive la regola per intero: senza il merge, cambiare il solo
    // testo azzererebbe parola chiave e stato.
    const reqs = await callTool(7, "usocial_autoreply_update_rule", { id: 7, publicReply: "nuovo testo" });
    const put = reqs.find((r) => r.method === "PUT");
    expect(put?.body).toMatchObject({
      keyword: "PAUSA",
      publicReply: "nuovo testo",
      privateReply: "Ecco la guida",
      enabled: false,
    });
  });

  it("le statistiche non chiamano le API social se non richiesto", async () => {
    // GET = legge la fotografia salvata; POST = va a interrogare i social.
    expect((await callTool(8, "usocial_stats"))[0].method).toBe("GET");
    expect((await callTool(9, "usocial_stats", { refresh: true }))[0].method).toBe("POST");
  });
});
