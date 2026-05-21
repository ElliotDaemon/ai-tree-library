// Client-side root that owns flight mode + UI visibility + hover state,
// and dynamic-imports the R3F scene (Next.js 16 requires ssr:false inside a
// client boundary).

"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import HeroOverlay from "./components/HeroOverlay";
import HoverTooltip from "./components/HoverTooltip";
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

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    if (library) for (const c of library.categories) m.set(c.id, c.name);
    return m;
  }, [library]);

  const handleToggleFlight = useCallback(() => setFlightMode((v) => !v), []);

  return (
    <>
      {library ? (
        <Scene
          library={library}
          flightMode={flightMode}
          onUiVisibilityChange={setUiVisible}
          onHoverNodeChange={setHoveredNode}
        />
      ) : null}
      <HeroOverlay
        stats={library?.stats ?? null}
        uiVisible={uiVisible}
        flightMode={flightMode}
        onToggleFlight={handleToggleFlight}
        hoveredNode={hoveredNode}
      />
      <HoverTooltip hoveredNode={hoveredNode} categoryNameById={categoryNameById} />
    </>
  );
}
