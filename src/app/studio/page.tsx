"use client";
/**
 * Studio Contenuti AI (prototipo): scegli un agente, dai il contesto (nicchia,
 * argomento, pubblico) e genera idee, piani editoriali, script reel, caroselli
 * o descrizioni ottimizzate per crescita e vendite. Il testo si copia
 * nell'editor con un clic.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getPlatforms, type PlatformInfo } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { Platform } from "@/types";

type Agent = "ideas" | "plan" | "reel_script" | "carousel" | "description";

const AGENTS: { id: Agent; labelKey: string; descKey: string; usesTopic: boolean; usesCount: boolean }[] = [
  { id: "ideas", labelKey: "studio.agentIdeas", descKey: "studio.agentIdeasDesc", usesTopic: false, usesCount: true },
  { id: "plan", labelKey: "studio.agentPlan", descKey: "studio.agentPlanDesc", usesTopic: false, usesCount: true },
  { id: "reel_script", labelKey: "studio.agentReel", descKey: "studio.agentReelDesc", usesTopic: true, usesCount: false },
  { id: "carousel", labelKey: "studio.agentCarousel", descKey: "studio.agentCarouselDesc", usesTopic: true, usesCount: true },
  { id: "description", labelKey: "studio.agentDescription", descKey: "studio.agentDescriptionDesc", usesTopic: true, usesCount: false },
];

export default function StudioPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent>("ideas");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(8);
  const [platform, setPlatform] = useState<Platform | "">("");
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPlatforms().then(setPlatforms).catch(() => {});
  }, []);

  const current = AGENTS.find((a) => a.id === agent)!;

  const generate = async () => {
    if (!niche.trim()) {
      setError(t("studio.needNiche"));
      return;
    }
    setBusy(true);
    setError("");
    setResult("");
    setCopied(false);
    try {
      const { result: out } = await api<{ result: string }>("/api/studio", {
        method: "POST",
        body: JSON.stringify({
          agent,
          niche,
          topic: current.usesTopic ? topic : undefined,
          audience: audience || undefined,
          count: current.usesCount ? count : undefined,
          platform: platform || undefined,
          lang,
        }),
      });
      setResult(out);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recordFromScript = () => {
    try {
      sessionStorage.setItem("studio.reelScript", result);
    } catch {}
    router.push("/studio/record");
  };

  const createPostFromResult = () => {
    try {
      sessionStorage.setItem(
        "editor.prefill",
        JSON.stringify({ body: result, hashtags: "", platforms: platform ? [platform] : [] })
      );
    } catch {}
    router.push("/posts/new");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("studio.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("studio.subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/studio/templates" className="btn-secondary text-sm">
            {t("studio.templates")}
          </Link>
          <Link href="/studio/record" className="btn-secondary text-sm">
            {t("studio.record")}
          </Link>
          <Link href="/studio/live" className="btn-secondary text-sm">
            {t("studio.live")}
          </Link>
          <Link href="/studio/repurpose" className="btn-secondary text-sm">
            {t("studio.repurpose")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonna sinistra: scelta agente + input */}
        <div className="space-y-4 lg:col-span-1">
          <div className="card space-y-2">
            <span className="text-sm font-medium">{t("studio.agent")}</span>
            <div className="space-y-1.5">
              {AGENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgent(a.id)}
                  className={`w-full rounded-lg border p-2 text-left transition ${
                    agent === a.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-700/10"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <div className="text-sm font-medium">{t(a.labelKey)}</div>
                  <div className="text-xs text-gray-500">{t(a.descKey)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <label className="block text-sm font-medium">
              {t("studio.niche")}
              <input
                className="input mt-1"
                placeholder={t("studio.nichePlaceholder")}
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </label>
            {current.usesTopic && (
              <label className="block text-sm font-medium">
                {t("studio.topic")}
                <input
                  className="input mt-1"
                  placeholder={t("studio.topicPlaceholder")}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              {t("studio.audience")}
              <input
                className="input mt-1"
                placeholder={t("studio.audiencePlaceholder")}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </label>
            <div className="flex gap-3">
              {current.usesCount && (
                <label className="block flex-1 text-sm font-medium">
                  {t("studio.count")}
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="input mt-1"
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 1)}
                  />
                </label>
              )}
              <label className="block flex-1 text-sm font-medium">
                {t("studio.platform")}
                <select
                  className="input mt-1"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform | "")}
                >
                  <option value="">{t("studio.platformAll")}</option>
                  {platforms.map((p) => (
                    <option key={p.platform} value={p.platform}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn-primary w-full" onClick={generate} disabled={busy}>
              {busy ? t("studio.generating") : t("studio.generate")}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>

        {/* Colonna destra: risultato */}
        <div className="card lg:col-span-2">
          {result ? (
            <>
              <div className="mb-2 flex flex-wrap justify-end gap-2">
                {agent === "reel_script" && (
                  <button className="btn-primary px-3 py-1 text-xs" onClick={recordFromScript}>
                    {t("studio.record")}
                  </button>
                )}
                {(agent === "description" || agent === "carousel") && (
                  <button className="btn-primary px-3 py-1 text-xs" onClick={createPostFromResult}>
                    {t("studio.createPost")}
                  </button>
                )}
                <button className="btn-secondary px-3 py-1 text-xs" onClick={copy}>
                  {copied ? t("studio.copied") : t("studio.copy")}
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{result}</pre>
            </>
          ) : (
            <p className="py-16 text-center text-sm text-gray-500">{busy ? t("studio.generating") : t("studio.empty")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
