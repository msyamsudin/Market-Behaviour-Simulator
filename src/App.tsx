import { useEffect, useState } from "react";
import { initPlaybackBridge, useChartStore } from "./app/chartStore";
import { SyncCharts } from "./chart/SyncCharts";
import { SideDrawer, type SideDrawerTab } from "./ui/SideDrawer";
import { TopBar } from "./ui/TopBar";
import { OrderBookPanel } from "./ui/OrderBookPanel";
import { brickToCandle } from "./utils/brick-to-candle";
import "./styles/base.css";
import "./styles/chart.css";

function App() {
  const htfCandles = useChartStore((s) => s.htfCandles);
  const ltfCandles = useChartStore((s) => s.ltfCandles);
  const renkoBricks = useChartStore((s) => s.renkoBricks);
  const bottomPane = useChartStore((s) => s.bottomPane);
  const brickSize = useChartStore((s) => s.brickSize);
  const htfId = useChartStore((s) => s.htfId);
  const indicatorValues = useChartStore((s) => s.indicatorValues);
  const indicatorId = useChartStore((s) => s.indicatorId);
  const error = useChartStore((s) => s.error);
  const dataRevision = useChartStore((s) => s.dataRevision);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SideDrawerTab>("components");

  useEffect(() => {
    const offBridge = initPlaybackBridge();
    useChartStore.getState().loadSynthetic();
    return offBridge;
  }, []);

  const bottomData = bottomPane === "renko" ? renkoBricks.map(brickToCandle) : ltfCandles;
  const bottomTitle = bottomPane === "renko" ? `Renko · brick ${brickSize}` : "1s candles";

  return (
    <main className="app">
      {error && (
        <div className="app-error-banner" role="alert">
          <span>⚠</span>
          <span>Gagal membuat data: {error}</span>
        </div>
      )}

      <TopBar />

      <div className="app-workspace">
        <div className="chart-view-area">
          {!drawerOpen && (
            <button
              className="floating-drawer-toggle"
              onClick={() => {
                setDrawerOpen(true);
                setActiveTab("components");
              }}
              title="Open Controls & Statistics Drawer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Controls & Analytics</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <SyncCharts
            htfData={htfCandles}
            ltfData={bottomData}
            htfTitle={`${htfId} candles${indicatorId ? ` · ${indicatorId.toUpperCase()}` : ""}`}
            ltfTitle={bottomTitle}
            htfOverlay={{ values: indicatorValues, color: "#2962ff" }}
            dataRevision={dataRevision}
          />

          {bottomPane === "orderbook" && <OrderBookPanel />}
        </div>

        <SideDrawer
          isOpen={drawerOpen}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onClose={() => setDrawerOpen(false)}
        />
      </div>
    </main>
  );
}

export default App;
