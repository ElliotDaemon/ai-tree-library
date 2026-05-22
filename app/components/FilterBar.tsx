// Filter pills below the search bar.
//   - All / Category / Rarity / Type
//   - When a filter is active, only matching nodes appear in the constellation.

"use client";

import { useMemo, useState } from "react";

interface Category { id: string; name: string; isTopLevel: boolean; color: string; }

export type FilterState =
  | { kind: "none" }
  | { kind: "category"; topLevelId: string; categoryName: string; color: string }
  | { kind: "rarity"; rarity: "legendary" | "established" | "rare" | "gem" }
  | { kind: "type"; type: "Tool" | "Website" | "Inspiration" | "Resource" };

interface Props {
  categories: Category[];
  filter: FilterState;
  onChange: (f: FilterState) => void;
}

const RARITIES: Array<{ k: "legendary" | "established" | "rare" | "gem"; label: string }> = [
  { k: "legendary", label: "👑 Legendary" },
  { k: "established", label: "⭐ Established" },
  { k: "rare", label: "💎 Rare" },
  { k: "gem", label: "🌟 Hidden Gem" },
];

const TYPES: Array<"Tool" | "Website" | "Inspiration" | "Resource"> = ["Tool", "Website", "Inspiration", "Resource"];

export default function FilterBar({ categories, filter, onChange }: Props) {
  const [openMenu, setOpenMenu] = useState<"category" | "rarity" | "type" | null>(null);
  const topLevel = useMemo(() => categories.filter((c) => c.isTopLevel), [categories]);

  const label =
    filter.kind === "category" ? filter.categoryName :
    filter.kind === "rarity" ? RARITIES.find(r => r.k === filter.rarity)?.label ?? filter.rarity :
    filter.kind === "type" ? filter.type :
    "All nodes";

  return (
    <div className="ne-filter">
      <button
        className={`ne-filter-pill ${filter.kind === "none" ? "active" : ""}`}
        onClick={() => { onChange({ kind: "none" }); setOpenMenu(null); }}
      >All</button>

      <div className="ne-filter-dropdown-wrap">
        <button
          className={`ne-filter-pill ${filter.kind === "category" ? "active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "category" ? null : "category")}
        >Category {filter.kind === "category" ? "·" : "▾"}</button>
        {openMenu === "category" ? (
          <div className="ne-filter-menu">
            {topLevel.map((c) => (
              <button
                key={c.id}
                className="ne-filter-menu-item"
                onClick={() => { onChange({ kind: "category", topLevelId: c.id, categoryName: c.name, color: c.color }); setOpenMenu(null); }}
              >
                <span className="ne-filter-dot" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ne-filter-dropdown-wrap">
        <button
          className={`ne-filter-pill ${filter.kind === "rarity" ? "active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "rarity" ? null : "rarity")}
        >Rarity {filter.kind === "rarity" ? "·" : "▾"}</button>
        {openMenu === "rarity" ? (
          <div className="ne-filter-menu">
            {RARITIES.map((r) => (
              <button
                key={r.k}
                className="ne-filter-menu-item"
                onClick={() => { onChange({ kind: "rarity", rarity: r.k }); setOpenMenu(null); }}
              >{r.label}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ne-filter-dropdown-wrap">
        <button
          className={`ne-filter-pill ${filter.kind === "type" ? "active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}
        >Type {filter.kind === "type" ? "·" : "▾"}</button>
        {openMenu === "type" ? (
          <div className="ne-filter-menu">
            {TYPES.map((t) => (
              <button
                key={t}
                className="ne-filter-menu-item"
                onClick={() => { onChange({ kind: "type", type: t }); setOpenMenu(null); }}
              >{t}</button>
            ))}
          </div>
        ) : null}
      </div>

      {filter.kind !== "none" ? (
        <span className="ne-filter-active-label">{label}</span>
      ) : null}
    </div>
  );
}
