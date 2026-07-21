"use client";
/**
 * Pagina "Nuovo Post": editor vuoto (con eventuale data pre-compilata
 * dal calendario via ?date=YYYY-MM-DD).
 */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostEditor } from "@/components/PostEditor";
import { useI18n } from "@/lib/i18n";
import type { Post } from "@/types";

/** Precompilazione da un template (impostata in sessionStorage dalla pagina Template). */
function readPrefill(): { body: string; hashtags: string; platforms: string[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("editor.prefill");
    if (!raw) return null;
    sessionStorage.removeItem("editor.prefill");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function NewPostInner() {
  const params = useSearchParams();
  const date = params.get("date"); // YYYY-MM-DD dal calendario
  // Letto una sola volta al mount: evita di riconsumare il prefill ai re-render.
  const [prefill] = useState(readPrefill);

  const initial: Post | null =
    date || prefill
      ? ({
          id: 0,
          userId: 0,
          title: "",
          body: prefill?.body || "",
          hashtags: prefill?.hashtags || "",
          status: "draft",
          scheduledAt: date ? new Date(`${date}T09:00:00`).toISOString() : null,
          createdAt: "",
          updatedAt: "",
          // PostEditor legge solo t.platform dai target: bastano oggetti minimi.
          targets: (prefill?.platforms || []).map(
            (platform) => ({ platform }) as Post["targets"][number]
          ),
          media: [],
        } as Post)
      : null;
  // id=0 indica "non ancora salvato": PostEditor lo tratta solo come precompilazione
  return <PostEditor initial={initial} key={date || "new"} />;
}

export default function NewPostPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("editor.newPostTitle")}</h1>
      <Suspense>
        <NewPostInner />
      </Suspense>
    </div>
  );
}
