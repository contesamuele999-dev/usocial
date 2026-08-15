/**
 * /api/posts
 * GET  — lista post dell'utente (filtri: ?status=draft&platform=facebook)
 * POST — crea post { title, body, hashtags, scheduledAt, status, platforms, mediaIds }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api";
import { createPost, listPosts } from "@/lib/repo";
import { PLATFORMS, type Platform, type PostStatus } from "@/types";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  title: z.string().default(""),
  body: z.string().default(""),
  hashtags: z.string().default(""),
  scheduledAt: z.string().nullable().default(null),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  mediaIds: z.array(z.number()).default([]),
  postTypes: z.record(z.enum(PLATFORMS), z.string()).optional(),
});

export const GET = withUser("posts", async (req, _ctx, user) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as PostStatus | null;
  const platform = url.searchParams.get("platform") as Platform | null;
  const q = url.searchParams.get("q");
  const posts = listPosts(user.id, {
    status: status || undefined,
    platform: platform || undefined,
    q: q || undefined,
  });
  return NextResponse.json(posts);
});

export const POST = withUser("posts", async (req, _ctx, user) => {
  const input = postSchema.parse(await req.json());
  const post = createPost(user.id, input);
  return NextResponse.json(post, { status: 201 });
});
