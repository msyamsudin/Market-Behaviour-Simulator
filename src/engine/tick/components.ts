import type { Candle } from "../../types/candle";
import type { TickComponent } from "../../types/tick-component";
import { randomNormal } from "../../utils/rng";
import { LiquidityComponent } from "../market/liquidity";

type ComponentParams = Record<string, number>;

export type ComponentContext = Parameters<TickComponent["next"]>[0];

export function withDefaults(defaults: ComponentParams, params?: Partial<ComponentParams>): ComponentParams {
  if (!params) return defaults;
  const out: ComponentParams = { ...defaults };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function lastCloses(candles: Candle[], window: number): number[] {
  const k = Math.min(window, candles.length);
  const out: number[] = [];
  for (let i = candles.length - k; i < candles.length; i++) {
    out.push(candles[i].close);
  }
  return out;
}

/** Random walk murni. */
export class NoiseComponent implements TickComponent {
  readonly id = "noise";
  readonly params: ComponentParams;
  constructor(params?: Partial<ComponentParams>) {
    this.params = withDefaults({ noiseLevel: 0.1 }, params);
  }
  next(ctx: ComponentContext): number {
    return this.params.noiseLevel * randomNormal(ctx.rng);
  }
}

/** Drift bias konstan. */
export class TrendComponent implements TickComponent {
  readonly id = "trend";
  readonly params: ComponentParams;
  constructor(params?: Partial<ComponentParams>) {
    this.params = withDefaults({ trendStrength: 0.01, trendBias: 0.3 }, params);
  }
  next(_ctx: ComponentContext): number {
    return this.params.trendStrength * this.params.trendBias;
  }
}

/**
 * Volatilitas dinamis (GARCH(1,1)): variance berevolusi
 * σ² = omega + alpha·delta² + beta·σ², dengan alpha+beta < 1 (stasioner).
 * Volatilitas membesar setelah harga mulai bergerak lalu meluruh — menghasilkan
 * volatility clustering yang terukur. delta = scale·σ·N(0,1).
 */
export class VolatilityComponent implements TickComponent {
  readonly id = "volatility";
  readonly params: ComponentParams;
  private sigma2: number;
  constructor(params?: Partial<ComponentParams>) {
    const p = withDefaults({ omega: 0.0004, alpha: 0.1, beta: 0.85, scale: 1 }, params);
    // Stasioneritas: jamin alpha + beta < 1 supaya sigma² awal terdefinisi
    // (omega / (1 - alpha - beta) > 0) dan varian konvergen. User override yang
    // melanggar dibatasi, bukan dibiarkan menghasilkan nilai negatif/infinite.
    if (p.alpha + p.beta >= 1) p.beta = Math.min(p.beta, 1 - p.alpha - 1e-3);
    this.params = p;
    this.sigma2 = Math.max(this.params.omega / (1 - this.params.alpha - this.params.beta), Number.EPSILON);
  }
  next(ctx: ComponentContext): number {
    // Shock = total delta semua komponen pada tick sebelumnya (bukan delta
    // volatilitas saja): pergerakan besar dari sumber mana pun memicu
    // pergerakan besar berikutnya (volatility clustering).
    const shock = ctx.lastTotalDelta;
    this.sigma2 = Math.max(
      Number.EPSILON,
      this.params.omega + this.params.alpha * shock * shock + this.params.beta * this.sigma2,
    );
    const sigma = Math.sqrt(this.sigma2);
    return this.params.scale * sigma * randomNormal(ctx.rng);
  }
}

/** Tarik harga kembali ke mean close baru-baru ini. */
export class MeanReversionComponent implements TickComponent {
  readonly id = "mean-reversion";
  readonly params: ComponentParams;
  constructor(params?: Partial<ComponentParams>) {
    this.params = withDefaults({ strength: 0.02, window: 20 }, params);
  }
  next(ctx: ComponentContext): number {
    const closes = lastCloses(ctx.history, this.params.window);
    if (closes.length < 2) return 0;
    const mean = closes.reduce((s, v) => s + v, 0) / closes.length;
    return this.params.strength * (mean - ctx.price);
  }
}

export function createComponent(id: string, params?: Partial<ComponentParams>): TickComponent {
  switch (id) {
    case "noise":
      return new NoiseComponent(params);
    case "trend":
      return new TrendComponent(params);
    case "volatility":
      return new VolatilityComponent(params);
    case "mean-reversion":
      return new MeanReversionComponent(params);
    case "liquidity":
      return new LiquidityComponent(params);
    default:
      throw new Error(`unknown component: ${id}`);
  }
}
