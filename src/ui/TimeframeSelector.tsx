import { useChartStore } from "../app/chartStore";
import { TIMEFRAMES } from "../engine/candle/timeframes";

const HTF_OPTIONS = TIMEFRAMES.filter((t) => t.seconds >= 15);

export function TimeframeSelector() {
  const { htfId, setHtf, isLoading } = useChartStore();
  const options = HTF_OPTIONS.length > 0 ? HTF_OPTIONS : TIMEFRAMES;

  return (
    <div className="timeframe-selector-group">
      <span className="control-group-label">HTF:</span>
      <div className="segmented-pills">
        {options.map((tf) => (
          <button
            key={tf.id}
            className={`pill-btn ${htfId === tf.id ? "active" : ""}`}
            onClick={() => setHtf(tf.id)}
            disabled={isLoading}
          >
            {tf.label}
          </button>
        ))}
      </div>
    </div>
  );
}
