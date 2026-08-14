"use client";
/**
 * Impostazioni: connessione account social (OAuth), verifica token,
 * configurazione AI, backup/esportazione dati.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, getPlatforms, fmtDate, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

function SettingsInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [verify, setVerify] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    getPlatforms(true).then(setPlatforms);
  }, []);

  useEffect(() => {
    load();
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setBanner({ ok: true, text: t("settings.connected", { platform: connected }) });
    if (error) setBanner({ ok: false, text: t("settings.connectFailed", { error }) });
  }, [load, params, t]);

  const doVerify = async (platform: string) => {
    setVerify((v) => ({ ...v, [platform]: t("settings.verifying") }));
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
    if (!confirm(t("settings.confirmDisconnect", { platform }))) return;
    await api(`/api/accounts/${platform}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

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
        <h2 className="text-lg font-semibold">{t("settings.accountsTitle")}</h2>
        {platforms.map((p) => (
          <div key={p.platform} className="card flex flex-wrap items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.displayName}</p>
              {p.connected ? (
                <p className="truncate text-sm text-gray-500">
                  {p.accountName}
                  {p.autoRenew
                    ? ` · ${t("settings.tokenAutoRenew")}`
                    : p.expiresAt && t("settings.tokenExpires", { date: fmtDate(p.expiresAt) })}
                </p>
              ) : (
                <p className="text-sm text-gray-400">{t("settings.notConnected")}</p>
              )}
              {verify[p.platform] && <p className="text-xs">{verify[p.platform]}</p>}
            </div>
            {p.connected ? (
              <>
                <button className="btn-secondary text-xs" onClick={() => doVerify(p.platform)}>
                  {t("settings.verifyToken")}
                </button>
                <button className="btn-danger text-xs" onClick={() => disconnect(p.platform)}>
                  {t("settings.disconnect")}
                </button>
              </>
            ) : (
              <a href={`/api/connect/${p.platform}`} className="btn-primary text-xs">
                {t("settings.connect")}
              </a>
            )}
          </div>
        ))}
        <p className="text-xs text-gray-500">{t("settings.oauthHint")}</p>
        <p className="text-xs text-gray-500">{t("settings.tokenHint")}</p>
      </section>

      <AiSettings />
      <StorageSettings />
      <ApiKeys />

      {/* Backup */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("settings.backupTitle")}</h2>
        <div className="card flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="font-medium">{t("settings.exportAll")}</p>
            <p className="text-sm text-gray-500">{t("settings.exportDesc")}</p>
          </div>
          <a href="/api/export" className="btn-secondary" download>
            {t("settings.downloadBackup")}
          </a>
        </div>
      </section>

      <DangerZone />
    </div>
  );
}

/** Pulizia automatica dei media dopo la pubblicazione (spazio disco). */
function StorageSettings() {
  const { t } = useI18n();
  const [cleanup, setCleanup] = useState(true);

  useEffect(() => {
    api<{ autoCleanupMedia: string }>("/api/settings")
      .then((s) => setCleanup(s.autoCleanupMedia !== "off"))
      .catch(() => {});
  }, []);

  const toggle = async (on: boolean) => {
    setCleanup(on);
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ autoCleanupMedia: on ? "on" : "off" }),
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("settings.storageTitle")}</h2>
      <label className="card flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-brand-600"
          checked={cleanup}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>
          <span className="font-medium">{t("settings.cleanupLabel")}</span>
          <span className="block text-sm text-gray-500">{t("settings.cleanupDesc")}</span>
        </span>
      </label>
    </section>
  );
}

/** Chiavi API per gli agenti IA (Claude Code e altri, via MCP o REST). */
function ApiKeys() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<
    { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[]
  >([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");

  const load = useCallback(() => {
    api<typeof keys>("/api/keys").then(setKeys).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    const created = await api<{ key: string }>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setFresh(created.key); // mostrata una volta sola: a DB c'è solo l'hash
    setName("");
    load();
  };

  const revoke = async (id: number) => {
    if (!confirm(t("settings.keyConfirmRevoke"))) return;
    await api(`/api/keys?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("settings.agentsTitle")}</h2>
      <div className="card space-y-3">
        <p className="text-sm text-gray-500">{t("settings.agentsDesc")}</p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            placeholder={t("settings.keyNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary" onClick={create}>
            {t("settings.keyCreate")}
          </button>
        </div>

        {fresh && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/40">
            <p className="text-sm font-medium">{t("settings.keyCopyNow")}</p>
            <code className="mt-1 block break-all rounded bg-black/5 p-2 text-xs dark:bg-white/10">{fresh}</code>
          </div>
        )}

        {keys.length > 0 && (
          <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-800">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 truncate">
                  {k.name} · <code className="text-xs text-gray-500">{k.prefix}…</code>
                  <span className="block text-xs text-gray-400">
                    {k.lastUsedAt
                      ? t("settings.keyLastUsed", { date: fmtDate(k.lastUsedAt) })
                      : t("settings.keyNeverUsed")}
                  </span>
                </span>
                <button className="btn-danger text-xs" onClick={() => revoke(k.id)}>
                  {t("settings.keyRevoke")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer">{t("settings.mcpHow")}</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-xs dark:bg-white/10">
{`claude mcp add usocial \\
  --env USOCIAL_URL=${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"} \\
  --env USOCIAL_API_KEY=usk_… \\
  -- node scripts/mcp-server.mjs`}
          </pre>
        </details>
      </div>
    </section>
  );
}

function AiSettings() {
  const { t } = useI18n();
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
    setSaved(t("settings.aiSaved"));
    setTimeout(() => setSaved(""), 3000);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("settings.aiTitle")}</h2>
      <div className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            {t("settings.provider")}
            <select className="input mt-1" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="mock">{t("settings.providerMock")}</option>
              <option value="gemini">{t("settings.providerGemini")}</option>
              <option value="anthropic">{t("settings.providerAnthropic")}</option>
              <option value="openai">{t("settings.providerOpenai")}</option>
              <option value="ollama">{t("settings.providerOllama")}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t("settings.model")}
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
            {t("settings.apiKey")} {hasKey && <span className="text-xs text-green-600">{t("settings.apiKeySet")}</span>}
            <input
              className="input mt-1"
              type="password"
              placeholder={hasKey ? t("settings.apiKeyPlaceholderSet") : "sk-…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("settings.baseUrl")}
            <input
              className="input mt-1"
              placeholder="http://localhost:11434"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
        </div>
        {provider === "gemini" && (
          <p className="text-xs text-gray-500">{t("settings.geminiHint")}</p>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save}>
            {t("settings.saveAi")}
          </button>
          {saved && <span className="text-sm text-green-600">{saved}</span>}
        </div>
      </div>
    </section>
  );
}

function DangerZone() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const deleteAccount = async () => {
    if (!confirm(t("danger.confirm1"))) return;
    if (!confirm(t("danger.confirm2"))) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/account", { method: "DELETE" });
      window.location.href = "/login";
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-red-600">{t("danger.title")}</h2>
      <div className="card border-red-300 dark:border-red-800">
        <p className="font-medium">{t("danger.deleteAccount")}</p>
        <p className="mt-1 text-sm text-gray-500">{t("danger.deleteDesc")}</p>
        <p className="mt-1 text-xs text-gray-500">
          <a href="/data-deletion" target="_blank" className="text-brand-600 hover:underline">
            {t("danger.instructionsLink")}
          </a>
        </p>
        <button className="btn-danger mt-3" onClick={deleteAccount} disabled={busy}>
          {busy ? t("danger.deleting") : t("danger.deleteButton")}
        </button>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
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
