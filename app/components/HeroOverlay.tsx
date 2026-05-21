// Floating overlay over the constellation: header, stats, center reticle,
// controls hint.

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
}

export default function HeroOverlay({ stats }: Props) {
  return (
    <>
      {/* Top-left brand */}
      <div className="ne-header">
        <h1 className="ne-title">
          <span className="ne-dot" />
          AI Tree Library
        </h1>
        <p className="ne-subtitle">A living network of AI tools, design inspo &amp; creative resources</p>
      </div>

      {/* Top-right stats */}
      {stats ? (
        <div className="ne-stats">
          <div className="ne-stat-line">
            <span className="ne-stat-value">{stats.entries}</span> <span className="ne-stat-label">nodes</span>
          </div>
          <div className="ne-stat-line">
            <span className="ne-stat-value">{stats.topLevel}</span> <span className="ne-stat-label">categories</span>
          </div>
          <div className="ne-stat-line">
            <span className="ne-stat-value">{stats.gems}</span> <span className="ne-stat-label">gems</span>
            <span className="ne-stat-sep">·</span>
            <span className="ne-stat-value">{stats.featured}</span> <span className="ne-stat-label">featured</span>
          </div>
        </div>
      ) : (
        <div className="ne-stats ne-stats-warn">library.json not generated yet</div>
      )}

      {/* Center reticle */}
      <div className="ne-reticle" aria-hidden>
        <div className="ne-reticle-dot" />
      </div>

      {/* Bottom hint */}
      <div className="ne-controls-hint">
        <span className="ne-key">W</span><span className="ne-key">A</span><span className="ne-key">S</span><span className="ne-key">D</span> MOVE
        &nbsp;·&nbsp;
        <span className="ne-key">R</span><span className="ne-key">F</span> UP/DOWN
        &nbsp;·&nbsp;
        DRAG TO LOOK
        &nbsp;·&nbsp;
        SCROLL/PINCH TO BOOST
        &nbsp;·&nbsp;
        AUTO-LOCKS TO NEAREST
        &nbsp;·&nbsp;
        CLICK TO OPEN
      </div>

      {/* Empty-state center card */}
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
