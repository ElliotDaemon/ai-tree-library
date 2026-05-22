// Client-side root that owns scene state + search/filter/list-popup state,
// and dynamic-imports the R3F scene (Next.js 16 requires ssr:false inside a
// client boundary).

"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import HeroOverlay from "./components/HeroOverlay";
import HoverTooltip from "./components/HoverTooltip";
import SearchBar from "./components/SearchBar";
import FilterBar, { type FilterState } from "./components/FilterBar";
import ListPopup from "./components/ListPopup";
import type { LayoutNode } from "./scene/Constellation";

const Scene = dynamic(() => import("./scene/Scene"), { ssr: false });

interface LibraryFile {
  generatedAt: string;
  stats: {
    categories: number;
    topLevel: number;
    entries: number;
    featured: number;
    gems: number;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    parentName: string;
    isTopLevel: boolean;
    displayOrder: number;
    v1ToolCount: number;
  }>;
  entries: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    description: string;
    categoryId: string | null;
    tags: string[];
    pricing: string;
    featured: boolean;
    gem: boolean;
    logoUrl: string;
    screenshotUrl: string;
    source: string;
  }>;
  layout: { nodes: LayoutNode[]; links: Array<{ source: string; target: string; kind: string }> };
}

interface Props {
  library: LibraryFile | null;
}

export default function ClientShell({ library }: Props) {
  const [flightMode, setFlightMode] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string> | null>(null);
  const [filter, setFilter] = useState<FilterState>({ kind: "none" });
  const [listOpen, setListOpen] = useState(false);
  const [diveTargetId, setDiveTargetId] = useState<string | null>(null);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    if (library) for (const c of library.categories) m.set(c.id, c.name);
    return m;
  }, [library]);

  // Compute the active filter's "visible IDs" set (or null = show all).
  // For category filter: includes the top-level cat itself, all its subcats,
  //   and all entries whose categoryId is one of those subcats.
  const visibleIds = useMemo<Set<string> | null>(() => {
    if (!library) return null;
    if (filter.kind === "none") return null;

    const visible = new Set<string>();
    if (filter.kind === "category") {
      const topId = filter.topLevelId;
      const top = library.categories.find((c) => c.id === topId);
      if (!top) return null;
      visible.add(topId);
      const subIds = new Set<string>();
      for (const c of library.categories) {
        if (!c.isTopLevel && c.parentName === top.name) {
          visible.add(c.id);
          subIds.add(c.id);
        }
      }
      for (const e of library.entries) {
        if (e.categoryId && subIds.has(e.categoryId)) visible.add(e.id);
      }
    } else if (filter.kind === "rarity") {
      // Entries with this rarity tier (computed in layout)
      for (const n of library.layout.nodes) {
        if (n.kind === "entry" && n.rarity === filter.rarity) visible.add(n.id);
      }
      // Also include their parent categories so the spine is preserved
      const entryParents = new Set<string>();
      for (const e of library.entries) {
        if (visible.has(e.id) && e.categoryId) entryParents.add(e.categoryId);
      }
      for (const c of library.categories) {
        if (entryParents.has(c.id)) {
          visible.add(c.id);
          if (!c.isTopLevel) {
            // Also add top-level parent
            const top = library.categories.find((tc) => tc.isTopLevel && tc.name === c.parentName);
            if (top) visible.add(top.id);
          }
        }
      }
    } else if (filter.kind === "type") {
      for (const e of library.entries) {
        if (e.type === filter.type) visible.add(e.id);
      }
      const parents = new Set<string>();
      for (const e of library.entries) {
        if (visible.has(e.id) && e.categoryId) parents.add(e.categoryId);
      }
      for (const c of library.categories) {
        if (parents.has(c.id)) {
          visible.add(c.id);
          if (!c.isTopLevel) {
            const top = library.categories.find((tc) => tc.isTopLevel && tc.name === c.parentName);
            if (top) visible.add(top.id);
          }
        }
      }
    }
    return visible;
  }, [filter, library]);

  const handleToggleFlight = useCallback(() => setFlightMode((v) => !v), []);
  const handleDive = useCallback((id: string) => { setDiveTargetId(id); }, []);

  return (
    <>
      {library ? (
        <Scene
          library={library}
          flightMode={flightMode}
          onUiVisibilityChange={setUiVisible}
          onHoverNodeChange={setHoveredNode}
          visibleIds={visibleIds}
          highlightIds={highlightIds}
          diveTargetId={diveTargetId}
          onDiveConsumed={() => setDiveTargetId(null)}
        />
      ) : null}

      {library && uiVisible ? (
        <div className="ne-topbar">
          <SearchBar
            entries={library.entries}
            categories={library.categories}
            onHighlight={setHighlightIds}
            onDive={handleDive}
            onListOpen={() => setListOpen(true)}
          />
          <FilterBar
            categories={library.categories}
            filter={filter}
            onChange={setFilter}
          />
        </div>
      ) : null}

      <HeroOverlay
        stats={library?.stats ?? null}
        uiVisible={uiVisible}
        flightMode={flightMode}
        onToggleFlight={handleToggleFlight}
        hoveredNode={hoveredNode}
      />
      <HoverTooltip hoveredNode={hoveredNode} categoryNameById={categoryNameById} />

      {library ? (
        <ListPopup
          open={listOpen}
          onClose={() => setListOpen(false)}
          entries={library.entries}
          categories={library.categories}
          onDive={handleDive}
        />
      ) : null}
    </>
  );
}
