// Liquid-glass search bar.
// Fuse.js fuzzy match across name + description + tags + category name.
// Keyboard: "/" focuses, Esc clears, ↑/↓ navigates results, Enter dives.
// Hover/highlight matching nodes in the scene in real time.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";

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

interface Props {
  entries: Entry[];
  categories: Category[];
  onHighlight: (ids: Set<string> | null) => void;
  onDive: (id: string) => void;
  onListOpen: () => void;
}

interface SearchableItem {
  id: string;
  name: string;
  description: string;
  tagsJoined: string;
  categoryName: string;
  kind: "entry" | "category";
  color: string;
  rarity?: string;
  pricing?: string;
}

export default function SearchBar({ entries, categories, onHighlight, onDive, onListOpen }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const items: SearchableItem[] = useMemo(() => {
    const out: SearchableItem[] = [];
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
    if (!query.trim()) return [] as { item: SearchableItem; score?: number }[];
    return fuse.search(query.trim()).slice(0, 12);
  }, [query, fuse]);

  // Push highlight set to parent
  useEffect(() => {
    if (!query.trim() || results.length === 0) {
      onHighlight(null);
      return;
    }
    onHighlight(new Set(results.map((r) => r.item.id)));
  }, [query, results, onHighlight]);

  // Global keyboard: "/" focuses
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset selection on new results
  useEffect(() => setSelectedIdx(0), [query]);

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
    }
  };

  return (
    <div className="ne-search">
      <div className="ne-search-input-wrap">
        <span className="ne-search-icon">⌕</span>
        <input
          ref={inputRef}
          className="ne-search-input"
          placeholder="Search nodes…  /"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onInputKey}
          aria-label="Search library"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            className="ne-search-clear"
            onClick={() => { setQuery(""); onHighlight(null); }}
            aria-label="Clear"
          >×</button>
        ) : null}
        <button className="ne-search-list" onClick={onListOpen} title="Open list view">☰</button>
      </div>

      {focused && results.length > 0 ? (
        <div className="ne-search-results">
          {results.map((r, i) => (
            <button
              key={r.item.id}
              className={`ne-search-result ${i === selectedIdx ? "selected" : ""}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); onDive(r.item.id); setQuery(""); onHighlight(null); inputRef.current?.blur(); }}
            >
              <span className="ne-search-result-dot" style={{ background: r.item.color }} />
              <span className="ne-search-result-body">
                <span className="ne-search-result-name">{r.item.name}</span>
                {r.item.categoryName ? <span className="ne-search-result-meta">{r.item.categoryName}</span> : null}
              </span>
              <span className="ne-search-result-kind">{r.item.kind === "category" ? "CAT" : "TOOL"}</span>
            </button>
          ))}
        </div>
      ) : null}

      {focused && query.trim() && results.length === 0 ? (
        <div className="ne-search-results ne-search-results-empty">No matches.</div>
      ) : null}
    </div>
  );
}
