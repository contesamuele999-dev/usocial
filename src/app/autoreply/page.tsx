"use client";
/**
 * Risposte automatiche ai commenti: regole, prova a vuoto e registro.
 *
 * Ogni regola nasce SPENTA e c'è un pulsante "Prova" che mostra cosa verrebbe
 * mandato senza mandarlo: qui in fondo si scrive a persone vere, e la
 * differenza fra un messaggio utile e uno imbarazzante è un refuso.
 */
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, getPlatforms, type PlatformInfo } from "@/lib/client";
import { useI18n, type TFunc } from "@/lib/i18n";
import { PLATFORMS, type Platform } from "@/types";

interface Rule {
  id: number;
  name: string;
  keyword: string;
  matchMode: "word" | "contains";
  platforms: Platform[];
  publicReply: string;
  privateReply: string;
  enabled: boolean;
}

interface LogRow {
  platform: Platform;
  commentId: string;
  postId: number | null;
  author: string;
  text: string;
  status: "replied" | "skipped" | "failed" | "simulated";
  detail: string | null;
  createdAt: string;
}

interface RunResult {
  scanned: number;
  replied: number;
  privateSent: number;
  failed: number;
  simulated: boolean;
  errors: { platform: Platform; message: string }[];
  preview: {
    platform: Platform;
    author: string;
    text: string;
    rule: string;
    publicReply: string;
    privateReply: string;
  }[];
  log: LogRow[];
}

const EMPTY: Omit<Rule, "id"> = {
  name: "",
  keyword: "",
  matchMode: "word",
  platforms: [],
  publicReply: "",
  privateReply: "",
  enabled: false,
};

/** Piattaforme che sanno gestire i commenti, secondo /api/platforms. */
function commentPlatforms(infos: PlatformInfo[]): PlatformInfo[] {
  return infos.filter((p) => p.comments?.publicReply || p.comments?.privateReply);
}

function StatusBadge({ status, t }: { status: LogRow["status"]; t: TFunc }) {
  const style =
    status === "replied"
      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "failed"
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return <span className={`badge ${style}`}>{t(`autoreply.status.${status}`)}</span>;
}

function RuleForm({
  value,
  platforms,
  onChange,
  onSave,
  onCancel,
  busy,
  t,
}: {
  value: Omit<Rule, "id">;
  platforms: PlatformInfo[];
  onChange: (r: Omit<Rule, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  t: TFunc;
}) {
  const set = <K extends keyof Omit<Rule, "id">>(key: K, v: Omit<Rule, "id">[K]) =>
    onChange({ ...value, [key]: v });

  /** Piattaforme che sanno mandare un messaggio privato, fra quelle scelte. */
  const chosen = value.platforms.length ? value.platforms : platforms.map((p) => p.platform);
  const dmPlatforms = platforms.filter(
    (p) => chosen.includes(p.platform) && p.comments?.privateReply
  );

  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {t("autoreply.fieldName")}
          <input
            className="input mt-1"
            value={value.name}
            placeholder={t("autoreply.namePlaceholder")}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="text-sm">
          {t("autoreply.fieldKeyword")}
          <input
            className="input mt-1 font-mono"
            value={value.keyword}
            placeholder="PAUSA"
            onChange={(e) => set("keyword", e.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm">
        {t("autoreply.fieldMatch")}
        <select
          className="input mt-1"
          value={value.matchMode}
          onChange={(e) => set("matchMode", e.target.value as "word" | "contains")}
        >
          <option value="word">{t("autoreply.matchWord")}</option>
          <option value="contains">{t("autoreply.matchContains")}</option>
        </select>
      </label>

      <div className="text-sm">
        <p className="mb-1">{t("autoreply.fieldPlatforms")}</p>
        <div className="flex flex-wrap gap-3">
          {platforms.map((p) => (
            <label key={p.platform} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={value.platforms.includes(p.platform)}
                onChange={(e) =>
                  set(
                    "platforms",
                    e.target.checked
                      ? [...value.platforms, p.platform]
                      : value.platforms.filter((x) => x !== p.platform)
                  )
                }
              />
              <span className="flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                {p.displayName}
                {!p.comments?.privateReply && (
                  <span className="text-[11px] text-gray-400">{t("autoreply.noDm")}</span>
                )}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">{t("autoreply.platformsHint")}</p>
      </div>

      <label className="block text-sm">
        {t("autoreply.fieldPublic")}
        <textarea
          className="input mt-1 h-20"
          value={value.publicReply}
          placeholder={t("autoreply.publicPlaceholder")}
          onChange={(e) => set("publicReply", e.target.value)}
        />
      </label>

      <label className="block text-sm">
        {t("autoreply.fieldPrivate")}
        <textarea
          className="input mt-1 h-24"
          value={value.privateReply}
          placeholder={t("autoreply.privatePlaceholder")}
          onChange={(e) => set("privateReply", e.target.value)}
        />
      </label>

      <p className="text-xs text-gray-400">
        {t("autoreply.templateHint")}
        {dmPlatforms.length === 0 && value.privateReply && (
          <>
            {" "}
            <span className="text-amber-600">{t("autoreply.noDmWarning")}</span>
          </>
        )}
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
        {t("autoreply.fieldEnabled")}
      </label>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={onSave} disabled={busy}>
          {t("common.save")}
        </button>
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>
          {t("autoreply.cancel")}
        </button>
      </div>
    </div>
  );
}

export default function AutoReplyPage() {
  const { t } = useI18n();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [draft, setDraft] = useState<Omit<Rule, "id"> | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run, setRun] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ rules: Rule[]; log: LogRow[] }>("/api/autoreply/rules");
      setRules(data.rules);
      setLog(data.log);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    getPlatforms().then((all) => setPlatforms(commentPlatforms(all)));
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await api(editing ? `/api/autoreply/rules/${editing}` : "/api/autoreply/rules", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      setDraft(null);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t("autoreply.confirmDelete"))) return;
    await api(`/api/autoreply/rules/${id}`, { method: "DELETE" });
    await load();
  };

  const toggle = async (rule: Rule) => {
    await api(`/api/autoreply/rules/${rule.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
    });
    await load();
  };

  const execute = async (simulate: boolean) => {
    setBusy(true);
    setError("");
    setRun(null);
    try {
      const res = await api<RunResult>(`/api/autoreply/run${simulate ? "?simulate=1" : ""}`, {
        method: "POST",
      });
      setRun(res);
      setLog(res.log);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const connected = platforms.filter((p) => p.connected);
  const active = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("autoreply.title")}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => execute(true)} disabled={busy}>
            {t("autoreply.simulate")}
          </button>
          <button className="btn-primary" onClick={() => execute(false)} disabled={busy || !active}>
            {t("autoreply.runNow")}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">{t("autoreply.intro")}</p>

      {error && (
        <div className="card border-red-300 text-sm text-red-600 dark:border-red-900">{error}</div>
      )}

      {connected.length === 0 && (
        <div className="card border-amber-300 text-sm dark:border-amber-900">
          {t("autoreply.noAccounts")}
        </div>
      )}

      {run && (
        <div className="card">
          <p className="font-medium">
            {run.simulated ? t("autoreply.simResult") : t("autoreply.runResult")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {t("autoreply.runCounts", {
              scanned: run.scanned,
              replied: run.replied,
              dm: run.privateSent,
              failed: run.failed,
            })}
          </p>
          {run.preview.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {run.preview.map((p, i) => (
                <li key={i} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/60">
                  <p className="text-xs text-gray-500">
                    {p.platform} · {p.author || "—"} · «{p.text}» → {p.rule}
                  </p>
                  {p.publicReply && (
                    <p className="mt-1">
                      💬 <span className="text-gray-500">{t("autoreply.wouldPublic")}</span>{" "}
                      {p.publicReply}
                    </p>
                  )}
                  {p.privateReply && (
                    <p className="mt-0.5">
                      📩 <span className="text-gray-500">{t("autoreply.wouldPrivate")}</span>{" "}
                      {p.privateReply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {run.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
              {run.errors.map((e) => (
                <li key={e.platform}>
                  <span className="font-medium">{e.platform}</span>: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) =>
          editing === rule.id && draft ? (
            <RuleForm
              key={rule.id}
              value={draft}
              platforms={platforms}
              onChange={setDraft}
              onSave={save}
              onCancel={() => {
                setDraft(null);
                setEditing(null);
              }}
              busy={busy}
              t={t}
            />
          ) : (
            <div key={rule.id} className="card flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <span className={`badge ${rule.enabled ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}>
                    {rule.enabled ? t("autoreply.on") : t("autoreply.off")}
                  </span>
                  {rule.name || rule.keyword}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("autoreply.summaryKeyword")}{" "}
                  <code className="font-mono font-semibold">{rule.keyword}</code>
                  {" · "}
                  {rule.platforms.length
                    ? rule.platforms.join(", ")
                    : t("autoreply.allPlatforms")}
                </p>
                {rule.publicReply && <p className="mt-1 text-sm">💬 {rule.publicReply}</p>}
                {rule.privateReply && <p className="mt-0.5 text-sm">📩 {rule.privateReply}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button className="btn-secondary" onClick={() => toggle(rule)}>
                  {rule.enabled ? t("autoreply.turnOff") : t("autoreply.turnOn")}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setEditing(rule.id);
                    setDraft({ ...rule });
                  }}
                >
                  {t("autoreply.edit")}
                </button>
                <button className="btn-danger" onClick={() => remove(rule.id)}>
                  {t("autoreply.delete")}
                </button>
              </div>
            </div>
          )
        )}

        {editing === null &&
          (draft ? (
            <RuleForm
              value={draft}
              platforms={platforms}
              onChange={setDraft}
              onSave={save}
              onCancel={() => setDraft(null)}
              busy={busy}
              t={t}
            />
          ) : (
            <button className="btn-primary" onClick={() => setDraft({ ...EMPTY })}>
              {t("autoreply.newRule")}
            </button>
          ))}
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">{t("autoreply.logTitle")}</h2>
        {log.length === 0 ? (
          <p className="text-sm text-gray-500">{t("autoreply.logEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {log.map((row) => (
              <li
                key={`${row.platform}-${row.commentId}`}
                className="flex flex-wrap items-baseline gap-2 border-t border-gray-100 py-1.5 first:border-0 dark:border-gray-800"
              >
                <StatusBadge status={row.status} t={t} />
                <span className="text-xs text-gray-400">{fmtDate(row.createdAt)}</span>
                <span className="font-medium">{row.author || "—"}</span>
                <span className="min-w-0 flex-1 truncate text-gray-500">«{row.text}»</span>
                {row.detail && <span className="text-xs text-gray-400">{row.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
