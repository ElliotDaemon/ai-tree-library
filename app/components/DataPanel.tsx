// Right-side data panel shown when diving into a node.
//
// Improvements per user request ("interconnection — some related things
// aren't clickable, not detailed enough"):
//   - Category badge is now a Link to /category/[topLevelSlug] (read-more)
//   - Tags are Links to /tag/[slug] for cross-category discovery
//   - Entry dives surface a "View full page ↗" link to /[entry.slug] so the
//     user can leave the 3D for the rich text page
//   - Related items now show a color dot + rarity icon + short description
//     snippet so the list reads like a curated catalog rather than just names
//
// In-scene "related" clicks still trigger onSelectRelated (dive deeper)
// rather than navigation — keeps the 3D constellation as the home base.

"use client";

import Link from "next/link";
import type { DivedNode } from "../scene/Scene";
import type { LayoutNode } from "../scene/Constellation";
import { slugify } from "../../lib/slug";
import { trackLinkClick } from "../../lib/track";

interface Entry {
  id: string;
  name: string;
  url: string;
  slug?: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  pricing: string;
  featured: boolean;
  gem: boolean;
  logoUrl: string;
  source: string;
}

interface Library {
  entries: Entry[];
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

const RARITY_ICON: Record<string, string> = {
  legendary: "👑",
  established: "⭐",
  rare: "💎",
  gem: "🌟",
};

function rarityIconOf(rarity?: string | null): string | null {
  if (!rarity) return null;
  return RARITY_ICON[rarity] ?? null;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  // Trim at last space before n
  const slice = s.slice(0, n);
  const i = slice.lastIndexOf(" ");
  return (i > n * 0.6 ? slice.slice(0, i) : slice) + "…";
}

export default function DataPanel({ divedData, library, onBack, onSelectRelated }: Props) {
  const { node, entry, category } = divedData;
  const accent = category?.color || node.rawColor || "#00f3ff";

  // ---- Lookups ----
  const nodeById = new Map<string, LayoutNode>();
  for (const n of library.layout.nodes) nodeById.set(n.id, n);

  const categoryById = new Map<string, (typeof library.categories)[number]>();
  for (const c of library.categories) categoryById.set(c.id, c);

  // Resolve the TOP-LEVEL slug for the category badge link
  const topLevelCategorySlug: string | null = (() => {
    if (!category) return null;
    if (category.isTopLevel) return category.slug;
    const top = library.categories.find(
      (c) => c.isTopLevel && c.name === category.parentName,
    );
    return top?.slug ?? null;
  })();

  // Per-entry color: the entry's parent subcategory's parent top-level color
  function colorForEntry(e: Entry): string {
    if (!e.categoryId) return accent;
    const sub = categoryById.get(e.categoryId);
    if (!sub) return accent;
    if (sub.isTopLevel) return sub.color;
    const top = library.categories.find((c) => c.isTopLevel && c.name === sub.parentName);
    return top?.color ?? sub.color ?? accent;
  }

  // ---- Build the "related" list ----
  type Related = {
    id: string;
    name: string;
    subtitle?: string;
    description?: string;
    color?: string;
    rarityIcon?: string;
  };
  let relatedTitle = "";
  let related: Related[] = [];

  if (node.kind === "category") {
    relatedTitle = "Subcategories";
    const cat = library.categories.find((c) => c.id === node.id);
    if (cat) {
      const subs = library.categories.filter((c) => !c.isTopLevel && c.parentName === cat.name);
      related = subs.map((c) => {
        const toolCount = library.entries.filter((e) => e.categoryId === c.id).length;
        return {
          id: c.id,
          name: c.name,
          subtitle: `${toolCount} ${toolCount === 1 ? "tool" : "tools"}`,
          color: cat.color,
        };
      });
    }
  } else if (node.kind === "subcategory") {
    relatedTitle = "Tools in this category";
    related = library.entries
      .filter((e) => e.categoryId === node.id)
      .map((e) => {
        const n = nodeById.get(e.id);
        return {
          id: e.id,
          name: e.name,
          subtitle: e.pricing,
          description: truncate(e.description, 80),
          color: colorForEntry(e),
          rarityIcon: rarityIconOf(n?.rarity) ?? undefined,
        };
      });
  } else if (node.kind === "entry" && entry) {
    relatedTitle = "Related tools";
    related = library.entries
      .filter((e) => e.categoryId === entry.categoryId && e.id !== entry.id)
      .slice(0, 12)
      .map((e) => {
        const n = nodeById.get(e.id);
        return {
          id: e.id,
          name: e.name,
          subtitle: e.pricing,
          description: truncate(e.description, 80),
          color: colorForEntry(e),
          rarityIcon: rarityIconOf(n?.rarity) ?? undefined,
        };
      });
  }

  const title = node.name || entry?.name || "Untitled";
  const description =
    entry?.description ||
    (node.kind === "category"
      ? "A constellation branch of the AI Tree Library."
      : node.kind === "subcategory"
        ? "A cluster of related tools."
        : "");

  const categoryBadgeLabel = category?.name ?? (
    node.kind === "category" ? "Category" : node.kind === "subcategory" ? "Subcategory" : "Tool"
  );

  return (
    <aside className="ne-panel active" style={{ borderLeftColor: accent }}>
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        <div className="ne-panel-header">
          {topLevelCategorySlug ? (
            <Link
              href={`/category/${topLevelCategorySlug}`}
              className="ne-panel-badge ne-panel-badge-link"
              style={{ borderColor: accent, color: accent }}
            >
              {categoryBadgeLabel} ↗
            </Link>
          ) : (
            <div className="ne-panel-badge" style={{ borderColor: accent, color: accent }}>
              {categoryBadgeLabel}
            </div>
          )}
          <h2 className="ne-panel-title">{title}</h2>
        </div>

        {description ? <p className="ne-panel-desc">{description}</p> : null}

        {/* Pills row: rarity flags + pricing + clickable tags */}
        {entry ? (
          <div className="ne-panel-pills">
            {entry.featured ? <span className="ne-pill ne-pill-featured">Featured</span> : null}
            {entry.gem ? <span className="ne-pill ne-pill-gem">✨ Gem</span> : null}
            {entry.pricing ? <span className="ne-pill">{entry.pricing}</span> : null}
            {entry.tags.map((t) => (
              <Link
                key={t}
                href={`/tag/${slugify(t)}`}
                className="ne-pill ne-pill-link"
                title={`Browse all #${t} tools`}
              >
                #{t}
              </Link>
            ))}
          </div>
        ) : null}

        {/* CTA row: external visit + dedicated page link */}
        {entry ? (
          <div className="ne-panel-cta-row">
            {entry.url ? (
              <a
                className="ne-panel-link"
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ borderColor: accent, color: accent }}
                onClick={() =>
                  trackLinkClick({ name: entry.name, destination: entry.url, source: "data_panel" })
                }
              >
                Open {entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
              </a>
            ) : null}
            {entry.slug ? (
              <Link href={`/${entry.slug}`} className="ne-panel-link-secondary">
                View full page ↗
              </Link>
            ) : null}
          </div>
        ) : null}

        {entry?.source ? (
          <div className="ne-panel-source">Submitted by {entry.source}</div>
        ) : null}

        {related.length > 0 ? (
          <>
            <div className="ne-panel-related-title">{relatedTitle}</div>
            <ul className="ne-panel-list">
              {related.map((r) => (
                <li
                  key={r.id}
                  onClick={() => onSelectRelated(r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectRelated(r.id);
                    }
                  }}
                >
                  {r.color ? (
                    <span
                      className="ne-panel-list-dot"
                      style={{ background: r.color, boxShadow: `0 0 8px ${r.color}aa` }}
                    />
                  ) : null}
                  <div className="ne-panel-list-body">
                    <div className="ne-panel-list-name">
                      {r.rarityIcon ? (
                        <span className="ne-panel-list-rarity" aria-hidden>
                          {r.rarityIcon}
                        </span>
                      ) : null}
                      {r.name}
                    </div>
                    {r.description ? (
                      <div className="ne-panel-list-desc">{r.description}</div>
                    ) : null}
                    {r.subtitle ? (
                      <div className="ne-panel-list-sub">{r.subtitle}</div>
                    ) : null}
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
