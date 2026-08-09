import { useRef } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import type { Candle } from "../types/candle";
import { Chart, type ChartHandle } from "../chart/Chart";
import "../styles/chart.css";

interface SyncChartsProps {
  htfData: Candle[];
  ltfData: Candle[];
  htfTitle: string;
  ltfTitle: string;
  htfOverlay?: { values: (number | null)[]; color?: string };
  dataRevision?: number;
}

/**
 * Dua chart bertumpuk (HTF atas, LTF bawah) dengan shared crosshair. Zoom/time
 * axis tidak disinkronkan sehingga masing-masing jendela bisa di-zoom sendiri.
 * Guard `syncing` mencegah feedback loop saat posisi crosshair diterapkan
 * dari chart satu ke chart lain.
 */
export function SyncCharts({ htfData, ltfData, htfTitle, ltfTitle, htfOverlay, dataRevision }: SyncChartsProps) {
  const topRef = useRef<ChartHandle>(null);
  const bottomRef = useRef<ChartHandle>(null);
  const syncing = useRef(false);

  function syncCallbacks(to: React.RefObject<ChartHandle | null>) {
    return {
      onCrosshairMove: (price: number, time: UTCTimestamp) => {
        if (syncing.current) return;
        syncing.current = true;
        to.current?.setCrosshairPosition(price, time);
        syncing.current = false;
      },
      onCrosshairLeave: () => {
        if (syncing.current) return;
        syncing.current = true;
        to.current?.clearCrosshairPosition();
        syncing.current = false;
      },
    };
  }

  return (
    <div className="sync-charts">
      <Chart
        ref={topRef}
        data={htfData}
        title={htfTitle}
        overlay={htfOverlay}
        dataRevision={dataRevision}
        {...syncCallbacks(bottomRef)}
      />
      <Chart ref={bottomRef} data={ltfData} title={ltfTitle} dataRevision={dataRevision} {...syncCallbacks(topRef)} />
    </div>
  );
}
