export interface Timeframe {
  id: string;
  label: string;
  seconds: number;
}

export const TIMEFRAMES: Timeframe[] = [
  { id: "1s", label: "1s", seconds: 1 },
  { id: "5s", label: "5s", seconds: 5 },
  { id: "15s", label: "15s", seconds: 15 },
  { id: "30s", label: "30s", seconds: 30 },
  { id: "1m", label: "1m", seconds: 60 },
  { id: "5m", label: "5m", seconds: 300 },
];

export function getTimeframe(id: string): Timeframe {
  return TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[4];
}
