// Liquid-glass full-library list popup.
// Grouped by category by default; toggle to alphabetical sort.
// Filtered live by search query. Click row → dive to that node.

"use client";

import { useEffect, useMemo, useState } from "react";

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
  logoUrl?: string;
}

interface Category {
  id: string;
  name: string;
  isTopLevel: boolean;
  parentName?: string;
  color: string;
  displayOrder?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entries: Entry[];
  categories: Category[];
  onDive: (id: string) => void;
}

export default function ListPopup({ open, onClose, entries, categories, onDive }: Props) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"category" | "alphabetic">("category");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const subById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const topLevel = useMemo(() => categories.filter((c) => c.isTopLevel).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)), [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      if (e.description.toLowerCase().includes(q)) return true;
      if (e.tags.some((t) => t.toLowerCase().includes(q))) return true;
      const cat = e.categoryId ? subById.get(e.categoryId) : undefined;
      if (cat && cat.name.toLowerCase().includes(q)) return true;
      if (cat && cat.parentName && cat.parentName.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [query, entries, subById]);

  // Group by top-level category (or single bucket for alphabetic)
  const groups = useMemo(() => {
    if (sortMode === "alphabetic") {
      return [{ title: "All", color: "#00f3ff", items: [...filtered].sort((a, b) => a.name.localeCompare(b.name)) }];
    }
    const byTop = new Map<string, Entry[]>();
    for (const e of filtered) {
      const sub = e.categoryId ? subById.get(e.categoryId) : undefined;
      const topName = sub?.parentName || "(uncategorized)";
      if (!byTop.has(topName)) byTop.set(topName, []);
      byTop.get(topName)!.push(e);
    }
    // Order by topLevel.displayOrder
    return topLevel.map((c) => ({
      title: c.name,
      color: c.color,
      items: (byTop.get(c.name) || []).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.items.length > 0);
  }, [filtered, sortMode, subById, topLevel]);

  if (!open) return null;

  return (
    <div className="ne-listpop-backdrop" onClick={onClose}>
      <div className="ne-listpop" onClick={(e) => e.stopPropagation()}>
        <div className="ne-listpop-header">
          <input
            className="ne-listpop-search"
            placeholder="Filter the library…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Filter list"
          />
          <div className="ne-listpop-controls">
            <button
              className={`ne-listpop-sort ${sortMode === "category" ? "active" : ""}`}
              onClick={() => setSortMode("category")}
            >By Category</button>
            <button
              className={`ne-listpop-sort ${sortMode === "alphabetic" ? "active" : ""}`}
              onClick={() => setSortMode("alphabetic")}
            >A → Z</button>
            <button className="ne-listpop-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="ne-listpop-meta">
          {filtered.length} of {entries.length} nodes shown
        </div>

        <div className="ne-listpop-body">
          {groups.length === 0 ? (
            <div className="ne-listpop-empty">No matches for "{query}".</div>
          ) : groups.map((g) => (
            <div key={g.title} className="ne-listpop-group">
              <div className="ne-listpop-group-title" style={{ borderLeftColor: g.color, color: g.color }}>
                {g.title} <span className="ne-listpop-group-count">{g.items.length}</span>
              </div>
              <div className="ne-listpop-group-items">
                {g.items.map((e) => {
                  const cat = e.categoryId ? subById.get(e.categoryId) : undefined;
                  return (
                    <button
                      key={e.id}
                      className="ne-listpop-row"
                      onClick={() => { onDive(e.id); onClose(); }}
                    >
                      <div className="ne-listpop-row-main">
                        <div className="ne-listpop-row-name">{e.name}</div>
                        {e.description ? <div className="ne-listpop-row-desc">{e.description.slice(0, 110)}{e.description.length > 110 ? "…" : ""}</div> : null}
                      </div>
                      <div className="ne-listpop-row-meta">
                        {cat ? <span className="ne-listpop-row-cat">{cat.name}</span> : null}
                        {e.featured ? <span className="ne-listpop-row-tag tag-featured">Featured</span> : null}
                        {e.gem ? <span className="ne-listpop-row-tag tag-gem">Gem</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
