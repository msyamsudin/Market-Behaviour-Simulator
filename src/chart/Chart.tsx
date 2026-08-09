import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../types/candle";
import "../styles/chart.css";

interface ChartProps {
  data: Candle[];
  title?: string;
  overlay?: { values: (number | null)[]; color?: string };
  /** Naikkan nilai ini saat data di-reload penuh agar chart menampilkan seluruh candle. */
  dataRevision?: number;
  onCrosshairMove?: (price: number, time: UTCTimestamp) => void;
  onCrosshairLeave?: () => void;
  onVisibleRangeChange?: (range: LogicalRange) => void;
}

export interface ChartHandle {
  setCrosshairPosition(price: number, time: UTCTimestamp): void;
  clearCrosshairPosition(): void;
  setVisibleLogicalRange(range: LogicalRange): void;
}

function toSeriesData(candles: Candle[]): CandlestickData<UTCTimestamp>[] {
  // lightweight-charts mewajibkan data terurut naik oleh waktu. Sort defensif
  // melindungi dari batch playback basi yang mungkin tiba tidak berurutan.
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  return sorted.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export const Chart = forwardRef<ChartHandle, ChartProps>(function Chart(
  { data, title, overlay, dataRevision, onCrosshairMove, onCrosshairLeave, onVisibleRangeChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlayRef = useRef<ISeriesApi<"Line"> | null>(null);
  const dataRef = useRef<Candle[]>([]);
  const savedRangeRef = useRef<LogicalRange | null>(null);
  const revisionRef = useRef<number>(dataRevision ?? 0);
  const propsRef = useRef({ onCrosshairMove, onCrosshairLeave, onVisibleRangeChange });
  propsRef.current = { onCrosshairMove, onCrosshairLeave, onVisibleRangeChange };

  useImperativeHandle(ref, () => ({
    setCrosshairPosition(price, time) {
      const chart = chartRef.current;
      const series = seriesRef.current;
      // setCrosshairPosition pada series kosong memicu "Value is null" di
      // lightweight-charts. Guard: hanya terapkan jika sudah ada data.
      if (chart && series && series.data().length > 0) {
        chart.setCrosshairPosition(price, time, series);
      }
    },
    setVisibleLogicalRange(range) {
      chartRef.current?.timeScale().setVisibleLogicalRange(range);
    },
    clearCrosshairPosition() {
      chartRef.current?.clearCrosshairPosition();
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.5)" },
        horzLines: { color: "rgba(42, 46, 57, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#6a7280", width: 1, style: 2, labelBackgroundColor: "#2a2e39" },
        horzLine: { color: "#6a7280", width: 1, style: 2, labelBackgroundColor: "#2a2e39" },
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "#2a2e39" },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const overlaySeries = chart.addSeries(LineSeries, {
      color: "#ff9800",
      lineWidth: 1,
      priceScaleId: "atr",
    });
    chart.priceScale("atr").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

    chartRef.current = chart;
    seriesRef.current = series;
    overlayRef.current = overlaySeries;

    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      const { onCrosshairMove: cb, onCrosshairLeave } = propsRef.current;
      // Kursor meninggalkan chart: sembunyikan crosshair (disinkronkan juga di
      // chart lawan via onCrosshairLeave).
      if (param.point === undefined || param.time === undefined) {
        chart.clearCrosshairPosition();
        onCrosshairLeave?.();
        return;
      }
      if (!cb) return;
      const bar = param.seriesData.get(series);
      if (bar === undefined) return;
      const close = (bar as { close?: number }).close;
      if (typeof close === "number") {
        cb(close, param.time as UTCTimestamp);
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      // Simpan zoom/pan terakhir agar bisa dipulihkan saat simulasi dijalankan
      // ulang (data di-reset), sehingga user tidak perlu menyesuaikan lagi.
      if (range) savedRangeRef.current = range;
      const { onVisibleRangeChange: cb } = propsRef.current;
      if (!cb) return;
      if (range) cb(range);
    });

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const prev = dataRef.current;
    dataRef.current = data;
    series.setData(toSeriesData(data));
    if (!chartRef.current) return;
    const isReset = dataRevision !== undefined && dataRevision !== revisionRef.current;
    revisionRef.current = dataRevision ?? revisionRef.current;
    if (isReset) {
      // Regenerasi penuh: hapus range tersimpan dan tampilkan seluruh candle.
      savedRangeRef.current = null;
      chartRef.current.timeScale().fitContent();
      return;
    }
    const isExtension =
      prev.length > 0 &&
      data.length >= prev.length &&
      prev.every((c, i) => data[i].time === c.time);
    if (!isExtension) {
      const saved = savedRangeRef.current;
      if (saved) {
        chartRef.current.timeScale().setVisibleLogicalRange(saved);
      } else {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data, dataRevision]);

  useEffect(() => {
    const line = overlayRef.current;
    if (!line) return;
    const times = toSeriesData(data).map((d) => d.time);
    if (!overlay || overlay.values.length === 0) {
      line.setData([]);
      return;
    }
    const lineData: LineData<UTCTimestamp>[] = [];
    const values = overlay.values;
    for (let i = 0; i < values.length && i < times.length; i++) {
      const v = values[i];
      if (v !== null) lineData.push({ time: times[i], value: v });
    }
    line.setData(lineData);
  }, [data, overlay]);

  return (
    <div className="chart-wrapper">
      {title && <div className="chart-title">{title}</div>}
      <div ref={containerRef} className="chart-pane" />
    </div>
  );
});
