import { IndicatorSelector } from "./IndicatorSelector";
import { PaneSelector } from "./PaneSelector";
import { PlaybackControls } from "./PlaybackControls";
import { PresetBadge } from "./PresetBadge";

import { TimeframeSelector } from "./TimeframeSelector";
import "../styles/topbar.css";

export function TopBar() {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
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
