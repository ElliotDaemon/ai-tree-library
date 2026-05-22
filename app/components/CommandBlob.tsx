// One liquid-glass blob at top-center holding all controls.
// Collapsed: a small pill with the pulsing dot + node count.
// Hover (or focus-within): morphs open to reveal search + filter pills +
// flight-mode toggle + list-view button + detailed stats.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import type { FilterState } from "./FilterBar";

interface Entry {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  pricing: string;
  featured: boolean;
  gem: boolean;
  type: string;
  url: string;
}

interface Category {
  id: string;
  name: string;
  isTopLevel: boolean;
  parentName?: string;
  color: string;
}

interface Stats {
  categories: number;
  topLevel: number;
  entries: number;
  featured: number;
  gems: number;
}

interface Props {
  entries: Entry[];
  categories: Category[];
  stats: Stats | null;
  generatedAt: string | null;
  onHighlight: (ids: Set<string> | null) => void;
  onDive: (id: string) => void;
  onListOpen: () => void;
  onSubmitOpen: () => void;
  flightMode: boolean;
  onToggleFlight: () => void;
  filter: FilterState;
  onFilterChange: (f: FilterState) => void;
}

interface SearchItem {
  id: string;
  name: string;
  description: string;
  tagsJoined: string;
  categoryName: string;
  kind: "entry" | "category";
  color: string;
  pricing?: string;
}

const RARITIES = [
  { k: "legendary" as const, label: "👑 Legendary" },
  { k: "established" as const, label: "⭐ Established" },
  { k: "rare" as const, label: "💎 Rare" },
  { k: "gem" as const, label: "🌟 Hidden Gem" },
];

const TYPES = ["Tool", "Website", "Inspiration", "Resource"] as const;

export default function CommandBlob({
  entries,
  categories,
  stats,
  generatedAt,
  onHighlight,
  onDive,
  onListOpen,
  onSubmitOpen,
  flightMode,
  onToggleFlight,
  filter,
  onFilterChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [openMenu, setOpenMenu] = useState<"category" | "rarity" | "type" | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blobRef = useRef<HTMLDivElement>(null);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const items: SearchItem[] = useMemo(() => {
    const out: SearchItem[] = [];
    for (const e of entries) {
      out.push({
        id: e.id,
        name: e.name,
        description: e.description,
        tagsJoined: e.tags.join(" "),
        categoryName: e.categoryId ? categoryNameById.get(e.categoryId) ?? "" : "",
        kind: "entry",
        color: "#00f3ff",
        pricing: e.pricing,
      });
    }
    for (const c of categories) {
      out.push({
        id: c.id,
        name: c.name,
        description: "",
        tagsJoined: "",
        categoryName: c.isTopLevel ? "" : c.parentName ?? "",
        kind: "category",
        color: c.color,
      });
    }
    return out;
  }, [entries, categories, categoryNameById]);

  const fuse = useMemo(() => new Fuse(items, {
    keys: [
      { name: "name", weight: 0.55 },
      { name: "description", weight: 0.2 },
      { name: "tagsJoined", weight: 0.15 },
      { name: "categoryName", weight: 0.1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  }), [items]);

  const results = useMemo(() => {
    if (!query.trim()) return [] as Array<{ item: SearchItem }>;
    return fuse.search(query.trim()).slice(0, 8);
  }, [query, fuse]);

  // Push highlight set to parent
  useEffect(() => {
    if (!query.trim() || results.length === 0) {
      onHighlight(null);
      return;
    }
    onHighlight(new Set(results.map((r) => r.item.id)));
  }, [query, results, onHighlight]);

  // Reset selection on new results
  useEffect(() => setSelectedIdx(0), [query]);

  // Global "/" focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === "Escape") {
        if (openMenu) { setOpenMenu(null); return; }
        if (query) { setQuery(""); onHighlight(null); return; }
        setExpanded(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu, query, onHighlight]);

  // Click outside to collapse
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!blobRef.current) return;
      if (!blobRef.current.contains(e.target as Node)) {
        if (!expanded) return;
        if (collapseTimer.current) clearTimeout(collapseTimer.current);
        setExpanded(false);
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [expanded]);

  const handleEnter = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const handleLeave = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (query || openMenu || document.activeElement === inputRef.current) return;
    collapseTimer.current = setTimeout(() => setExpanded(false), 600);
  };
  // Touch devices: hover never fires, so tap toggles. On the collapsed pill,
  // tapping anywhere on the core expands. The click-outside listener handles
  // collapsing back when the user taps elsewhere.
  const handleCoreClick = () => {
    if (!expanded) setExpanded(true);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      onHighlight(null);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      onDive(results[selectedIdx].item.id);
      setQuery("");
      onHighlight(null);
      inputRef.current?.blur();
      setExpanded(false);
    }
  };

  const topLevelCats = useMemo(() => categories.filter((c) => c.isTopLevel), [categories]);
  const activeFilterLabel =
    filter.kind === "category" ? filter.categoryName :
    filter.kind === "rarity" ? RARITIES.find((r) => r.k === filter.rarity)?.label ?? filter.rarity :
    filter.kind === "type" ? filter.type :
    null;

  // Format last-updated as relative time
  const updatedLabel = useMemo(() => {
    if (!generatedAt) return null;
    try {
      const then = new Date(generatedAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - then);
      const min = Math.floor(diff / 60000);
      if (min < 1) return "just now";
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const days = Math.floor(hr / 24);
      return `${days}d ago`;
    } catch {
      return null;
    }
  }, [generatedAt]);

  return (
    <div
      ref={blobRef}
      className={`ne-blob ${expanded ? "expanded" : "collapsed"}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocusCapture={handleEnter}
    >
      {/* Collapsed-state core: always visible. Tap to expand on touch. */}
      <div className="ne-blob-core" onClick={handleCoreClick} role="button" tabIndex={0}>
        <span className="ne-blob-pulse" />
        <span className="ne-blob-count">
          <span className="ne-blob-num">{stats?.entries ?? 0}</span>
          <span className="ne-blob-unit">nodes</span>
        </span>
        <span className="ne-blob-sep">·</span>
        <span className="ne-blob-count">
          <span className="ne-blob-num">{stats?.topLevel ?? 0}</span>
          <span className="ne-blob-unit">cats</span>
        </span>
        <span className="ne-blob-hint">{expanded ? "" : "tap to search & filter  /"}</span>
      </div>

      {/* Expanded state */}
      <div className="ne-blob-expanded" aria-hidden={!expanded}>
        {/* Row 1: Search */}
        <div className="ne-blob-search">
          <span className="ne-blob-search-icon">⌕</span>
          <input
            ref={inputRef}
            className="ne-blob-search-input"
            placeholder="Search nodes…  /"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            spellCheck={false}
            autoComplete="off"
            tabIndex={expanded ? 0 : -1}
          />
          {query ? (
            <button className="ne-blob-btn-icon" onClick={() => { setQuery(""); onHighlight(null); }} aria-label="Clear">×</button>
          ) : null}
          <span className="ne-blob-divider" />
          <button
            className={`ne-blob-btn-icon ${flightMode ? "active" : ""}`}
            onClick={onToggleFlight}
            title={flightMode ? "Exit free-flight (Esc)" : "Enter free-flight"}
            tabIndex={expanded ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
            </svg>
          </button>
          <button
            className="ne-blob-btn-icon"
            onClick={onListOpen}
            title="Open list view"
            tabIndex={expanded ? 0 : -1}
          >☰</button>
        </div>

        {/* Row 2: Filter pills */}
        <div className="ne-blob-filters">
          <button
            className={`ne-blob-pill ${filter.kind === "none" ? "active" : ""}`}
            onClick={() => { onFilterChange({ kind: "none" }); setOpenMenu(null); }}
            tabIndex={expanded ? 0 : -1}
          >All</button>

          <div className="ne-blob-pill-wrap">
            <button
              className={`ne-blob-pill ${filter.kind === "category" ? "active" : ""}`}
              onClick={() => setOpenMenu(openMenu === "category" ? null : "category")}
              tabIndex={expanded ? 0 : -1}
            >Category {filter.kind === "category" ? "·" : "▾"}</button>
            {openMenu === "category" ? (
              <div className="ne-blob-menu">
                {topLevelCats.map((c) => (
                  <button
                    key={c.id}
                    className="ne-blob-menu-item"
                    onClick={() => { onFilterChange({ kind: "category", topLevelId: c.id, categoryName: c.name, color: c.color }); setOpenMenu(null); }}
                  >
                    <span className="ne-blob-menu-dot" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ne-blob-pill-wrap">
            <button
              className={`ne-blob-pill ${filter.kind === "rarity" ? "active" : ""}`}
              onClick={() => setOpenMenu(openMenu === "rarity" ? null : "rarity")}
              tabIndex={expanded ? 0 : -1}
            >Rarity {filter.kind === "rarity" ? "·" : "▾"}</button>
            {openMenu === "rarity" ? (
              <div className="ne-blob-menu">
                {RARITIES.map((r) => (
                  <button key={r.k} className="ne-blob-menu-item" onClick={() => { onFilterChange({ kind: "rarity", rarity: r.k }); setOpenMenu(null); }}>{r.label}</button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ne-blob-pill-wrap">
            <button
              className={`ne-blob-pill ${filter.kind === "type" ? "active" : ""}`}
              onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}
              tabIndex={expanded ? 0 : -1}
            >Type {filter.kind === "type" ? "·" : "▾"}</button>
            {openMenu === "type" ? (
              <div className="ne-blob-menu">
                {TYPES.map((t) => (
                  <button key={t} className="ne-blob-menu-item" onClick={() => { onFilterChange({ kind: "type", type: t }); setOpenMenu(null); }}>{t}</button>
                ))}
              </div>
            ) : null}
          </div>

          {activeFilterLabel ? (
            <span className="ne-blob-active-label">{activeFilterLabel}</span>
          ) : null}

          <button
            type="button"
            className="ne-blob-submit-btn"
            onClick={onSubmitOpen}
            tabIndex={expanded ? 0 : -1}
            title="Submit a new tool"
          >
            + Submit a tool
          </button>
        </div>

        {/* Row 3: Stat strip */}
        {stats ? (
          <div className="ne-blob-stats">
            <span><strong>{stats.entries}</strong> nodes</span>
            <span><strong>{stats.topLevel}</strong> categories</span>
            <span><strong>{stats.gems}</strong> gems</span>
            <span><strong>{stats.featured}</strong> featured</span>
            {updatedLabel ? <span className="ne-blob-stats-time">updated {updatedLabel}</span> : null}
          </div>
        ) : null}

        {/* Row 4: Search results dropdown (only when typing) */}
        {query.trim() ? (
          results.length > 0 ? (
            <div className="ne-blob-results">
              {results.map((r, i) => (
                <button
                  key={r.item.id}
                  className={`ne-blob-result ${i === selectedIdx ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); onDive(r.item.id); setQuery(""); onHighlight(null); inputRef.current?.blur(); setExpanded(false); }}
                >
                  <span className="ne-blob-result-dot" style={{ background: r.item.color }} />
                  <span className="ne-blob-result-body">
                    <span className="ne-blob-result-name">{r.item.name}</span>
                    {r.item.categoryName ? <span className="ne-blob-result-meta">{r.item.categoryName}</span> : null}
                  </span>
                  <span className="ne-blob-result-kind">{r.item.kind === "category" ? "CAT" : "TOOL"}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="ne-blob-results empty">No matches.</div>
          )
        ) : null}
      </div>
    </div>
  );
}
