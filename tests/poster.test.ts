/**
 * Anteprime dei video della Libreria: gli argomenti passati a ffmpeg.
 */
import { describe, expect, it } from "vitest";
import { posterArgs } from "@/lib/video";

describe("anteprima video", () => {
  it("passa -update a ffmpeg", () => {
    // ffmpeg 7 (immagine Docker Alpine) rifiuta di scrivere un JPEG singolo con
    // il muxer image2 se manca `-update 1`: era la ragione per cui le anteprime
    // funzionavano in locale e non in produzione.
    const args = posterArgs("/media/clip.mp4", "/media/clip.mp4.poster.jpg", 1);
    expect(args).toContain("-update");
    expect(args[args.indexOf("-update") + 1]).toBe("1");
    expect(args.slice(-2)).toEqual(["-y", "/media/clip.mp4.poster.jpg"]);
  });
});
