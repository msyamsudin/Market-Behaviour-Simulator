import { IndicatorSelector } from "./IndicatorSelector";
import { PaneSelector } from "./PaneSelector";
import { PlaybackControls } from "./PlaybackControls";
import { PresetBadge } from "./PresetBadge";

import { TimeframeSelector } from "./TimeframeSelector";

export function TopBar() {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="brand-badge">
          <svg className="brand-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span className="brand-title">Market Simulator</span>
        </div>
        <PresetBadge />
      </div>

      <div className="topbar-center">
        <div className="topbar-controls-group">
          <TimeframeSelector />
          <div className="topbar-divider" />
          <IndicatorSelector />
          <div className="topbar-divider" />
          <PaneSelector />
        </div>
      </div>

      <div className="topbar-right">
        <PlaybackControls />
      </div>
    </header>
  );
}
