/**
 * /api/media/:id — PUT aggiorna cartella/tag, DELETE elimina (DB + file).
 * Limitato ai media dell'utente loggato.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, NotFoundError } from "@/lib/errors";
import { withUser } from "@/lib/api";
import { deleteMedia, getMedia, postsUsingMedia, updateMediaMeta } from "@/lib/repo";
import { deleteFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withUser<Ctx>("media", async (req, { params }, user) => {
  const { id } = await params;
  if (!getMedia(Number(id), user.id)) throw new NotFoundError("Media non trovato");
  const { folder, tags } = z
    .object({ folder: z.string().default(""), tags: z.string().default("") })
    .parse(await req.json());
  return NextResponse.json(updateMediaMeta(Number(id), user.id, folder, tags));
});

export const DELETE = withUser<Ctx>("media", async (req, { params }, user) => {
  const { id } = await params;
  if (!getMedia(Number(id), user.id)) throw new NotFoundError("Media non trovato");

  // Guardia: non cancellare un media usato da post ancora in coda (bozze/programmati),
  // a meno che il client non forzi esplicitamente con ?force=true.
  const force = new URL(req.url).searchParams.get("force") === "true";
  const inUse = postsUsingMedia(Number(id), user.id);
  if (inUse.length > 0 && !force) {
    throw new AppError(
      `Media usato da ${inUse.length} post ancora in coda (${inUse.slice(0, 3).join(", ")}${
        inUse.length > 3 ? "…" : ""
      }). Rimuovilo prima da quei post, oppure conferma per eliminarlo comunque.`,
      409,
      { postsInUse: inUse }
    );
  }

  const item = deleteMedia(Number(id), user.id);
  if (!item) throw new NotFoundError("Media non trovato");
  await deleteFile(item.filename);
  return NextResponse.json({ ok: true });
});
