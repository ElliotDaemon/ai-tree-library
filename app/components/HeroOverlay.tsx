// Minimal corner mark. No more giant title — just a pulsing dot + thin
// uppercase wordmark in the top-left. Stats live inside the CommandBlob.

"use client";

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
}

export default function HeroOverlay({ stats, uiVisible, flightMode }: Props) {
  return (
    <>
      {/* Top-left wordmark — small, refined */}
      <div className={`ne-mark ${uiVisible ? "" : "ne-hidden"}`}>
        <span className="ne-mark-dot" />
        <span className="ne-mark-text">AI Tree Library</span>
      </div>

      {/* Bottom hint (subtle, contextual) */}
      <div className={`ne-hint ${uiVisible ? "" : "ne-hidden"}`}>
        {flightMode ? (
          <>
            <span className="ne-key">W</span><span className="ne-key">A</span><span className="ne-key">S</span><span className="ne-key">D</span> THRUST
            <span className="ne-hint-sep">·</span>
            MOUSE STEER
            <span className="ne-hint-sep">·</span>
            <span className="ne-key">ESC</span> EXIT
          </>
        ) : (
          <>
            DRAG TO ROTATE
            <span className="ne-hint-sep">·</span>
            SCROLL TO ZOOM
            <span className="ne-hint-sep">·</span>
            CLICK A GLOWING NODE TO DIVE
          </>
        )}
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
