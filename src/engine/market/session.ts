export type SessionId = "asia" | "london" | "overlap" | "newyork" | "offpeak";

export interface SessionMultipliers {
  volatility: number;
  liquidity: number;
  noise: number;
}

export interface SessionDef {
  id: SessionId;
  label: string;
  /** Jam UTC mulai (inklusif). */
  fromHour: number;
  /** Jam UTC akhir (eksklusif). */
  toHour: number;
  multipliers: SessionMultipliers;
}

/**
 * Jadwal sesi berbasis waktu simulasi (UTC). Desain:
 * - Asia: volatilitas rendah.
 * - London: normal.
 * - Overlap London/New York (13:00–16:00 UTC): tertinggi.
 * - New York: tinggi.
 * - Off-peak (21:00–24:00): rendah.
 */
export const SESSIONS: SessionDef[] = [
  { id: "asia", label: "Asia", fromHour: 0, toHour: 8, multipliers: { volatility: 0.6, liquidity: 0.7, noise: 0.7 } },
  { id: "london", label: "London", fromHour: 8, toHour: 13, multipliers: { volatility: 1.0, liquidity: 1.0, noise: 1.0 } },
  { id: "overlap", label: "London/NY Overlap", fromHour: 13, toHour: 16, multipliers: { volatility: 1.5, liquidity: 1.4, noise: 1.4 } },
  { id: "newyork", label: "New York", fromHour: 16, toHour: 21, multipliers: { volatility: 1.2, liquidity: 1.2, noise: 1.2 } },
  { id: "offpeak", label: "Off-peak", fromHour: 21, toHour: 24, multipliers: { volatility: 0.8, liquidity: 0.7, noise: 0.8 } },
];

export function sessionAt(timeSeconds: number): SessionDef {
  const hour = new Date(timeSeconds * 1000).getUTCHours();
  return (
    SESSIONS.find((s) => hour >= s.fromHour && hour < s.toHour) ??
    SESSIONS[SESSIONS.length - 1]
  );
}
