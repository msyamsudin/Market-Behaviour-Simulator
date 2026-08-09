import { useChartStore } from "../app/chartStore";
import "../styles/statistics-panel.css";

export function StatisticsPanel() {
  const stats = useChartStore((s) => s.syntheticStats);

  if (!stats) {
    return (
      <div className="stats-panel-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b93a7" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Statistics not available yet.</span>
      </div>
    );
  }

  const fmt = (n: number, prec = 5): string => {
    if (!Number.isFinite(n)) return "—";
    return n.toPrecision(prec);
  };

  const fmtNum = (n: number): string => {
    return n.toLocaleString();
  };

  return (
    <div className="stats-panel-container">
      <div className="stats-section">
        <div className="stats-section-title">Return Distribution</div>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Ticks</span>
            <span className="stat-value">{fmtNum(stats.returns.count)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Mean Return</span>
            <span className={`stat-value ${stats.returns.mean >= 0 ? "is-pos" : "is-neg"}`}>
              {fmt(stats.returns.mean, 4)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Std Dev (Volatility)</span>
            <span className="stat-value">{fmt(stats.returns.std, 4)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Skewness</span>
            <span className="stat-value">{fmt(stats.returns.skewness, 4)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Kurtosis</span>
            <span className="stat-value">{fmt(stats.returns.kurtosis, 4)}</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <div className="stats-section-title">Market Structure & Density</div>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Tick Density</span>
            <span className="stat-value">{fmt(stats.density.ticksPerSecond, 3)} <small>ticks/s</small></span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg Candle Range (1m)</span>
            <span className="stat-value">{fmt(stats.density.avgCandleRange, 4)}</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <div className="stats-section-title">Volatility Clustering (ACF Sq. Return)</div>
        <div className="acf-list">
          {stats.clustering.acfSqReturns.map((v, i) => {
            const pct = Math.min(100, Math.max(0, v * 100));
            return (
              <div key={`acf-${i}`} className="acf-item">
                <div className="acf-header">
                  <span className="acf-label">Lag {i + 1}</span>
                  <span className="acf-val">{fmt(v, 4)}</span>
                </div>
                <div className="acf-bar-track">
                  <div className="acf-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
