import type { Candle } from "../types/candle";
import type { Brick } from "../types/renko";

/** Brick → Candle agar bisa dirender lewat series candlestick (volume dummy 0). */
export function brickToCandle(b: Brick): Candle {
  return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: 0 };
}
