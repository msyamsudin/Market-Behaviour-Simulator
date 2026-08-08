import type { Candle } from "../../types/candle";
import type { IIndicator } from "../../types/indicator";

/**
 * ATR Wilder. Nilai per baris; `null` selama warm-up (belum ada period TR).
 *
 * TR = max(H-L, |H - prevClose|, |L - prevClose|); TR pertama = H-L.
 * ATR pertama (index === period) = rata-rata sederhana TR[1..period].
 * Setelahnya: ATR[i] = (ATR[i-1] * (period-1) + TR[i]) / period.
 */
export function computeATR(candles: Candle[], period: number): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n === 0 || period < 1) return out;

  const trs = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    if (i === 0) {
      trs[i] = c.high - c.low;
    } else {
      const pc = candles[i - 1].close;
      trs[i] = Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
    }
  }

  if (n <= period) return out;

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  let atr = sum / period;
  out[period] = atr;
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out[i] = atr;
  }
  return out;
}

export class ATRIndicator implements IIndicator {
  readonly id = "atr";
  readonly name: string;
  private readonly period: number;
  private cache: { ref: Candle[]; values: (number | null)[] } | null = null;

  constructor(period = 14) {
    this.period = period;
    this.name = `ATR (${period})`;
  }

  onCandle(_c: Candle, index: number, candles: Candle[]): number | null {
    if (!this.cache || this.cache.ref !== candles) {
      this.cache = { ref: candles, values: computeATR(candles, this.period) };
    }
    return this.cache.values[index] ?? null;
  }
}
