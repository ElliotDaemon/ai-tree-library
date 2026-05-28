// /hidden-gems — every Hidden Gem-tier tool, grouped by top-level category.
//
// The "you probably haven't heard of these but should" pile. SEO long-tail
// landing for "underrated AI tools" / "best lesser-known AI tools" queries.

import type { Metadata } from "next";
import Link from "next/link";
import { entriesByRarity, loadLibrary, rarityMeta } from "../../lib/library";
import Footer from "../components/Footer";

const SITE = "https://aitreelibrary.com";

export const metadata: Metadata = {
  title: "Hidden Gem AI Tools — Underrated Picks | AI Tree Library",
  description:
    "The Hidden Gem tier of the AI Tree Library — underrated, lesser-known but genuinely great AI tools worth your attention. Curated and updated continuously.",
  alternates: { canonical: "/hidden-gems" },
  openGraph: {
    title: "Hidden Gem AI Tools — AI Tree Library",
    description:
      "Underrated, lesser-known but genuinely great AI tools. Curated and updated continuously.",
    url: "/hidden-gems",
    siteName: "AI Tree Library",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hidden Gem AI Tools — AI Tree Library",
    description: "Underrated AI tools worth your attention.",
  },
};

export const revalidate = 3600;

export default async function HiddenGemsPage() {
  const [gems, lib] = await Promise.all([entriesByRarity("gem"), loadLibrary()]);

  type Group = { topLevelName: string; topLevelSlug: string; color: string; entries: typeof gems };
  const groups = new Map<string, Group>();
  if (lib) {
    for (const e of gems) {
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
        entries: [] as typeof gems,
      };
      g.entries.push(e);
      groups.set(top.id, g);
    }
  }
  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => b.entries.length - a.entries.length,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Hidden Gem AI Tools",
            description:
              "The Hidden Gem tier of the AI Tree Library — underrated, lesser-known AI tools.",
            url: `${SITE}/hidden-gems`,
            isPartOf: { "@type": "WebSite", name: "AI Tree Library", url: SITE },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: gems.length,
              itemListElement: gems.slice(0, 50).map((e, i) => ({
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
            ← Constellation
          </Link>
        </header>

        <article className="cp-hero">
          <div className="cp-hero-badge" style={{ borderColor: "#fde047", color: "#fde047" }}>
            Rarity tier
          </div>
          <h1 className="cp-title" style={{ textShadow: "0 0 28px rgba(253, 224, 71, 0.4)" }}>
            🌟 Hidden Gems
          </h1>
          <p className="cp-desc">
            {gems.length} lesser-known AI tools the curator thinks deserve more attention.
            Underrated picks across image, video, audio, writing, code, and beyond — quietly
            powerful, often free or affordable, and not yet in the mainstream conversation.
          </p>

          <div className="cp-stats">
            <span>
              <strong>{gems.length}</strong> hidden gems
            </span>
            <span className="cp-stat-sep">·</span>
            <span>
              <strong>{sortedGroups.length}</strong> categories
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              href="/"
              className="cp-explore"
              style={{ borderColor: "#fde047", color: "#fde047" }}
            >
              Explore in 3D ↗
            </Link>
            <Link
              href="/legendary"
              className="cp-explore"
              style={{ borderColor: "#fcd34d", color: "#fcd34d" }}
            >
              👑 See Legendary tools →
            </Link>
          </div>
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
                      {e.gem ? <span className="cp-card-tag cp-card-tag-gem">Gem</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {gems.length === 0 ? (
          <p className="cp-desc" style={{ marginTop: "3rem", textAlign: "center" }}>
            No hidden gems yet — they&apos;ll appear here as the curator flags them.
          </p>
        ) : null}

        <Footer />
      </main>
    </>
  );
}
