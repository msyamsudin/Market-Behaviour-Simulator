import type { Tick } from "../../types/tick";
import type { TickComponent } from "../../types/tick-component";
import { ComponentTickHarness } from "./component-harness";

export interface ActiveComponent {
  component: TickComponent;
  enabled: boolean;
}

/** Satu fase simulasi: set komponen + jumlah tick yang dijalankan dengannya. */
export interface ComponentPhase {
  count: number;
  components: ActiveComponent[];
}

export interface ComponentTickGeneratorParams {
  seed: number;
  count: number;
  startPrice: number;
  startTime: number;
  tickIntervalSeconds: number;
  baseVolume: number;
  /** Timeframe candle (detik) untuk riwayat yang dilihat komponen. */
  tfSeconds?: number;
  components: ActiveComponent[];
  /**
   * Urutan fase (opsional). Saat ada, menggantikan `count`/`components` tunggal:
   * komponen ditukar di batas fase tanpa mereset stream rng, harga, riwayat
   * candle, atau state internal komponen (variance GARCH, tracker likuiditas).
   */
  phases?: ComponentPhase[];
}

/**
 * Generator tick berbasis komponen: `nextTick = sum(delta komponen aktif)`.
 * Riwayat candle (completed + forming) dijaga inkremental dan dilihat komponen
 * sebagai konteks (volatility, mean reversion).
 */
export function generateComponentTicks(params: ComponentTickGeneratorParams): Tick[] {
  const phases =
    params.phases && params.phases.length > 0
      ? params.phases
      : [{ count: params.count, components: params.components }];
  const harness = new ComponentTickHarness(params.seed, params.tfSeconds, phases[0].components);
  let price = params.startPrice;
  const ticks: Tick[] = [];
  let tickIndex = 0;

  for (const phase of phases) {
    harness.setComponents(phase.components);
    for (let i = 0; i < phase.count; i++) {
      const tickTime = params.startTime + tickIndex * params.tickIntervalSeconds;
      const delta = harness.biasAt(price, tickTime);
      price = Math.max(0.01, price + delta);

      const tick: Tick = {
        time: tickTime,
        price: Math.round(price * 100) / 100,
        volume: Math.floor(harness.rng() * params.baseVolume) + 1,
      };
      ticks.push(tick);

      harness.push(tick);
      tickIndex++;
    }
  }

  return ticks;
}
