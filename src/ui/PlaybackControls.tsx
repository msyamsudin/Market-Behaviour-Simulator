import { useChartStore } from "../app/chartStore";

const SPEEDS = [1, 2, 5, 10];

export function PlaybackControls() {
  const {
    playback, play, pause, stop, step, setSpeed, setLoop,
    loadSynthetic, isLoading, dirty, seed, setSeed,
  } = useChartStore();
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

      <div className="pb-seed-group">
        <input
          type="number"
          min={0}
          step={1}
          value={seed}
          onChange={(e) => setSeed(parseInt(e.target.value, 10))}
          className="pb-number-input"
          disabled={isLoading}
          title="Seed PRNG. Nilai yang sama + konfigurasi sama menghasilkan seri identik."
        />
        <button
          type="button"
          className="pb-seed-random-btn"
          onClick={() => setSeed(Math.floor(Math.random() * 2 ** 32))}
          disabled={isLoading}
          title="Acak seed untuk variasi baru"
        >
          🎲
        </button>
      </div>

      <button
        className={`pb-regen-btn ${dirty ? "is-dirty" : ""}`}
        onClick={() => void loadSynthetic()}
        disabled={isLoading}
        title={dirty ? "Menerapkan konfigurasi saat ini ke data" : "Membuat ulang data sintetis"}
      >
        {isLoading ? (
          <>Generating...</>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6" />
              <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16" />
            </svg>
            Re-generate
          </>
        )}
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
