// Right-side data panel shown when diving into a node.
// Matches the Gemini reference: cat badge, large title, description,
// related sub-items (clickable to dive into them), back button.

"use client";

import type { DivedNode } from "../scene/Scene";
import type { LayoutNode } from "../scene/Constellation";
import { trackLinkClick } from "../../lib/track";

interface Library {
  entries: Array<{
    id: string;
    name: string;
    url: string;
    description: string;
    categoryId: string | null;
    tags: string[];
    pricing: string;
    featured: boolean;
    gem: boolean;
    logoUrl: string;
    source: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    isTopLevel: boolean;
    parentName?: string;
  }>;
  layout: { nodes: LayoutNode[]; links: unknown[] };
}

interface Props {
  divedData: DivedNode;
  library: Library;
  onBack: () => void;
  onSelectRelated: (id: string) => void;
}

export default function DataPanel({ divedData, library, onBack, onSelectRelated }: Props) {
  const { node, entry, category } = divedData;
  const accent = category?.color || node.rawColor || "#00f3ff";

  // Build a "related items" list scoped to the node's kind
  type Related = { id: string; name: string; subtitle?: string };
  let relatedTitle = "";
  let related: Related[] = [];

  if (node.kind === "category") {
    // List subcategories under this top-level category
    relatedTitle = "Subcategories";
    const cat = library.categories.find((c) => c.id === node.id);
    if (cat) {
      related = library.categories
        .filter((c) => !c.isTopLevel && c.parentName === cat.name)
        .map((c) => ({ id: c.id, name: c.name }));
    }
  } else if (node.kind === "subcategory") {
    // List entries in this subcategory
    relatedTitle = "Tools in this category";
    related = library.entries
      .filter((e) => e.categoryId === node.id)
      .map((e) => ({ id: e.id, name: e.name, subtitle: e.pricing }));
  } else if (node.kind === "entry" && entry) {
    // Sibling tools in the same subcategory
    relatedTitle = "Related tools";
    related = library.entries
      .filter((e) => e.categoryId === entry.categoryId && e.id !== entry.id)
      .slice(0, 12)
      .map((e) => ({ id: e.id, name: e.name, subtitle: e.pricing }));
  }

  const title = node.name || entry?.name || "Untitled";
  const description = entry?.description || (node.kind === "category" ? "A constellation branch of the AI Tree Library." : node.kind === "subcategory" ? "A cluster of related tools." : "");

  return (
    <aside
      className="ne-panel active"
      style={{ borderLeftColor: accent }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        <div className="ne-panel-header">
          <div className="ne-panel-badge" style={{ borderColor: accent, color: accent }}>
            {category?.name ?? (node.kind === "category" ? "Category" : node.kind === "subcategory" ? "Subcategory" : "Tool")}
          </div>
          <h2 className="ne-panel-title">{title}</h2>
        </div>

        {description ? (
          <p className="ne-panel-desc">{description}</p>
        ) : null}

        {entry ? (
          <div className="ne-panel-pills">
            {entry.featured ? <span className="ne-pill ne-pill-featured">Featured</span> : null}
            {entry.gem ? <span className="ne-pill ne-pill-gem">✨ Gem</span> : null}
            {entry.pricing ? <span className="ne-pill">{entry.pricing}</span> : null}
            {entry.tags.map((t) => <span key={t} className="ne-pill">{t}</span>)}
          </div>
        ) : null}

        {entry?.url ? (
          <a
            className="ne-panel-link"
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ borderColor: accent, color: accent }}
            onClick={() => trackLinkClick({ name: entry.name, destination: entry.url, source: "data_panel" })}
          >
            Open {entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
          </a>
        ) : null}

        {entry?.source ? (
          <div className="ne-panel-source">Submitted by {entry.source}</div>
        ) : null}

        {related.length > 0 ? (
          <>
            <div className="ne-panel-related-title">{relatedTitle}</div>
            <ul className="ne-panel-list">
              {related.map((r) => (
                <li key={r.id} onClick={() => onSelectRelated(r.id)} role="button" tabIndex={0}>
                  <div>
                    <div className="ne-panel-list-name">{r.name}</div>
                    {r.subtitle ? <div className="ne-panel-list-sub">{r.subtitle}</div> : null}
                  </div>
                  <span className="ne-panel-list-arrow">›</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <button className="ne-btn-back" onClick={onBack} style={{ borderColor: accent, color: accent }}>
        Initialize Orbit Return
      </button>
    </aside>
  );
}
