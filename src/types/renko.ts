import type { Tick } from "./tick";

export interface Brick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  direction: "up" | "down";
}

/**
 * State mutable milik engine Renko — dipakai berkelanjutan di dalam worker
 * selama playback (dan dihitung ulang penuh saat load).
 */
export interface RenkoState {
  currentPrice: number | null;
  direction: "up" | "down" | null;
  lastTime: number;
}

export interface IRenko {
  readonly id: string;
  readonly brickSize: number;
  add(t: Tick, state: RenkoState): Brick[];
}
