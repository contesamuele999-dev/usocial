/**
 * B-roll automatici da stock (Pexels). Cerca spezzoni video pertinenti alle
 * keyword di una clip e li scarica, così sono pronti in libreria da inserire.
 *
 * Richiede PEXELS_API_KEY nel file .env. Senza chiave, ritorna [] (degradazione
 * morbida: il resto della pipeline continua senza b-roll).
 *
 * Nota: l'inserimento automatico "inline" del b-roll dentro la clip non è incluso
 * in questo prototipo (montaggio a stacchi affidabile è complesso); i clip stock
 * vengono resi disponibili in libreria, taggati, pronti da montare.
 */
export interface BrollClip {
  data: Buffer;
  mime: string;
  name: string;
}

interface PexelsVideoFile {
  link: string;
  file_type: string;
  width: number;
  height: number;
}
interface PexelsVideo {
  id: number;
  video_files: PexelsVideoFile[];
}

/** Scarica fino a `count` b-roll pertinenti alle keyword. */
export async function fetchBroll(query: string, count = 2): Promise<BrollClip[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return [];

  try {
    const url =
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}` +
      `&per_page=${count}&orientation=portrait&size=medium`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return [];
    const json = (await res.json()) as { videos?: PexelsVideo[] };
    const videos = json.videos || [];

    const out: BrollClip[] = [];
    for (const v of videos.slice(0, count)) {
      // scegli un mp4 di risoluzione media
      const file =
        v.video_files.find((f) => f.file_type === "video/mp4" && f.height >= 1080 && f.height <= 1920) ||
        v.video_files.find((f) => f.file_type === "video/mp4");
      if (!file) continue;
      const dl = await fetch(file.link);
      if (!dl.ok) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      out.push({ data: buf, mime: "video/mp4", name: `broll-${v.id}.mp4` });
    }
    return out;
  } catch {
    return [];
  }
}
