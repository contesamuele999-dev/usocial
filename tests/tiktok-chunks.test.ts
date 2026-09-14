/**
 * Chunking TikTok: la Content Posting API rifiuta l'init ("The chunk size is
 * invalid") se un chunk esce da 5–64 MB, se un file oltre i 64 MB arriva in un
 * pezzo solo o se `total_chunk_count` non è `floor(video_size / chunk_size)`.
 * I "MB" di TikTok possono essere decimali o binari: si verificano i limiti
 * più stretti di entrambi.
 */
import { describe, expect, it } from "vitest";
import { chunkPlan } from "@/social/tiktok";

const MB = 1024 * 1024;
/** Il limite più basso fra 64 MB decimali e 64 MiB. */
const MAX_CHUNK = 64_000_000;
/** Il limite più alto fra 5 MB decimali e 5 MiB. */
const MIN_CHUNK = 5 * MB;
const SIZES = [65 * MB, 70 * MB, 114 * MB, 127 * MB, 128 * MB, 300 * MB, 1024 * MB, 4096 * MB];

describe("piano di chunking TikTok", () => {
  it("manda i video piccoli in un pezzo solo", () => {
    const { chunkSize, ranges } = chunkPlan(3 * MB);
    expect(chunkSize).toBe(3 * MB);
    expect(ranges).toEqual([[0, 3 * MB]]);
  });

  it("usa un pezzo solo fino a 64 MB decimali inclusi", () => {
    const { chunkSize, ranges } = chunkPlan(MAX_CHUNK);
    expect(chunkSize).toBe(MAX_CHUNK);
    expect(ranges).toHaveLength(1);
  });

  it("divide in più chunk qualsiasi file oltre i 64 MB", () => {
    // 64 MiB sta sopra i 64 MB decimali: era il caso del pezzo unico rifiutato.
    for (const size of [64 * MB, 65 * MB, 100 * MB, 127 * MB]) {
      expect(chunkPlan(size).ranges.length).toBeGreaterThan(1);
    }
  });

  it("tiene il chunk_size tra 5 e 64 MB", () => {
    for (const size of SIZES) {
      const { chunkSize } = chunkPlan(size);
      expect(chunkSize).toBeLessThanOrEqual(MAX_CHUNK);
      expect(chunkSize).toBeGreaterThanOrEqual(MIN_CHUNK);
    }
  });

  it("rispetta total_chunk_count = floor(size / chunk_size)", () => {
    for (const size of SIZES) {
      const { chunkSize, ranges } = chunkPlan(size);
      expect(ranges).toHaveLength(Math.floor(size / chunkSize));
    }
  });

  it("copre tutti i byte senza buchi né sovrapposizioni", () => {
    for (const size of [3 * MB, ...SIZES]) {
      const { ranges } = chunkPlan(size);
      expect(ranges[0][0]).toBe(0);
      expect(ranges[ranges.length - 1][1]).toBe(size);
      for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1]);
    }
  });

  it("tiene l'ultimo chunk tra il chunk_size e i 128 MB ammessi", () => {
    for (const size of SIZES) {
      const { chunkSize, ranges } = chunkPlan(size);
      const [start, end] = ranges.at(-1)!;
      expect(end - start).toBeGreaterThanOrEqual(chunkSize);
      expect(end - start).toBeLessThan(128_000_000);
    }
  });

  it("resta sotto i 1000 chunk anche sui file da 4 GB", () => {
    expect(chunkPlan(4096 * MB).ranges.length).toBeLessThanOrEqual(1000);
  });
});
