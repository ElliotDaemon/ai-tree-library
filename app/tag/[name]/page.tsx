// /tag/[name] — every tool sharing this tag.
//
// Linked from the clickable tag pills in DataPanel and from the tool pages.
// Long-tail SEO surface — one page per unique tag. Tags themselves are the
// freeform user-supplied descriptors on each entry.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findEntriesByTagSlug, getAllTags, loadLibrary, rarityMeta } from "../../../lib/library";
import Footer from "../../components/Footer";

const SITE = "https://aitreelibrary.com";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((t) => ({ name: t.slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name: rawSlug } = await params;
  const { name, entries } = await findEntriesByTagSlug(rawSlug);
  if (!name) return { title: "Tag not found — AI Tree Library" };
  const description = `${entries.length} AI tools tagged #${name} in the AI Tree Library. Curated picks for ${name.toLowerCase()}.`.slice(0, 160);
  return {
    title: `#${name} — AI Tools | AI Tree Library`,
    description,
    alternates: { canonical: `/tag/${rawSlug}` },
    openGraph: {
      title: `#${name} — AI Tools | AI Tree Library`,
      description,
      url: `/tag/${rawSlug}`,
      siteName: "AI Tree Library",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `#${name} — AI Tools | AI Tree Library`,
      description,
    },
  };
}

export default async function TagPage({ params }: PageProps) {
  const { name: rawSlug } = await params;
  const [{ name: tagName, entries }, lib] = await Promise.all([
    findEntriesByTagSlug(rawSlug),
    loadLibrary(),
  ]);
  if (!tagName || entries.length === 0) notFound();

  // Group by top-level category for context
  type Group = {
    topLevelName: string;
    topLevelSlug: string;
    color: string;
    entries: typeof entries;
  };
  const groups = new Map<string, Group>();
  if (lib) {
    for (const e of entries) {
      if (!e.categoryId) continue;
      const sub = lib.categories.find((c) => c.id === e.categoryId);
      if (!sub) continue;
      const top = sub.isTopLevel
        ? sub
        : lib.categories.find((c) => c.isTopLevel && c.name === sub.parentName);
      if (!top) continue;
      const g = groups.get(top.id) || {
        topLevelName: top.name,
        topLevelSlug: top.slug,
        color: top.color,
        entries: [] as typeof entries,
      };
      g.entries.push(e);
      groups.set(top.id, g);
    }
  }
  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => b.entries.length - a.entries.length,
  );

  // Sibling tags: other tags that frequently co-occur with this one
  const coTags = new Map<string, { name: string; count: number }>();
  if (lib) {
    for (const e of entries) {
      for (const t of e.tags ?? []) {
        if (!t || t.toLowerCase() === tagName.toLowerCase()) continue;
        const existing = coTags.get(t.toLowerCase());
        if (existing) existing.count++;
        else coTags.set(t.toLowerCase(), { name: t, count: 1 });
      }
    }
  }
  const relatedTags = Array.from(coTags.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `#${tagName} — AI Tools`,
            description: `${entries.length} AI tools tagged #${tagName} in the AI Tree Library.`,
            url: `${SITE}/tag/${rawSlug}`,
            isPartOf: { "@type": "WebSite", name: "AI Tree Library", url: SITE },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: entries.length,
              itemListElement: entries.slice(0, 50).map((e, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${SITE}/${e.slug}`,
                name: e.name,
              })),
            },
          }),
        }}
      />

      <main className="cp-page">
        <header className="cp-topbar">
          <Link href="/" className="cp-back" aria-label="Back to constellation">
            <span>← Back to constellation</span>
          </Link>
        </header>

        <article className="cp-hero">
          <div className="cp-hero-badge">Tag</div>
          <h1 className="cp-title">#{tagName}</h1>
          <p className="cp-desc">
            {entries.length} {entries.length === 1 ? "tool" : "tools"} in the AI Tree Library
            tagged <code>#{tagName}</code>, across {sortedGroups.length}{" "}
            {sortedGroups.length === 1 ? "category" : "categories"}.
          </p>

          {relatedTags.length > 0 ? (
            <div className="cp-tag-strip">
              <span className="cp-tag-strip-label">Often paired with:</span>
              {relatedTags.map((rt) => (
                <Link
                  key={rt.name}
                  href={`/tag/${encodeURIComponent(
                    rt.name
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, "")
                      .replace(/\s+/g, "-"),
                  )}`}
                  className="cp-tag-chip"
                >
                  #{rt.name}{" "}
                  <span className="cp-tag-chip-count">{rt.count}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </article>

        {sortedGroups.map((g) => (
          <section key={g.topLevelName} className="cp-sub">
            <h2 className="cp-sub-title" style={{ color: g.color }}>
              <Link href={`/category/${g.topLevelSlug}`} style={{ color: g.color, textDecoration: "none" }}>
                {g.topLevelName}
              </Link>
              <span className="cp-sub-count">{g.entries.length}</span>
            </h2>
            <div className="cp-sub-grid">
              {g.entries.map((e) => {
                const r = rarityMeta(e.rarity);
                return (
                  <Link key={e.id} href={`/${e.slug}`} className={`cp-card cp-card-${r.tier}`}>
                    <div className="cp-card-head">
                      <span className="cp-card-rarity" title={r.label}>
                        {r.icon}
                      </span>
                      <span className="cp-card-name">{e.name}</span>
                    </div>
                    {e.description ? <p className="cp-card-desc">{e.description}</p> : null}
                    <div className="cp-card-foot">
                      {e.pricing && e.pricing !== "Unknown" ? (
                        <span className="cp-card-pricing">{e.pricing}</span>
                      ) : null}
                      {e.featured ? (
                        <span className="cp-card-tag cp-card-tag-featured">Featured</span>
                      ) : null}
                      {e.gem ? <span className="cp-card-tag cp-card-tag-gem">Gem</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <Footer />
      </main>
    </>
  );
}
