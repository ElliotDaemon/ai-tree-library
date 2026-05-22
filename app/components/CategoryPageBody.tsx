// Semantic HTML body for a per-category page (/category/[slug]).
// Lists all tools in the category, grouped by subcategory.

import Link from "next/link";
import type { LibraryCategory, LibraryEntry } from "../../lib/library";
import { rarityMeta } from "../../lib/library";
import Footer from "./Footer";

interface Props {
  category: LibraryCategory; // top-level
  subcategories: LibraryCategory[];
  entries: LibraryEntry[]; // all entries in this top-level
}

export default function CategoryPageBody({ category, subcategories, entries }: Props) {
  // Group entries by subcategory
  const bySub = new Map<string, LibraryEntry[]>();
  for (const e of entries) {
    if (!e.categoryId) continue;
    const arr = bySub.get(e.categoryId) || [];
    arr.push(e);
    bySub.set(e.categoryId, arr);
  }

  const totalCount = entries.length;
  const subCount = subcategories.length;

  return (
    <main className="cp-page">
      <header className="cp-topbar">
        <Link href="/" className="cp-back" aria-label="Back to constellation">
          <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
            <line x1="16" y1="29" x2="16" y2="14" opacity="0.55" />
            <line x1="16" y1="20" x2="9" y2="13" opacity="0.5" />
            <line x1="16" y1="20" x2="23" y2="13" opacity="0.5" />
            <circle cx="16" cy="14" r="1.4" fill="currentColor" />
            <circle cx="16" cy="3.5" r="1.6" fill="currentColor" />
          </svg>
          <span>← Back to constellation</span>
        </Link>
      </header>

      <article className="cp-hero">
        <div className="cp-hero-badge" style={{ borderColor: category.color, color: category.color }}>
          Category
        </div>
        <h1 className="cp-title" style={{ textShadow: `0 0 28px ${category.color}55` }}>
          {category.name}
        </h1>
        {category.description ? <p className="cp-desc">{category.description}</p> : (
          <p className="cp-desc">
            {totalCount} curated {category.name.toLowerCase()} tools, organized into {subCount} subcategories.
          </p>
        )}

        <div className="cp-stats">
          <span><strong>{totalCount}</strong> tools</span>
          <span className="cp-stat-sep">·</span>
          <span><strong>{subCount}</strong> subcategories</span>
        </div>

        <Link href={`/?category=${category.slug}`} className="cp-explore" style={{ borderColor: category.color, color: category.color }}>
          Explore this branch in 3D ↗
        </Link>
      </article>

      {subcategories.map((sub) => {
        const subEntries = bySub.get(sub.id) || [];
        if (subEntries.length === 0) return null;
        return (
          <section key={sub.id} className="cp-sub">
            <h2 className="cp-sub-title">
              {sub.name}
              <span className="cp-sub-count">{subEntries.length}</span>
            </h2>
            <div className="cp-sub-grid">
              {subEntries.map((e) => {
                const r = rarityMeta(e.rarity);
                return (
                  <Link key={e.id} href={`/${e.slug}`} className={`cp-card cp-card-${r.tier}`}>
                    <div className="cp-card-head">
                      <span className="cp-card-rarity" title={r.label}>{r.icon}</span>
                      <span className="cp-card-name">{e.name}</span>
                    </div>
                    {e.description ? <p className="cp-card-desc">{e.description}</p> : null}
                    <div className="cp-card-foot">
                      {e.pricing && e.pricing !== "Unknown" ? <span className="cp-card-pricing">{e.pricing}</span> : null}
                      {e.featured ? <span className="cp-card-tag cp-card-tag-featured">Featured</span> : null}
                      {e.gem ? <span className="cp-card-tag cp-card-tag-gem">Gem</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <Footer />
    </main>
  );
}
