"use client";
/**
 * Pagina "Nuovo Post": editor vuoto (con eventuale data pre-compilata
 * dal calendario via ?date=YYYY-MM-DD).
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PostEditor } from "@/components/PostEditor";
import type { Post } from "@/types";

function NewPostInner() {
  const params = useSearchParams();
  const date = params.get("date"); // YYYY-MM-DD dal calendario
  const initial: Post | null = date
    ? ({
        id: 0,
        userId: 0,
        title: "",
        body: "",
        hashtags: "",
        status: "draft",
        scheduledAt: new Date(`${date}T09:00:00`).toISOString(),
        createdAt: "",
        updatedAt: "",
        targets: [],
        media: [],
      } as Post)
    : null;
  // id=0 indica "non ancora salvato": PostEditor lo tratta solo come precompilazione
  return <PostEditor initial={initial} key={date || "new"} />;
}

export default function NewPostPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuovo Post</h1>
      <Suspense>
        <NewPostInner />
      </Suspense>
    </div>
  );
}
