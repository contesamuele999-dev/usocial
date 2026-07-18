"use client";
/**
 * Impostazioni: connessione account social (OAuth), verifica token,
 * configurazione AI, backup/esportazione dati.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, fmtDate, type PlatformInfo } from "@/lib/client";

function SettingsInner() {
  const params = useSearchParams();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [verify, setVerify] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api<PlatformInfo[]>("/api/platforms").then(setPlatforms);
  }, []);

  useEffect(() => {
    load();
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setBanner({ ok: true, text: `✅ Account ${connected} connesso!` });
    if (error) setBanner({ ok: false, text: `❌ Connessione fallita: ${error}` });
  }, [load, params]);

  const doVerify = async (platform: string) => {
    setVerify((v) => ({ ...v, [platform]: "Verifica in corso…" }));
    try {
      const r = await api<{ ok: boolean; message: string }>(`/api/accounts/${platform}`, {
        method: "POST",
      });
      setVerify((v) => ({ ...v, [platform]: (r.ok ? "✅ " : "❌ ") + r.message }));
    } catch (err) {
      setVerify((v) => ({ ...v, [platform]: `❌ ${err instanceof Error ? err.message : err}` }));
    }
  };

  const disconnect = async (platform: string) => {
    if (!confirm(`Disconnettere ${platform}?`)) return;
    await api(`/api/accounts/${platform}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      {banner && (
        <div
          className={`card ${
            banner.ok
              ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
              : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Account social */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🔗 Account social</h2>
        {platforms.map((p) => (
          <div key={p.platform} className="card flex flex-wrap items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.displayName}</p>
              {p.connected ? (
                <p className="truncate text-sm text-gray-500">
                  {p.accountName}
                  {p.expiresAt && ` · token scade: ${fmtDate(p.expiresAt)}`}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Non connesso</p>
              )}
              {verify[p.platform] && <p className="text-xs">{verify[p.platform]}</p>}
            </div>
            {p.connected ? (
              <>
                <button className="btn-secondary text-xs" onClick={() => doVerify(p.platform)}>
                  Verifica token
                </button>
                <button className="btn-danger text-xs" onClick={() => disconnect(p.platform)}>
                  Disconnetti
                </button>
              </>
            ) : (
              <a href={`/api/connect/${p.platform}`} className="btn-primary text-xs">
                Connetti
              </a>
            )}
          </div>
        ))}
        <p className="text-xs text-gray-500">
          Per connettere un account servono le credenziali OAuth nel file <code>.env</code> (vedi
          README e <code>.env.example</code>).
        </p>
      </section>

      <AiSettings />

      {/* Backup */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">💾 Backup ed esportazione</h2>
        <div className="card flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="font-medium">Esporta tutti i dati</p>
            <p className="text-sm text-gray-500">
              Post, media (metadati), impostazioni e log in un file JSON. I token degli account non
              vengono mai esportati. I file media sono nella cartella <code>data/media</code>.
            </p>
          </div>
          <a href="/api/export" className="btn-secondary" download>
            ⬇️ Scarica backup JSON
          </a>
        </div>
      </section>
    </div>
  );
}

function AiSettings() {
  const [provider, setProvider] = useState("mock");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api<{ provider: string; model: string; baseUrl: string; hasApiKey: boolean }>(
      "/api/settings/ai"
    ).then((c) => {
      setProvider(c.provider);
      setModel(c.model);
      setBaseUrl(c.baseUrl);
      setHasKey(c.hasApiKey);
    });
  }, []);

  const save = async () => {
    await api("/api/settings/ai", {
      method: "PUT",
      body: JSON.stringify({ provider, model, apiKey, baseUrl }),
    });
    setApiKey("");
    setHasKey(hasKey || !!apiKey);
    setSaved("✅ Configurazione AI salvata.");
    setTimeout(() => setSaved(""), 3000);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">🤖 Configurazione AI</h2>
      <div className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Provider
            <select className="input mt-1" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="mock">Mock (senza API, per prove)</option>
              <option value="gemini">Google Gemini (2.5 Flash — gratuito)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (modelli locali)</option>
            </select>
          </label>
          <label className="block text-sm">
            Modello
            <input
              className="input mt-1"
              placeholder={
                provider === "anthropic"
                  ? "claude-sonnet-5"
                  : provider === "openai"
                    ? "gpt-4o-mini"
                    : provider === "gemini"
                      ? "gemini-2.5-flash"
                      : provider === "ollama"
                        ? "llama3.1"
                        : "—"
              }
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            API key {hasKey && <span className="text-xs text-green-600">(già impostata)</span>}
            <input
              className="input mt-1"
              type="password"
              placeholder={hasKey ? "•••••••• (lascia vuoto per non cambiare)" : "sk-…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Base URL (solo Ollama/proxy)
            <input
              className="input mt-1"
              placeholder="http://localhost:11434"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
        </div>
        {provider === "gemini" && (
          <p className="text-xs text-gray-500">
            🎁 <strong>gemini-2.5-flash</strong> è gratuito col piano di Google AI Studio.
            Ottieni la chiave su{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              aistudio.google.com/apikey
            </a>{" "}
            e incollala qui sopra.
          </p>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save}>
            💾 Salva configurazione AI
          </button>
          {saved && <span className="text-sm text-green-600">{saved}</span>}
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
