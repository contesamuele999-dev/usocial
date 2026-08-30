/**
 * Chunking TikTok: la Content Posting API rifiuta l'init se `chunk_size` supera
 * i 64 MB o se `total_chunk_count` non è `floor(video_size / chunk_size)`.
 * Era la causa dei fallimenti ripetuti sui video grandi.
 */
import { describe, expect, it } from "vitest";
import { chunkPlan } from "@/social/tiktok";

const MB = 1024 * 1024;
const MAX_CHUNK = 64 * MB;

describe("piano di chunking TikTok", () => {
  it("manda i video piccoli in un pezzo solo", () => {
    const { chunkSize, ranges } = chunkPlan(3 * MB);
    expect(chunkSize).toBe(3 * MB);
    expect(ranges).toEqual([[0, 3 * MB]]);
  });

  it("usa un pezzo solo fino a 64 MB inclusi", () => {
    const { chunkSize, ranges } = chunkPlan(MAX_CHUNK);
    expect(chunkSize).toBe(MAX_CHUNK);
    expect(ranges).toHaveLength(1);
  });

  it("non supera mai il chunk_size massimo", () => {
    for (const size of [65 * MB, 114 * MB, 300 * MB, 1024 * MB]) {
      expect(chunkPlan(size).chunkSize).toBeLessThanOrEqual(MAX_CHUNK);
    }
  });

  it("rispetta total_chunk_count = floor(size / chunk_size)", () => {
    for (const size of [65 * MB, 114 * MB, 128 * MB, 300 * MB, 1024 * MB]) {
      const { chunkSize, ranges } = chunkPlan(size);
      expect(ranges).toHaveLength(Math.floor(size / chunkSize));
    }
  });

  it("copre tutti i byte senza buchi né sovrapposizioni", () => {
    for (const size of [3 * MB, 114 * MB, 300 * MB]) {
      const { ranges } = chunkPlan(size);
      expect(ranges[0][0]).toBe(0);
      expect(ranges[ranges.length - 1][1]).toBe(size);
      for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1]);
    }
  });

  it("tiene l'ultimo chunk sotto i 128 MB ammessi", () => {
    for (const size of [65 * MB, 114 * MB, 127 * MB, 300 * MB, 4096 * MB]) {
      const [start, end] = chunkPlan(size).ranges.at(-1)!;
      expect(end - start).toBeLessThan(128 * MB);
    }
  });
});
