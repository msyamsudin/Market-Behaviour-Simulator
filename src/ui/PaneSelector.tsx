import { useChartStore, type BottomPane } from "../app/chartStore";

const PANES: { id: BottomPane; label: string }[] = [
  { id: "candle", label: "1s Candle" },
  { id: "renko", label: "Renko" },
  { id: "orderbook", label: "Orderbook" },
];

export function PaneSelector() {
  const { bottomPane, setBottomPane, brickSize, setBrickSize } = useChartStore();

  return (
    <div className="pane-selector-group">
      <div className="segmented-pills">
        {PANES.map((p) => (
          <button
            key={p.id}
            className={`pill-btn ${bottomPane === p.id ? "active" : ""}`}
            onClick={() => setBottomPane(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {bottomPane === "renko" && (
        <div className="brick-size-input-group" title="Renko Brick Size">
          <span className="control-group-label">Brick:</span>
          <input
            type="number"
            min={0.01}
            step={0.05}
            value={brickSize}
            onChange={(e) => setBrickSize(Number(e.target.value))}
            className="brick-input"
          />
        </div>
      )}
    </div>
  );
}
