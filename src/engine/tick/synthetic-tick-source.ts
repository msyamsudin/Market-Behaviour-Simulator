import type { Tick } from "../../types/tick";
import type { TickSource } from "../../types/tick-source";
import { generateComponentTicks, type ActiveComponent, type ComponentTickGeneratorParams } from "./component-tick-generator";

export type SyntheticParams = Omit<ComponentTickGeneratorParams, "components"> & {
  components: ActiveComponent[];
};

/**
 * Implementasi `TickSource` untuk data sintetis. Output generator melewati
 * pipeline (playback, aggregator, chart) melalui interface `TickSource` yang
 * sama seperti sumber tick lainnya.
 */
export class SyntheticTickSource implements TickSource {
  readonly id = "synthetic";
  readonly name: string;
  private readonly params: SyntheticParams;

  constructor(params: SyntheticParams, name = "Synthetic") {
    this.params = params;
    this.name = name;
  }

  async fetchTicks(): Promise<Tick[]> {
    return generateComponentTicks(this.params);
  }
}
