import { summarizeTicks, type TickStatistics } from "./metrics";
import type { Tick } from "../../types/tick";

export interface MetricComparison {
  metric: string;
  historical: number;
  synthetic: number;
  ratio: number | null;
}

/**
 * Perbandingan numerik synthetic vs historical (file referensi sama seperti
 * M2) — bukan "kelihatan mirip", tapi angka yang dibandingkan.
 *
 * TODO(M13): panel perbandingan historical di UI belum diimplementasi;
 * fungsi ini disimpan sebagai fondasi untuk fitur "load historical data"
 * di Track D.
 */
export function compareStatistics(historical: TickStatistics, synthetic: TickStatistics): MetricComparison[] {
  const rows: MetricComparison[] = [];

  const r = (name: string, h: number, s: number): void => {
    rows.push({
      metric: name,
      historical: h,
      synthetic: s,
      ratio: h === 0 ? null : s / h,
    });
  };

  r("return mean", historical.returns.mean, synthetic.returns.mean);
  r("return std", historical.returns.std, synthetic.returns.std);
  r("return skewness", historical.returns.skewness, synthetic.returns.skewness);
  r("return kurtosis", historical.returns.kurtosis, synthetic.returns.kurtosis);

  for (let l = 0; l < historical.clustering.acfSqReturns.length; l++) {
    r(
      `ACF sq. return lag ${l + 1}`,
      historical.clustering.acfSqReturns[l] ?? 0,
      synthetic.clustering.acfSqReturns[l] ?? 0,
    );
  }

  r("tick density (ticks/sec)", historical.density.ticksPerSecond, synthetic.density.ticksPerSecond);
  r("avg candle range (1m)", historical.density.avgCandleRange, synthetic.density.avgCandleRange);

  return rows;
}

export function compareTicks(historicalTicks: Tick[], syntheticTicks: Tick[]): MetricComparison[] {
  return compareStatistics(summarizeTicks(historicalTicks), summarizeTicks(syntheticTicks));
}
