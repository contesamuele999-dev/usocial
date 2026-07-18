"use client";
/**
 * Pagina di modifica di un post esistente.
 */
import { use, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Post } from "@/types";
import { PostEditor } from "@/components/PostEditor";

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Post>(`/api/posts/${id}`)
      .then(setPost)
      .catch((e) => setError(String(e.message || e)));
  }, [id]);

  if (error) return <p className="text-red-500">{error}</p>;
  if (!post) return <p className="text-gray-500">Caricamento…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Modifica Post #{post.id}</h1>
      <PostEditor initial={post} />
    </div>
  );
}
