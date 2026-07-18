"use client";
/**
 * Pannello AI dell'editor: azioni di trasformazione del testo.
 * Il risultato può essere applicato al corpo del post o agli hashtag.
 */
import { useState } from "react";
import { api } from "@/lib/client";
import type { AiAction } from "@/types";

const ACTIONS: { action: AiAction; label: string; target: "body" | "hashtags" | "show" }[] = [
  { action: "improve", label: "✨ Migliora leggibilità", target: "body" },
  { action: "short", label: "✂️ Versione corta", target: "body" },
  { action: "long", label: "📝 Versione lunga", target: "body" },
  { action: "to_short_post", label: "⚡ Testo lungo → post breve", target: "body" },
  { action: "to_linkedin_article", label: "💼 Post → articolo LinkedIn", target: "body" },
  { action: "youtube_description", label: "▶️ Descrizione YouTube", target: "body" },
  { action: "hashtags", label: "#️⃣ Suggerisci hashtag", target: "hashtags" },
  { action: "titles", label: "🎯 5 titoli efficaci", target: "show" },
  { action: "cta", label: "📣 Genera CTA", target: "show" },
];

export function AiPanel({
  text,
  title,
  onApplyBody,
  onApplyHashtags,
}: {
  text: string;
  title: string;
  onApplyBody: (text: string) => void;
  onApplyHashtags: (text: string) => void;
}) {
  const [busy, setBusy] = useState<AiAction | null>(null);
  const [result, setResult] = useState<{ action: AiAction; text: string; target: string } | null>(null);
  const [error, setError] = useState("");

  const run = async (action: AiAction, target: string) => {
    if (!text.trim()) {
      setError("Scrivi prima il testo del post.");
      return;
    }
    setBusy(action);
    setError("");
    try {
      const { result: out } = await api<{ result: string }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action, text, title }),
      });
      setResult({ action, text: out, target });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <h3 className="mb-2 font-semibold">🤖 Assistente AI</h3>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.action}
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            disabled={busy !== null}
            onClick={() => run(a.action, a.target)}
          >
            {busy === a.action ? "…" : a.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {result && (
        <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50 p-3 dark:border-brand-700/40 dark:bg-brand-700/10">
          <pre className="whitespace-pre-wrap font-sans text-sm">{result.text}</pre>
          <div className="mt-2 flex gap-2">
            {result.target === "body" && (
              <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => { onApplyBody(result.text); setResult(null); }}>
                Sostituisci testo
              </button>
            )}
            {result.target === "hashtags" && (
              <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => { onApplyHashtags(result.text); setResult(null); }}>
                Usa questi hashtag
              </button>
            )}
            <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setResult(null)}>
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
