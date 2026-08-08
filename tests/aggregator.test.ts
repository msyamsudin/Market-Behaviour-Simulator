import { describe, expect, it } from "vitest";
import { aggregateTicks } from "../src/engine/candle/aggregator";
import type { Tick } from "../src/types/tick";

/**
 * Referensi manual (spreadsheet) — M2.
 *
 * Fixture 8 tick dengan bucket 60 detik:
 *
 *   time  price  volume   bucket
 *   0     10     5        0
 *   1     11     2        0
 *   2     9      3        0
 *   59    12     4        0
 *   60    8      1        60
 *   61    13     2        60
 *   119   14     6        60
 *   120   7      3        120
 *
 * Perhitungan manual candle 1 menit:
 *   bucket 0  → open=10, high=12, low=9,  close=12, volume=5+2+3+4=14
 *   bucket 60 → open=8,  high=14, low=8,  close=14, volume=1+2+6=9
 *   bucket 120→ open=7,  high=7,  low=7,  close=7,  volume=3
 */
const fixture: Tick[] = [
  { time: 0, price: 10, volume: 5 },
  { time: 1, price: 11, volume: 2 },
  { time: 2, price: 9, volume: 3 },
  { time: 59, price: 12, volume: 4 },
  { time: 60, price: 8, volume: 1 },
  { time: 61, price: 13, volume: 2 },
  { time: 119, price: 14, volume: 6 },
  { time: 120, price: 7, volume: 3 },
];

describe("aggregateTicks", () => {
  it("menghasilkan OHLCV yang cocok dengan referensi manual", () => {
    const candles = aggregateTicks(fixture, 60);
    expect(candles).toEqual([
      { time: 0, open: 10, high: 12, low: 9, close: 12, volume: 14 },
      { time: 60, open: 8, high: 14, low: 8, close: 14, volume: 9 },
      { time: 120, open: 7, high: 7, low: 7, close: 7, volume: 3 },
    ]);
  });

  it("mengembalikan array kosong untuk input kosong", () => {
    expect(aggregateTicks([], 60)).toEqual([]);
  });

  it("bucket boundary memisahkan tick pertama dan terakhir satu menit", () => {
    const candles = aggregateTicks(
      [
        { time: 59, price: 1, volume: 1 },
        { time: 60, price: 2, volume: 1 },
      ],
      60,
    );
    expect(candles).toHaveLength(2);
    expect(candles[0].time).toBe(0);
    expect(candles[1].time).toBe(60);
  });
});
