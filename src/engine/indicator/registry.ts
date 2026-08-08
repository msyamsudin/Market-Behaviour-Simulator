import type { IIndicator } from "../../types/indicator";
import { ATRIndicator } from "./atr";

/**
 * Registry indikator pluggable — indikator baru cukup di-register di sini.
 */
export class IndicatorRegistry {
  private readonly indicators = new Map<string, IIndicator>();

  register(ind: IIndicator): void {
    this.indicators.set(ind.id, ind);
  }

  get(id: string): IIndicator | undefined {
    return this.indicators.get(id);
  }

  list(): IIndicator[] {
    return [...this.indicators.values()];
  }
}

export const indicatorRegistry = new IndicatorRegistry();
indicatorRegistry.register(new ATRIndicator(14));
