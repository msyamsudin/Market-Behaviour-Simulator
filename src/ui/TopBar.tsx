import { IndicatorSelector } from "./IndicatorSelector";
import { PaneSelector } from "./PaneSelector";
import { PlaybackControls } from "./PlaybackControls";
import { SessionBadge } from "./SessionBadge";

import { TimeframeSelector } from "./TimeframeSelector";
import type { SideDrawerTab } from "./SideDrawer";

interface TopBarProps {
  drawerOpen: boolean;
  activeTab: SideDrawerTab;
  onToggleDrawer: (tab: SideDrawerTab) => void;
}

export function TopBar({ drawerOpen, activeTab, onToggleDrawer }: TopBarProps) {
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
        <SessionBadge />
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
        <div className="topbar-divider" />
        <div className="drawer-toggles">
          <button
            className={`topbar-btn ${drawerOpen && activeTab === "components" ? "active" : ""}`}
            onClick={() => onToggleDrawer("components")}
            title="Toggle Generator Dynamics Config"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Generator
          </button>
          <button
            className={`topbar-btn ${drawerOpen && activeTab === "stats" ? "active" : ""}`}
            onClick={() => onToggleDrawer("stats")}
            title="Toggle Market Statistics"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </button>
        </div>
      </div>
    </header>
  );
}
