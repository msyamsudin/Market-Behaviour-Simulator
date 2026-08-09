import type { Candle } from "../../types/candle";
import type { Tick } from "../../types/tick";
import type { TickComponent } from "../../types/tick-component";
import { aggregateTicks } from "../candle/aggregator";
import { mulberry32 } from "../../utils/rng";

export interface LiquidityLevel {
  type: "high" | "low";
  price: number;
  equal: boolean;
}

/**
 * Pelacak level likuiditas minimal: previous high/low dan equal high/low dari
 * window candle terbaru (bukan all-time high — supaya harga berosilasi di
 * sekitar level). Equal high = level yang disentuh berulang tanpa ditembus.
 */
export class LiquidityTracker {
  prevHigh: number | null = null;
  prevLow: number | null = null;
  private equalHigh = false;
  private equalLow = false;
  private readonly window: number;
  /** Cache: hasil update() hanya berubah saat jumlah candle (atau proximity) berubah. */
  private cacheKey = "";

  constructor(window = 30) {
    this.window = window;
  }

  update(candles: Candle[], proximity = 0.5): void {
    const end = Math.max(0, candles.length - 1);
    // Cache: hasil scan hanya bergantung pada candle selesai dalam window.
    // Key memakai (jumlah candle, waktu candle terakhir yang discan) — karena
    // history bisa di-trim ke MAX_HISTORY (panjang tetap tapi konten bergeser).
    const lastScanned = end > 0 ? candles[end - 1] : undefined;
    const key = `${candles.length}:${lastScanned ? lastScanned.time : 0}:${proximity}`;
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const start = Math.max(0, end - this.window);
    let ph: number | null = null;
    let pl: number | null = null;
    let touchesHigh = 0;
    let touchesLow = 0;
    for (let i = start; i < end; i++) {
      const c = candles[i];
      if (ph === null || c.high > ph) ph = c.high;
      if (pl === null || c.low < pl) pl = c.low;
      if (ph !== null && c.high >= ph - proximity) touchesHigh++;
      if (pl !== null && c.low <= pl + proximity) touchesLow++;
    }
    this.prevHigh = ph;
    this.prevLow = pl;
    this.equalHigh = touchesHigh >= 2;
    this.equalLow = touchesLow >= 2;
  }

  levels(): LiquidityLevel[] {
    const out: LiquidityLevel[] = [];
    if (this.prevHigh !== null) out.push({ type: "high", price: this.prevHigh, equal: this.equalHigh });
    if (this.prevLow !== null) out.push({ type: "low", price: this.prevLow, equal: this.equalLow });
    return out;
  }
}

/**
 * Komponen likuiditas ke-5 (opsional): saat harga mendekati level
 * previous/equal high-low, naikkan probabilitas sweep/breakout dengan
 * mendorong harga melewati level.
 *
 * Komponen memakai stream rng internal (deterministik) — TIDAK mengonsumsi
 * stream rng bersama, sehingga A/B dengan seed yang sama benar-benar hanya
 * membedakan efek komponen (jalur noise identik), dan perbedaan frekuensi
 * sweep terbukti statistik (M11).
 */
export class LiquidityComponent implements TickComponent {
  readonly id = "liquidity";
  readonly params: Record<string, number>;
  private readonly tracker = new LiquidityTracker();
  private readonly localRng = mulberry32(0x1eef5eed);

  constructor(params?: Partial<Record<string, number>>) {
    this.params = { sweepProbability: 0.15, proximity: 0.5, pushScale: 0.1, ...params };
  }

  next(ctx: { price: number; rng: () => number; history: Candle[]; lastTotalDelta: number }): number {
    this.tracker.update(ctx.history, this.params.proximity);
    const price = ctx.price;
    const { prevHigh, prevLow } = this.tracker;
    const nearHigh = prevHigh !== null && price >= prevHigh - this.params.proximity;
    const nearLow = prevLow !== null && price <= prevLow + this.params.proximity;
    if (!nearHigh && !nearLow) return 0;
    if (this.localRng() >= this.params.sweepProbability) return 0;
    if (nearHigh) return prevHigh! - price + this.params.pushScale;
    return prevLow! - price - this.params.pushScale;
  }
}

/**
 * Menghitung jumlah "level break": jumlah candle yang high-nya menembus
 * previous high (pierce). Ini adalah dasar peristiwa sweep/breakout — setiap
 * dorongan komponen likuiditas menghasilkan level break baru.
 */
export function countLevelBreaks(ticks: Tick[], tfSeconds = 60): number {
  const candles = aggregateTicks(ticks, tfSeconds);
  if (candles.length < 2) return 0;
  let runningHigh = candles[0].high;
  let breaks = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].high > runningHigh) {
      breaks++;
      runningHigh = candles[i].high;
    }
  }
  return breaks;
}

/**
 * Menghitung jumlah "sweep" (pierce + reject): candle menembus previous high
 * lalu harga close kembali di bawah level dalam `rejectWindow` candle.
 */
export function countSweeps(ticks: Tick[], tfSeconds = 60, rejectWindow = 5): number {
  const candles = aggregateTicks(ticks, tfSeconds);
  if (candles.length < 2) return 0;
  let runningHigh = candles[0].high;
  let sweeps = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].high > runningHigh) {
      const pierced = runningHigh;
      runningHigh = candles[i].high;
      const limit = Math.min(i + rejectWindow, candles.length - 1);
      for (let j = i + 1; j <= limit; j++) {
        if (candles[j].close < pierced) {
          sweeps++;
          break;
        }
      }
    }
  }
  return sweeps;
}
