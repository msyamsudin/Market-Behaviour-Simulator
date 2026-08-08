export interface Tick {
  time: number;
  price: number;
  volume: number;
  side?: "buy" | "sell";
}
