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

  // Reading time estimate — 200 wpm for editorial pacing
  const wordCount = (long || entry.description || "").trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));

  return (
    <main className="tp-page">
      <header className="tp-topbar">
        <Link href="/" className="tp-back" aria-label="Back to constellation">
          ← Constellation
        </Link>
      </header>

      <article className="tp-article">
        <div className="tp-eyebrow">
          {topLevel ? (
            <Link
              href={`/category/${topLevel.slug}`}
              className="tp-eyebrow-cat"
              style={{ color: topLevel.color }}
            >
              {topLevel.name}
            </Link>
          ) : null}
          {category && category.name !== topLevel?.name ? (
            <>
              <span className="tp-eyebrow-sep">/</span>
              <span className="tp-eyebrow-sub">{category.name}</span>
            </>
          ) : null}
        </div>

        <h1 className="tp-title">{entry.name}</h1>

        {entry.description ? <p className="tp-lede">{entry.description}</p> : null}

        <div className="tp-byline">
          <span className="tp-byline-meta">
            <span className={`tp-rarity-chip tp-rarity-${rarity.tier}`}>
              {rarity.icon} {rarity.label}
            </span>
            {entry.type ? <span className="tp-byline-dot">·</span> : null}
            {entry.type ? <span>{entry.type}</span> : null}
            {entry.pricing && entry.pricing !== "Unknown" ? (
              <>
                <span className="tp-byline-dot">·</span>
                <span>{entry.pricing}</span>
              </>
            ) : null}
            {wordCount > 80 ? (
              <>
                <span className="tp-byline-dot">·</span>
                <span>{readingMinutes} min read</span>
              </>
            ) : null}
          </span>
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

        {/* Footer rail — tags + source + disclaimer collapsed into one
            understated line, news-page style. No more h2 sections for tiny
            metadata. */}
        <footer className="tp-foot">
          {entry.tags.length > 0 ? (
            <div className="tp-foot-tags">
              {entry.tags.map((t) => (
                <Link
                  key={t}
                  href={`/tag/${t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                  className="tp-foot-tag"
                >
                  #{t}
                </Link>
              ))}
            </div>
          ) : null}
          {entry.source ? (
            <div className="tp-foot-source">
              Submitted by <strong>{entry.source}</strong>
            </div>
          ) : null}
        </footer>
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
