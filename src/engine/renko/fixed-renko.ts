import type { Brick, IRenko, RenkoState } from "../../types/renko";
import type { Tick } from "../../types/tick";

/**
 * Renko fixed brick, metode classic:
 * - Brick terbentuk saat harga melewati batas brickSize dari level saat ini.
 * - Multi-brick diperbolehkan saat tren kuat (floor(distance / brickSize)).
 * - Reversal butuh satu brick penuh melawan arah terakhir.
 * - Harga partial (sisa yang belum penuh brick) dipertahankan di state.
 */
export class FixedRenko implements IRenko {
  readonly id = "fixed-renko";
  readonly brickSize: number;

  constructor(brickSize: number) {
    this.brickSize = brickSize;
  }

  add(t: Tick, state: RenkoState): Brick[] {
    const bricks: Brick[] = [];
    let price = state.currentPrice;

    if (price === null) {
      state.currentPrice = t.price;
      state.direction = null;
      state.lastTime = Math.max(state.lastTime, t.time);
      return bricks;
    }

    const diff = t.price - price;
    if (diff === 0) return bricks;

    const direction: "up" | "down" = diff > 0 ? "up" : "down";
    const count = Math.floor(Math.abs(diff) / this.brickSize);
    if (count === 0) return bricks;

    for (let i = 0; i < count; i++) {
      const open: number = price;
      const close: number = direction === "up" ? open + this.brickSize : open - this.brickSize;
      let time = t.time;
      if (time <= state.lastTime) time = state.lastTime + 1;
      state.lastTime = time;
      bricks.push({
        time,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        direction,
      });
      price = close;
    }

    state.currentPrice = price;
    state.direction = direction;
    return bricks;
  }
}

export function createRenkoState(): RenkoState {
  return { currentPrice: null, direction: null, lastTime: 0 };
}

/** Agregasi penuh tick → brick untuk rendering non-realtime. */
export function buildRenko(ticks: Tick[], brickSize: number): Brick[] {
  const renko = new FixedRenko(brickSize);
  const state = createRenkoState();
  const bricks: Brick[] = [];
  for (const t of ticks) {
    bricks.push(...renko.add(t, state));
  }
  return bricks;
}
