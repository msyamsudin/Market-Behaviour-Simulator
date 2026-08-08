import { describe, expect, it } from "vitest";
import { buildRenko, FixedRenko, createRenkoState } from "../src/engine/renko/fixed-renko";
import type { Tick } from "../src/types/tick";

/**
 * Referensi manual Renko fixed brick (brickSize = 2), M7.
 *
 *   t1 price 10 → seed, tanpa brick
 *   t2 price 14 → +4  → 2 brick up:   (10→12), (12→14)
 *   t3 price 10 → -4  → 2 brick down: (14→12), (12→10)
 *   t4 price 15 → +5  → 2 brick up:   (10→12), (12→14)
 *
 * Urutan arah: [up, up, down, down, up, up] = 6 brick.
 * Close tiap brick: [12, 14, 12, 10, 12, 14].
 */
const ticks: Tick[] = [
  { time: 1, price: 10, volume: 1 },
  { time: 2, price: 14, volume: 1 },
  { time: 3, price: 10, volume: 1 },
  { time: 4, price: 15, volume: 1 },
];

describe("FixedRenko (classic)", () => {
  it("jumlah & arah brick cocok dengan simulasi manual", () => {
    const bricks = buildRenko(ticks, 2);
    expect(bricks).toHaveLength(6);
    expect(bricks.map((b) => b.direction)).toEqual(["up", "up", "down", "down", "up", "up"]);
    expect(bricks.map((b) => b.close)).toEqual([12, 14, 12, 10, 12, 14]);
    expect(bricks.map((b) => b.open)).toEqual([10, 12, 14, 12, 10, 12]);
  });

  it("pergerakan di dalam satu brick tidak menghasilkan brick", () => {
    const r = new FixedRenko(5);
    const s = createRenkoState();
    const out1 = r.add({ time: 1, price: 100, volume: 1 }, s);
    const out2 = r.add({ time: 2, price: 103, volume: 1 }, s);
    expect(out1).toHaveLength(0);
    expect(out2).toHaveLength(0);
  });

  it("multi-brick pada tren kuat (satu tick membentuk >1 brick)", () => {
    const r = new FixedRenko(1);
    const s = createRenkoState();
    r.add({ time: 1, price: 100, volume: 1 }, s);
    const out = r.add({ time: 2, price: 103.5, volume: 1 }, s);
    expect(out).toHaveLength(3);
    expect(out.map((b) => b.close)).toEqual([101, 102, 103]);
  });

  it("waktu brick selalu naik (monoton) bahkan saat multi-brick", () => {
    const r = new FixedRenko(1);
    const s = createRenkoState();
    r.add({ time: 1, price: 100, volume: 1 }, s);
    const out = r.add({ time: 2, price: 104, volume: 1 }, s);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].time).toBeGreaterThan(out[i - 1].time);
    }
    const next = r.add({ time: 3, price: 98, volume: 1 }, s);
    for (const b of next) {
      expect(b.time).toBeGreaterThan(out[out.length - 1].time);
    }
  });
});
