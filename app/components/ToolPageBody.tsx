// Semantic HTML body for a per-tool page (/[slug]). Indexable, no R3F.
// Liquid-glass cards over the same dark nebula backdrop as the home.

import Link from "next/link";
import type { LibraryEntry, LibraryCategory } from "../../lib/library";
import { rarityMeta, hostnameOf } from "../../lib/library";
import Footer from "./Footer";
import VisitButton from "./VisitButton";

interface Props {
  entry: LibraryEntry;
  category: LibraryCategory | null; // entry's direct (sub)category
  topLevel: LibraryCategory | null; // top-level parent category
  related: LibraryEntry[];
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function ToolPageBody({ entry, category, topLevel, related }: Props) {
  const rarity = rarityMeta(entry.rarity);
  const long = entry.longDescription?.trim() || "";
  const paras = long ? paragraphs(long) : [];
  const host = hostnameOf(entry.url);

  return (
    <main className="tp-page">
      <header className="tp-topbar">
        <Link href="/" className="tp-back" aria-label="Back to constellation">
          <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
            <line x1="16" y1="29" x2="16" y2="14" opacity="0.55" />
            <line x1="16" y1="20" x2="9" y2="13" opacity="0.5" />
            <line x1="16" y1="20" x2="23" y2="13" opacity="0.5" />
            <circle cx="16" cy="14" r="1.4" fill="currentColor" />
            <circle cx="16" cy="20" r="1.2" fill="currentColor" />
            <circle cx="9" cy="13" r="1.3" fill="currentColor" />
            <circle cx="23" cy="13" r="1.3" fill="currentColor" />
            <circle cx="16" cy="3.5" r="1.6" fill="currentColor" />
          </svg>
          <span>← Back to constellation</span>
        </Link>
      </header>

      <article className="tp-card">
        {topLevel ? (
          <Link
            href={`/category/${topLevel.slug}`}
            className="tp-cat-badge"
            style={{ borderColor: topLevel.color, color: topLevel.color }}
          >
            {topLevel.name}
          </Link>
        ) : null}

        <h1 className="tp-title">
          {entry.featured ? <span className="tp-crown" title="Featured">{rarity.icon}</span> : null}
          {entry.name}
        </h1>

        {entry.description ? <p className="tp-lede">{entry.description}</p> : null}

        <div className="tp-pills">
          <span className={`tp-pill tp-rarity-${rarity.tier}`}>
            {rarity.icon} {rarity.label}
          </span>
          {entry.type ? <span className="tp-pill">{entry.type}</span> : null}
          {entry.pricing && entry.pricing !== "Unknown" ? (
            <span className="tp-pill">{entry.pricing}</span>
          ) : null}
          {entry.gem ? <span className="tp-pill tp-pill-gem">✨ Gem</span> : null}
          {entry.featured ? <span className="tp-pill tp-pill-featured">Featured</span> : null}
        </div>

        <VisitButton url={entry.url} name={entry.name} slug={entry.slug}>
          Visit {host} ↗
        </VisitButton>
        <p className="tp-disclaimer">External link. Not endorsed — curated for usefulness.</p>

        {paras.length > 0 ? (
          <section className="tp-section">
            <h2>What is {entry.name}?</h2>
            {paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ) : (
          <section className="tp-section">
            <h2>About {entry.name}</h2>
            <p>
              {entry.name} is part of the {topLevel?.name || "AI Tree Library"} branch of curated tools.
              {category && category.name !== topLevel?.name ? ` It belongs to the ${category.name} subcategory.` : ""}
              {entry.tags.length > 0 ? ` Tagged: ${entry.tags.join(", ")}.` : ""}
            </p>
            <p>
              A longer write-up is coming. In the meantime, visit{" "}
              <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow">
                {host}
              </a>{" "}
              directly to explore.
            </p>
          </section>
        )}

        {entry.tags.length > 0 ? (
          <section className="tp-section">
            <h2>Tags</h2>
            <div className="tp-tags">
              {entry.tags.map((t) => (
                <span key={t} className="tp-tag">
                  #{t}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {entry.source ? (
          <section className="tp-section">
            <h2>Discovery</h2>
            <p>
              Submitted by <strong>{entry.source}</strong>.
            </p>
          </section>
        ) : null}
      </article>

      {related.length > 0 ? (
        <section className="tp-related">
          <h2 className="tp-related-title">
            Related tools
            {topLevel ? (
              <>
                {" in "}
                <Link href={`/category/${topLevel.slug}`} style={{ color: topLevel.color }}>
                  {topLevel.name}
                </Link>
              </>
            ) : null}
          </h2>
          <div className="tp-related-grid">
            {related.map((r) => (
              <Link key={r.id} href={`/${r.slug}`} className="tp-related-card">
                <span className="tp-related-name">{r.name}</span>
                <span className="tp-related-desc">{r.description}</span>
                <span className="tp-related-rarity">{rarityMeta(r.rarity).icon}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
