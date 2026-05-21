// Screen-space tooltip that follows the cursor.
// Renders OUTSIDE the R3F canvas so it's always pixel-sized regardless of
// how far the camera is from the node. Falls back to invisible when nothing
// is hovered.

"use client";

import { useEffect, useState } from "react";
import type { LayoutNode } from "../scene/Constellation";

interface Props {
  hoveredNode: LayoutNode | null;
  categoryNameById: Map<string, string>;
}

export default function HoverTooltip({ hoveredNode, categoryNameById }: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  if (!hoveredNode || !hoveredNode.name) return null;

  // Resolve the category label
  let categoryLabel: string;
  if (hoveredNode.kind === "category") {
    categoryLabel = "Category";
  } else if (hoveredNode.kind === "subcategory") {
    const parentId = hoveredNode.parentId;
    categoryLabel = (parentId && categoryNameById.get(parentId)) || "Subcategory";
  } else {
    const parentId = hoveredNode.parentId;
    categoryLabel = (parentId && categoryNameById.get(parentId)) || "Tool";
  }

  const accent = hoveredNode.rawColor || "#00f3ff";

  return (
    <div
      className="ne-tooltip"
      style={{
        left: pos.x + 20,
        top: pos.y,
        borderLeftColor: accent,
      }}
    >
      <div className="ne-tooltip-cat" style={{ color: accent }}>{categoryLabel}</div>
      <div className="ne-tooltip-name">{hoveredNode.name}</div>
    </div>
  );
}
