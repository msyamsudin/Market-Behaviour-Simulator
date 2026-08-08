import type { Candle } from "../../types/candle";
import type { Tick } from "../../types/tick";

export interface ReturnStats {
  count: number;
  mean: number;
  std: number;
  skewness: number;
  kurtosis: number;
}

export interface ClusteringStats {
  acfSqReturns: number[];
}

export interface DensityStats {
  tickCount: number;
  candleCount: number;
  ticksPerSecond: number;
  avgCandleRange: number;
}

export interface TickStatistics {
  returns: ReturnStats;
  clustering: ClusteringStats;
  density: DensityStats;
}

export function computeReturns(ticks: Tick[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < ticks.length; i++) {
    const prev = ticks[i - 1].price;
    if (prev === 0) continue;
    out.push((ticks[i].price - prev) / prev);
  }
  return out;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/**
 * Standard deviation sampel (pembagi n-1), konsisten dengan koreksi sampel
 * yang dipakai `skewness` dan `kurtosis` di file yang sama.
 */
export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, v) => s + (v - m) * (v - m), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Skewness (momen ketiga ternormalisasi). */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = std(xs);
  if (s === 0) return 0;
  const sum = xs.reduce((acc, v) => acc + Math.pow((v - m) / s, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/** Excess kurtosis (momen keempat ternormalisasi minus 3). */
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const s = std(xs);
  if (s === 0) return 0;
  const sum = xs.reduce((acc, v) => acc + Math.pow((v - m) / s, 4), 0);
  const part = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum;
  return part - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
}

/** ACF sample untuk satu lag. */
export function autocorrelation(xs: number[], lag: number): number {
  const n = xs.length;
  if (n <= lag + 1) return 0;
  const m = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (xs[i] - m) * (xs[i] - m);
  }
  for (let i = lag; i < n; i++) {
    num += (xs[i] - m) * (xs[i - lag] - m);
  }
  return den === 0 ? 0 : num / den;
}

/** Volatility clustering: ACF return kuadrat untuk lag 1..maxLag. */
export function autocorrelationSquaredReturns(returns: number[], maxLag: number): number[] {
  const sq = returns.map((r) => r * r);
  const out: number[] = [];
  for (let l = 1; l <= maxLag; l++) out.push(autocorrelation(sq, l));
  return out;
}

export function summarizeTicks(ticks: Tick[], tfSeconds = 60): TickStatistics {
  const returns = computeReturns(ticks);

  const candles: Candle[] = [];
  let current: Candle | null = null;
  for (const t of ticks) {
    const bucket = Math.floor(t.time / tfSeconds) * tfSeconds;
    if (current === null || bucket !== current.time) {
      if (current !== null) candles.push(current);
      current = { time: bucket, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.volume };
    } else {
      if (t.price > current.high) current.high = t.price;
      if (t.price < current.low) current.low = t.price;
      current.close = t.price;
      current.volume += t.volume;
    }
  }
  if (current !== null) candles.push(current);

  const avgCandleRange =
    candles.length === 0 ? 0 : candles.reduce((s, c) => s + (c.high - c.low), 0) / candles.length;

  const spanSeconds = ticks.length > 1 ? ticks[ticks.length - 1].time - ticks[0].time : 0;

  return {
    returns: {
      count: returns.length,
      mean: mean(returns),
      std: std(returns),
      skewness: skewness(returns),
      kurtosis: kurtosis(returns),
    },
    clustering: {
      acfSqReturns: autocorrelationSquaredReturns(returns, 5),
    },
    density: {
      tickCount: ticks.length,
      candleCount: candles.length,
      ticksPerSecond: spanSeconds > 0 ? ticks.length / spanSeconds : 0,
      avgCandleRange,
    },
  };
}
