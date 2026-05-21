// Floating overlay shown over the constellation.
// Shows title + tagline + tool count. Will gain search + category menu in next iteration.

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
      <div className="fixed top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          AI <span className="opacity-60">Tree</span> Library
        </h1>
        <p className="mt-1 text-xs text-white/40">
          A 3D constellation of curated AI tools, design inspo, and creative resources.
        </p>
      </div>

      {/* Top-right stats */}
      {stats ? (
        <div className="fixed top-6 right-6 z-10 pointer-events-none text-right text-xs text-white/40">
          <div>{stats.entries} entries</div>
          <div>{stats.topLevel} categories</div>
          <div>{stats.gems} gems · {stats.featured} featured</div>
        </div>
      ) : (
        <div className="fixed top-6 right-6 z-10 pointer-events-none text-right text-xs text-amber-400/70">
          library.json not generated yet — run `npm run fetch-content`
        </div>
      )}

      {/* Empty-state placeholder */}
      {!stats ? (
        <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="glass-panel px-8 py-6 max-w-sm text-center">
            <div className="text-sm text-white/60 mb-2">Constellation not yet generated.</div>
            <div className="text-xs text-white/40 font-mono">
              Set NOTION_TOKEN in .env.local<br />
              then run `npm run fetch-content`
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
