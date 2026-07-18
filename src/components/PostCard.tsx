"use client";
/**
 * Card riassuntiva di un post: stato, piattaforme, data, azioni rapide.
 */
import Link from "next/link";
import type { Post } from "@/types";
import { fmtDate, STATUS_LABELS, type PlatformInfo } from "@/lib/client";

export function PlatformDot({ platform, platforms }: { platform: string; platforms: PlatformInfo[] }) {
  const info = platforms.find((p) => p.platform === platform);
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: info?.color || "#999" }}
      title={info?.displayName || platform}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.draft;
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function PostCard({
  post,
  platforms,
  onDuplicate,
  onDelete,
}: {
  post: Post;
  platforms: PlatformInfo[];
  onDuplicate?: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  return (
    <div className="card flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Link href={`/posts/${post.id}`} className="block hover:opacity-80">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <span className="text-xs text-gray-500">{fmtDate(post.scheduledAt)}</span>
            <span className="flex items-center gap-1">
              {post.targets.map((t) => (
                <PlatformDot key={t.platform} platform={t.platform} platforms={platforms} />
              ))}
            </span>
          </div>
          <p className="truncate font-medium">{post.title || post.body.slice(0, 80) || "(vuoto)"}</p>
          {post.title && (
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {post.body.slice(0, 100)}
            </p>
          )}
        </Link>
        {post.targets.some((t) => t.error) && (
          <p className="mt-1 truncate text-xs text-red-500">
            ⚠️ {post.targets.find((t) => t.error)?.error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {onDuplicate && (
          <button
            onClick={() => onDuplicate(post.id)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            title="Duplica"
          >
            ⧉
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            title="Elimina"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
