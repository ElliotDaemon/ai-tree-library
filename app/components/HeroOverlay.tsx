// Top-left: tree logo + title + slogan.
// Top-right: live stats card (auto-refreshed from library.json each build).
// Bottom-center: subtle contextual hint.

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

function TreeLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {/* Branches */}
      <line x1="16" y1="29" x2="16" y2="14" opacity="0.6" />
      <line x1="16" y1="20" x2="9" y2="13" opacity="0.55" />
      <line x1="16" y1="20" x2="23" y2="13" opacity="0.55" />
      <line x1="16" y1="14" x2="11" y2="8" opacity="0.45" />
      <line x1="16" y1="14" x2="21" y2="8" opacity="0.45" />
      <line x1="11" y1="8" x2="8" y2="4" opacity="0.35" />
      <line x1="21" y1="8" x2="24" y2="4" opacity="0.35" />
      {/* Nodes (leaves) */}
      <circle cx="16" cy="14" r="1.4" fill="currentColor" opacity="0.95" />
      <circle cx="16" cy="20" r="1.2" fill="currentColor" opacity="0.85" />
      <circle cx="9" cy="13" r="1.3" fill="currentColor" opacity="0.85" />
      <circle cx="23" cy="13" r="1.3" fill="currentColor" opacity="0.85" />
      <circle cx="11" cy="8" r="1.1" fill="currentColor" opacity="0.75" />
      <circle cx="21" cy="8" r="1.1" fill="currentColor" opacity="0.75" />
      <circle cx="8" cy="4" r="0.9" fill="currentColor" opacity="0.65" />
      <circle cx="24" cy="4" r="0.9" fill="currentColor" opacity="0.65" />
      {/* Crown leaf */}
      <circle cx="16" cy="3.5" r="1.5" fill="currentColor" opacity="1" />
    </svg>
  );
}

export default function HeroOverlay({ stats, uiVisible, flightMode }: Props) {
  return (
    <>
      {/* Top-left: tree logo + title + slogan */}
      <div className={`ne-brand ${uiVisible ? "" : "ne-hidden"}`}>
        <div className="ne-brand-logo">
          <TreeLogo size={40} />
        </div>
        <div className="ne-brand-text">
          <div className="ne-brand-title">AI Tree Library</div>
          <div className="ne-brand-slogan">A living constellation of curated AI tools, design inspo &amp; creative resources</div>
        </div>
      </div>

      {/* Top-right: stats (live from library.json) */}
      {stats ? (
        <div className={`ne-stats-card ${uiVisible ? "" : "ne-hidden"}`}>
          <div className="ne-stats-row">
            <span className="ne-stats-num">{stats.entries}</span>
            <span className="ne-stats-label">tools &amp; websites</span>
          </div>
          <div className="ne-stats-row">
            <span className="ne-stats-num">{stats.topLevel}</span>
            <span className="ne-stats-label">categories</span>
            <span className="ne-stats-sep">·</span>
            <span className="ne-stats-num">{Math.max(0, stats.categories - stats.topLevel)}</span>
            <span className="ne-stats-label">subcategories</span>
          </div>
          <div className="ne-stats-row">
            <span className="ne-stats-num">{stats.gems}</span>
            <span className="ne-stats-label">gems</span>
            <span className="ne-stats-sep">·</span>
            <span className="ne-stats-num">{stats.featured}</span>
            <span className="ne-stats-label">featured</span>
          </div>
        </div>
      ) : null}

      {/* Bottom hint */}
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
