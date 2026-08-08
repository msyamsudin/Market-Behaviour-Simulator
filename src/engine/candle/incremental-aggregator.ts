import type { Candle } from "../../types/candle";
import type { Tick } from "../../types/tick";

/**
 * Agregasi inkremental tick → candle, dipakai di dalam worker agar playback
 * tidak mengulang agregasi dari nol setiap batch. Menghasilkan candle yang
 * identik dengan `aggregateTicks` (dijamin lewat unit test).
 */
export class IncrementalCandleAggregator {
  private tfSeconds: number;
  private current: Candle | null = null;

  constructor(tfSeconds: number) {
    this.tfSeconds = tfSeconds;
  }

  setTimeframe(tfSeconds: number): void {
    this.tfSeconds = tfSeconds;
    this.current = null;
  }

  /**
   * Menambahkan satu tick; mengembalikan candle yang telah *selesai* (bukan
   * candle yang sedang berjalan). Candle berjalan di-flush lewat `flush()`.
   */
  add(tick: Tick): Candle[] {
    const out: Candle[] = [];
    const bucket = Math.floor(tick.time / this.tfSeconds) * this.tfSeconds;

    if (this.current === null || bucket !== this.current.time) {
      if (this.current !== null) out.push(this.current);
      this.current = {
        time: bucket,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
      };
      return out;
    }

    const c = this.current;
    if (tick.price > c.high) c.high = tick.price;
    if (tick.price < c.low) c.low = tick.price;
    c.close = tick.price;
    c.volume += tick.volume;
    return out;
  }

  flush(): Candle[] {
    if (this.current === null) return [];
    const out = [this.current];
    this.current = null;
    return out;
  }

  /** Candle yang sedang berjalan (belum selesai), atau null. */
  peek(): Candle | null {
    return this.current;
  }

  reset(): void {
    this.current = null;
  }
}
