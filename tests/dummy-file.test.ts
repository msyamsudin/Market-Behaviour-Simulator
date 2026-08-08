import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateTicks } from "../src/engine/candle/aggregator";
import { parseCSVTicks } from "../src/utils/csv";

const csv = readFileSync("public/dummy-ticks.csv", "utf8");

describe("dummy file → pipeline (M2)", () => {
  it("mem-parse seluruh 1500 baris tick tanpa drop", () => {
    const ticks = parseCSVTicks(csv);
    expect(ticks).toHaveLength(1500);
  });

  it("agregasi ke 1 menit tidak kehilangan volume (tidak ada tick terbuang)", () => {
    const ticks = parseCSVTicks(csv);
    const candles = aggregateTicks(ticks, 60);
    const sumTickVolume = ticks.reduce((s, t) => s + t.volume, 0);
    const sumCandleVolume = candles.reduce((s, c) => s + c.volume, 0);
    expect(sumCandleVolume).toBe(sumTickVolume);
  });

  it("menghasilkan 25 candle untuk 1500 tick (60 tick per menit)", () => {
    const ticks = parseCSVTicks(csv);
    const candles = aggregateTicks(ticks, 60);
    expect(candles).toHaveLength(25);
  });
});
