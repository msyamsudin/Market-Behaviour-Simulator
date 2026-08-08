import { useChartStore } from "../app/chartStore";

const SPEEDS = [1, 2, 5, 10];

export function PlaybackControls() {
  const { playback, play, pause, stop, step, setSpeed, setLoop } = useChartStore();
  const isPlaying = playback.status === "playing";
  const disabled = playback.total === 0;

  const pct = playback.total > 0 ? (playback.index / playback.total) * 100 : 0;

  return (
    <div className="playback-deck">
      <div className="pb-btn-group">
        <button
          className="pb-icon-btn"
          onClick={stop}
          disabled={disabled}
          title="Reset Playback (Stop)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        </button>

        {isPlaying ? (
          <button
            className="pb-icon-btn pb-main-btn"
            onClick={pause}
            disabled={disabled}
            title="Pause Simulation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            className="pb-icon-btn pb-main-btn"
            onClick={play}
            disabled={disabled}
            title="Play Simulation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}

        <button
          className="pb-icon-btn"
          onClick={step}
          disabled={disabled}
          title="Step 1 Tick Forward"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4" />
            <rect x="17" y="4" width="3" height="16" rx="1" />
          </svg>
        </button>
      </div>

      <div className="pb-speed-pills">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed-pill ${playback.speed === s ? "active" : ""}`}
            onClick={() => setSpeed(s)}
            disabled={disabled}
          >
            {s}x
          </button>
        ))}
      </div>

      <button
        className={`pb-loop-btn ${playback.loop ? "active" : ""}`}
        onClick={() => setLoop(!playback.loop)}
        disabled={disabled}
        title={playback.loop ? "Loop: restart dari awal setelah selesai" : "Loop: mati"}
      >
        ⟳ Loop
      </button>

      <div className="pb-progress-container" title={`${playback.index} / ${playback.total} Ticks (${pct.toFixed(1)}%)`}>
        <div className="pb-progress-bar">
          <div className="pb-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="pb-counter">
          {playback.index.toLocaleString()} / {playback.total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
