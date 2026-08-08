import { describe, expect, it } from "vitest";
import { ATRIndicator, computeATR } from "../src/engine/indicator/atr";
import { indicatorRegistry } from "../src/engine/indicator/registry";
import type { Candle } from "../src/types/candle";

/**
 * Referensi manual ATR Wilder (period 2), M6.
 *
 * TR = max(H-L, |H - prevClose|, |L - prevClose|):
 *   bar0 H10 L8  C9  → TR = 2
 *   bar1 H11 L9  C10 → TR = max(2, |11-9|=2, |9-9|=0)  = 2
 *   bar2 H12 L8  C9  → TR = max(4, |12-10|=2, |8-10|=2) = 4
 *   bar3 H10 L7  C8  → TR = max(3, |10-9|=1, |7-9|=2)  = 3
 *   bar4 H13 L9  C12 → TR = max(4, |13-8|=5, |9-8|=1)  = 5
 *
 * ATR pertama di index 2 = avg(TR[1..2]) = (2+4)/2 = 3
 * ATR[3] = (3*1 + 3)/2 = 3
 * ATR[4] = (3*1 + 5)/2 = 4
 */
const fixture: Candle[] = [
  { time: 1, open: 10, high: 10, low: 8, close: 9, volume: 1 },
  { time: 2, open: 9, high: 11, low: 9, close: 10, volume: 1 },
  { time: 3, open: 10, high: 12, low: 8, close: 9, volume: 1 },
  { time: 4, open: 9, high: 10, low: 7, close: 8, volume: 1 },
  { time: 5, open: 8, high: 13, low: 9, close: 12, volume: 1 },
];

describe("computeATR (Wilder)", () => {
  it("cocok dengan referensi manual period 2", () => {
    expect(computeATR(fixture, 2)).toEqual([null, null, 3, 3, 4]);
  });

  it("memberikan null selama warm-up dan nilai stabil setelahnya (period 14)", () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 30; i++) {
      const open = 100 + i * 0.1;
      candles.push({ time: i, open, high: open + 0.5, low: open - 0.5, close: open + 0.1, volume: 1 });
    }
    const values = computeATR(candles, 14);
    expect(values.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(values.slice(14).every((v) => v !== null)).toBe(true);
    expect(values[14]).toBeCloseTo(1, 5);
  });

  it("ATR(2) menghasilkan seri lengkap lewat onCandle", () => {
    const atr = new ATRIndicator(2);
    const values = fixture.map((c, i) => atr.onCandle(c, i, fixture));
    expect(values).toEqual([null, null, 3, 3, 4]);
  });

  it("terdaftar di registry dengan default period 14", () => {
    const atr = indicatorRegistry.get("atr");
    expect(atr).toBeDefined();
    expect(atr!.id).toBe("atr");
    expect(atr!.name).toBe("ATR (14)");
    expect(indicatorRegistry.list().map((i) => i.id)).toContain("atr");
  });
});
