import { ComponentPanel } from "./ComponentPanel";
import { StatisticsPanel } from "./StatisticsPanel";

export type SideDrawerTab = "components" | "stats";

interface SideDrawerProps {
  isOpen: boolean;
  activeTab: SideDrawerTab;
  onSelectTab: (tab: SideDrawerTab) => void;
  onClose: () => void;
}

export function SideDrawer({ isOpen, activeTab, onSelectTab, onClose }: SideDrawerProps) {
  if (!isOpen) return null;

  return (
    <aside className="side-drawer" aria-label="Control Panel Drawer">
      <div className="drawer-header">
        <div className="drawer-tabs">
          <button
            className={`drawer-tab-btn ${activeTab === "components" ? "active" : ""}`}
            onClick={() => onSelectTab("components")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Dynamics
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => onSelectTab("stats")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </button>
        </div>

        <button className="drawer-close-btn" onClick={onClose} title="Close Drawer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="drawer-body">
        {activeTab === "components" && <ComponentPanel />}
        {activeTab === "stats" && <StatisticsPanel />}
      </div>
    </aside>
  );
}
