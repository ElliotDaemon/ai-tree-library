// Floating overlay: header, footer with spaceship toggle + hint, center crosshair.
// Header & footer hide during dive; crosshair shows only when hovering a node
// or in flight mode.

"use client";

import { useEffect } from "react";
import type { LayoutNode } from "../scene/Constellation";

interface Stats {
  categories: number;
  topLevel: number;
  entries: number;
  featured: number;
  gems: number;
}

interface Props {
  stats: Stats | null;
  uiVisible: boolean;
  flightMode: boolean;
  onToggleFlight: () => void;
  hoveredNode: LayoutNode | null;
}

export default function HeroOverlay({ stats, uiVisible, flightMode, onToggleFlight, hoveredNode }: Props) {
  // ESC to exit flight mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && flightMode) onToggleFlight();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flightMode, onToggleFlight]);

  return (
    <>
      <div className={`ne-header ${uiVisible ? "" : "ne-hidden-up"}`}>
        <h1 className="ne-title">
          <span className="ne-dot" />
          AI Tree Library
        </h1>
        <p className="ne-subtitle">A living network of AI tools, design inspo &amp; creative resources</p>
      </div>

      {stats ? (
        <div className={`ne-stats ${uiVisible ? "" : "ne-hidden-up"}`}>
          <div className="ne-stat-line"><span className="ne-stat-value">{stats.entries}</span> <span className="ne-stat-label">nodes</span></div>
          <div className="ne-stat-line"><span className="ne-stat-value">{stats.topLevel}</span> <span className="ne-stat-label">categories</span></div>
          <div className="ne-stat-line">
            <span className="ne-stat-value">{stats.gems}</span> <span className="ne-stat-label">gems</span>
            <span className="ne-stat-sep">·</span>
            <span className="ne-stat-value">{stats.featured}</span> <span className="ne-stat-label">featured</span>
          </div>
        </div>
      ) : (
        <div className={`ne-stats ne-stats-warn ${uiVisible ? "" : "ne-hidden-up"}`}>library.json not generated yet</div>
      )}

      {/* Center crosshair — shows on hover OR in flight mode */}
      <div className={`ne-crosshair ${hoveredNode || flightMode ? "active" : ""} ${flightMode ? "flight" : ""}`} aria-hidden>
        <span className="ne-crosshair-h" />
        <span className="ne-crosshair-v" />
      </div>

      <div className={`ne-footer ${uiVisible ? "" : "ne-hidden-down"}`}>
        <button
          className={`ne-ship-btn ${flightMode ? "active" : ""}`}
          onClick={onToggleFlight}
          title={flightMode ? "Exit free-flight (Esc)" : "Enter free-flight"}
          aria-label="Toggle free flight"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
        </button>
        <div className="ne-footer-hint">
          <div><strong>CLICK</strong> A GLOWING NODE TO DIVE DEEP</div>
          <div>
            {flightMode ? (
              <>
                <span className="ne-key">W</span><span className="ne-key">A</span><span className="ne-key">S</span><span className="ne-key">D</span> THRUST · MOUSE STEER · <span className="ne-key">ESC</span> EXIT
              </>
            ) : (
              <>DRAG TO ROTATE · SCROLL TO ZOOM</>
            )}
          </div>
        </div>
      </div>

      {!stats ? (
        <div className="ne-empty">
          <div className="ne-empty-card">
            <div className="ne-empty-title">Constellation not yet generated.</div>
            <div className="ne-empty-hint">Set NOTION_TOKEN in .env.local then run <code>npm run fetch-content</code></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
