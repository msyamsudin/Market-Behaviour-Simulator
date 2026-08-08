import type { Candle } from "../../types/candle";
import type { Tick } from "../../types/tick";

/**
 * Agregasi tick → candle OHLC untuk timeframe tertentu (detik).
 *
 * Bucket ditentukan dari `time` tick: `floor(time / tfSeconds) * tfSeconds`.
 * Tick pertama dalam bucket menjadi `open`; `high`/`low` di-update dari
 * seluruh harga dalam bucket; `close` adalah harga tick terakhir; `volume`
 * dijumlahkan. Output berurutan oleh waktu, tanpa gap (bucket kosong tidak
 * menghasilkan candle).
 */
export function aggregateTicks(ticks: Tick[], tfSeconds: number): Candle[] {
  if (ticks.length === 0) return [];

  const candles: Candle[] = [];
  let current: Candle | null = null;

  for (const t of ticks) {
    const bucket = Math.floor(t.time / tfSeconds) * tfSeconds;
    if (current === null || bucket !== current.time) {
      if (current !== null) candles.push(current);
      current = {
        time: bucket,
        open: t.price,
        high: t.price,
        low: t.price,
        close: t.price,
        volume: t.volume,
      };
    } else {
      if (t.price > current.high) current.high = t.price;
      if (t.price < current.low) current.low = t.price;
      current.close = t.price;
      current.volume += t.volume;
    }
  }

  if (current !== null) candles.push(current);
  return candles;
}
