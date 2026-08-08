import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateTicks } from "../src/engine/candle/aggregator";
import { TIMEFRAMES } from "../src/engine/candle/timeframes";
import { parseCSVTicks } from "../src/utils/csv";

const csv = readFileSync("public/dummy-ticks.csv", "utf8");
const ticks = parseCSVTicks(csv);

describe("multi-timeframe aggregation (M4)", () => {
  it("menghasilkan jumlah candle yang benar per timeframe dari raw tick", () => {
    const expected: Record<string, number> = {
      "1s": 1500,
      "5s": 300,
      "15s": 100,
      "30s": 50,
      "1m": 25,
      "5m": 5,
    };
    for (const tf of TIMEFRAMES) {
      const candles = aggregateTicks(ticks, tf.seconds);
      expect(candles.length, tf.id).toBe(expected[tf.id]);
    }
  });

  it("bucket pertama selaras dengan awal data di semua timeframe", () => {
    const start = ticks[0].time;
    for (const tf of TIMEFRAMES) {
      const candles = aggregateTicks(ticks, tf.seconds);
      expect(candles[0].time, tf.id).toBe(Math.floor(start / tf.seconds) * tf.seconds);
    }
  });

  it("agregasi deterministik — hasil sama setiap kali dipanggil (basis cache)", () => {
    const a = aggregateTicks(ticks, 60);
    const b = aggregateTicks(ticks, 60);
    expect(a).toEqual(b);
  });

  it("total volume konsisten antar timeframe (sumber raw tick yang sama)", () => {
    const totalVolume = ticks.reduce((s, t) => s + t.volume, 0);
    for (const tf of TIMEFRAMES) {
      const candles = aggregateTicks(ticks, tf.seconds);
      const sum = candles.reduce((s, c) => s + c.volume, 0);
      expect(sum, tf.id).toBe(totalVolume);
    }
  });
});
