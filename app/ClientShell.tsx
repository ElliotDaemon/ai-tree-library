// Client-side root that owns scene state + search/filter/list state.
// Single CommandBlob carries all controls; dynamic-imports the R3F scene.

"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import HeroOverlay from "./components/HeroOverlay";
import HoverTooltip from "./components/HoverTooltip";
import CommandBlob from "./components/CommandBlob";
import CreditBadge from "./components/CreditBadge";
import type { FilterState } from "./components/FilterBar";
import ListPopup from "./components/ListPopup";
import type { LayoutNode } from "./scene/Constellation";
import { trackNodeDive, trackFilterApply, trackFlightToggle, trackListOpen } from "../lib/track";

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

interface Props { library: LibraryFile | null; }

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

  const visibleIds = useMemo<Set<string> | null>(() => {
    if (!library) return null;
    if (filter.kind === "none") return null;
    const visible = new Set<string>();
    if (filter.kind === "category") {
      const top = library.categories.find((c) => c.id === filter.topLevelId);
      if (!top) return null;
      visible.add(top.id);
      const subIds = new Set<string>();
      for (const c of library.categories) {
        if (!c.isTopLevel && c.parentName === top.name) { visible.add(c.id); subIds.add(c.id); }
      }
      for (const e of library.entries) if (e.categoryId && subIds.has(e.categoryId)) visible.add(e.id);
    } else if (filter.kind === "rarity") {
      for (const n of library.layout.nodes) if (n.kind === "entry" && n.rarity === filter.rarity) visible.add(n.id);
      const parents = new Set<string>();
      for (const e of library.entries) if (visible.has(e.id) && e.categoryId) parents.add(e.categoryId);
      for (const c of library.categories) {
        if (parents.has(c.id)) {
          visible.add(c.id);
          if (!c.isTopLevel) {
            const top = library.categories.find((tc) => tc.isTopLevel && tc.name === c.parentName);
            if (top) visible.add(top.id);
          }
        }
      }
    } else if (filter.kind === "type") {
      for (const e of library.entries) if (e.type === filter.type) visible.add(e.id);
      const parents = new Set<string>();
      for (const e of library.entries) if (visible.has(e.id) && e.categoryId) parents.add(e.categoryId);
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

  const handleToggleFlight = useCallback(() => {
    setFlightMode((v) => {
      trackFlightToggle({ enabled: !v });
      return !v;
    });
  }, []);

  const handleDive = useCallback(
    (id: string, source: "constellation" | "search" | "list" | "related" = "constellation") => {
      setDiveTargetId(id);
      if (library) {
        const entry = library.entries.find((e) => e.id === id);
        const category = library.categories.find((c) => c.id === entry?.categoryId);
        const top = category?.isTopLevel
          ? category
          : library.categories.find((c) => c.isTopLevel && c.name === category?.parentName);
        const node = library.layout.nodes.find((n) => n.id === id);
        trackNodeDive({
          id,
          name: entry?.name ?? node?.name ?? id,
          kind: node?.kind ?? (entry ? "entry" : "unknown"),
          category: top?.name,
          rarity: node?.rarity ?? undefined,
          source,
        });
      }
    },
    [library]
  );

  const handleFilterChange = useCallback((f: FilterState) => {
    setFilter(f);
    if (f.kind === "category") trackFilterApply({ kind: "category", value: f.categoryName });
    else if (f.kind === "rarity") trackFilterApply({ kind: "rarity", value: f.rarity });
    else if (f.kind === "type") trackFilterApply({ kind: "type", value: f.type });
    else trackFilterApply({ kind: "clear", value: "" });
  }, []);

  const handleListOpen = useCallback(() => {
    setListOpen(true);
    trackListOpen();
  }, []);

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

      <HeroOverlay
        stats={library?.stats ?? null}
        uiVisible={uiVisible}
        flightMode={flightMode}
      />

      {library && uiVisible ? (
        <CommandBlob
          entries={library.entries}
          categories={library.categories}
          stats={library.stats}
          generatedAt={library.generatedAt}
          onHighlight={setHighlightIds}
          onDive={(id) => handleDive(id, "search")}
          onListOpen={handleListOpen}
          flightMode={flightMode}
          onToggleFlight={handleToggleFlight}
          filter={filter}
          onFilterChange={handleFilterChange}
        />
      ) : null}

      <HoverTooltip hoveredNode={hoveredNode} categoryNameById={categoryNameById} />

      <CreditBadge visible={uiVisible} />

      {library ? (
        <ListPopup
          open={listOpen}
          onClose={() => setListOpen(false)}
          entries={library.entries}
          categories={library.categories}
          onDive={(id) => handleDive(id, "list")}
        />
      ) : null}
    </>
  );
}
