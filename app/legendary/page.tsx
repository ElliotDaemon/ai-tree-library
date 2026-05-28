// /legendary — every Legendary-tier tool, grouped by top-level category.
//
// SEO long-tail landing for "best AI tools" / "top AI tools" queries.
// Renders as a serious curated list with category groupings, JSON-LD
// CollectionPage schema, and links into each tool's dedicated page.

import type { Metadata } from "next";
import Link from "next/link";
import { entriesByRarity, loadLibrary, rarityMeta } from "../../lib/library";
import Footer from "../components/Footer";

const SITE = "https://aitreelibrary.com";

export const metadata: Metadata = {
  title: "Legendary AI Tools — Curated Top Picks | AI Tree Library",
  description:
    "The Legendary tier of the AI Tree Library — hand-picked, industry-defining AI tools and resources. Updated continuously, organized by category.",
  alternates: { canonical: "/legendary" },
  openGraph: {
    title: "Legendary AI Tools — AI Tree Library",
    description:
      "Industry-defining AI tools curated into a single Legendary tier. Updated continuously.",
    url: "/legendary",
    siteName: "AI Tree Library",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Legendary AI Tools — AI Tree Library",
    description: "Hand-picked Legendary-tier AI tools.",
  },
};

// Refresh every hour so newly-flagged legendaries show up without a full deploy
export const revalidate = 3600;

export default async function LegendaryPage() {
  const [legendary, lib] = await Promise.all([entriesByRarity("legendary"), loadLibrary()]);

  // Group by top-level category name
  type Group = { topLevelName: string; topLevelSlug: string; color: string; entries: typeof legendary };
  const groups = new Map<string, Group>();
  if (lib) {
    for (const e of legendary) {
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
        entries: [] as typeof legendary,
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
            name: "Legendary AI Tools",
            description:
              "The Legendary tier of the AI Tree Library — hand-picked, industry-defining AI tools.",
            url: `${SITE}/legendary`,
            isPartOf: { "@type": "WebSite", name: "AI Tree Library", url: SITE },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: legendary.length,
              itemListElement: legendary.slice(0, 50).map((e, i) => ({
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
          <div className="cp-hero-badge" style={{ borderColor: "#fcd34d", color: "#fcd34d" }}>
            Rarity tier
          </div>
          <h1 className="cp-title" style={{ textShadow: "0 0 28px rgba(252, 211, 77, 0.4)" }}>
            👑 Legendary AI Tools
          </h1>
          <p className="cp-desc">
            The top tier of the AI Tree Library — {legendary.length}{" "}
            industry-defining AI tools that have reshaped how creators, engineers, and businesses
            work. Hand-picked by Elliot Daemon, updated as the field evolves.
          </p>

          <div className="cp-stats">
            <span>
              <strong>{legendary.length}</strong> legendary tools
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
              style={{ borderColor: "#fcd34d", color: "#fcd34d" }}
            >
              Explore in 3D ↗
            </Link>
            <Link
              href="/hidden-gems"
              className="cp-explore"
              style={{ borderColor: "#fde047", color: "#fde047" }}
            >
              🌟 See Hidden Gems →
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
                      {e.featured ? (
                        <span className="cp-card-tag cp-card-tag-featured">Featured</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {legendary.length === 0 ? (
          <p className="cp-desc" style={{ marginTop: "3rem", textAlign: "center" }}>
            No legendary tools yet — they&apos;ll appear here as the curator flags them.
          </p>
        ) : null}

        <Footer />
      </main>
    </>
  );
}
