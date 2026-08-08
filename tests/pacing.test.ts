import { describe, expect, it } from "vitest";
import { estimateTicksPerSecond, ticksToAdvance } from "../src/engine/playback/pacing";

describe("ticksToAdvance", () => {
  it("tidak memproses sebelum cukup waktu berlalu", () => {
    expect(ticksToAdvance(50, 10, 1, 0, 1500)).toBe(0);
  });

  it("memproses sesuai kecepatan (10x = 10 tick/detik)", () => {
    expect(ticksToAdvance(500, 10, 1, 0, 1500)).toBe(5);
    expect(ticksToAdvance(1000, 10, 1, 0, 1500)).toBe(10);
    expect(ticksToAdvance(1000, 1, 1, 0, 1500)).toBe(1);
  });

  it("hanya mengembalikan increment (tidak menghitung ganda)", () => {
    // elapsed 1000ms → target 1 tick; belum ada yang diproses → 1
    expect(ticksToAdvance(1000, 1, 1, 0, 1500)).toBe(1);
    // 50ms kemudian target masih 1, tapi 1 sudah diproses → 0 (bukan 1 lagi)
    expect(ticksToAdvance(1050, 1, 1, 1, 1500)).toBe(0);
    // pada 2000ms target 2, 1 sudah diproses → 1 tick baru
    expect(ticksToAdvance(2000, 1, 1, 1, 1500)).toBe(1);
  });

  it("dibatasi oleh total tick (tidak melebihi total)", () => {
    expect(ticksToAdvance(10000, 10, 1, 0, 3)).toBe(3);
  });

  it("menjamin seluruh tick diproses tepat sekali pada simulasi interval 50ms", () => {
    const total = 1500;
    const speed = 10;
    let processed = 0;
    let advanceSum = 0;
    for (let ms = 0; ms < 200000 && processed < total; ms += 50) {
      const n = ticksToAdvance(ms, speed, 1, processed, total);
      expect(processed + n).toBeLessThanOrEqual(total);
      processed += n;
      advanceSum += n;
    }
    expect(processed).toBe(total);
    expect(advanceSum).toBe(total);
  });

  it("1x = real-time: tick 1 detik → 1 tick/detik", () => {
    let processed = 0;
    const seen: number[] = [];
    for (let ms = 0; ms < 3050 && processed < 3; ms += 50) {
      const n = ticksToAdvance(ms, 1, 1, processed, 1500);
      processed += n;
      if (n > 0) seen.push(Math.round(ms / 1000));
    }
    // 3 tick pertama muncul di detik 1, 2, 3 (bukan tiap 50ms)
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("estimateTicksPerSecond", () => {
  const tick = (time: number) => ({ time, price: 100, volume: 1 });

  it("data berjarak 1 detik → 1 tick/detik", () => {
    const ticks = [0, 1, 2, 3, 4].map(tick);
    expect(estimateTicksPerSecond(ticks)).toBe(1);
  });

  it("data berjarak 5 detik → 0.2 tick/detik (1 tick per 5 detik real)", () => {
    const ticks = [0, 5, 10, 15].map(tick);
    expect(estimateTicksPerSecond(ticks)).toBe(0.2);
  });

  it("data sub-detik berjarak 0.5 detik → 2 tick/detik", () => {
    const ticks = [0, 0.5, 1, 1.5, 2].map(tick);
    expect(estimateTicksPerSecond(ticks)).toBe(2);
  });

  it("tahan terhadap outlier (median)", () => {
    const ticks = [0, 1, 2, 30, 3, 4].map(tick);
    expect(estimateTicksPerSecond(ticks)).toBe(1);
  });

  it("kurang dari 2 tick atau tanpa delta → fallback 1", () => {
    expect(estimateTicksPerSecond([tick(0)])).toBe(1);
    expect(estimateTicksPerSecond([])).toBe(1);
  });
});
