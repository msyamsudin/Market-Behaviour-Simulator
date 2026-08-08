import type { Tick } from "../../types/tick";
import type { TickComponent } from "../../types/tick-component";
import { ComponentTickHarness } from "./component-harness";

export interface ActiveComponent {
  component: TickComponent;
  enabled: boolean;
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
}

/**
 * Generator tick berbasis komponen: `nextTick = sum(delta komponen aktif)`.
 * Riwayat candle (completed + forming) dijaga inkremental dan dilihat komponen
 * sebagai konteks (volatility, mean reversion).
 */
export function generateComponentTicks(params: ComponentTickGeneratorParams): Tick[] {
  const harness = new ComponentTickHarness(params.seed, params.tfSeconds, params.components);
  let price = params.startPrice;
  const ticks: Tick[] = [];

  for (let i = 0; i < params.count; i++) {
    const tickTime = params.startTime + i * params.tickIntervalSeconds;
    const delta = harness.biasAt(price, tickTime);
    price = Math.max(0.01, price + delta);

    const tick: Tick = {
      time: tickTime,
      price: Math.round(price * 100) / 100,
      volume: Math.floor(harness.rng() * params.baseVolume) + 1,
    };
    ticks.push(tick);

    harness.push(tick);
  }

  return ticks;
}
