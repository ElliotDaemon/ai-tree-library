// /library — the long-scroll "browse everything" surface.
//
// CDcruz / useful-sites style: every tool in the library on a single page,
// grouped by top-level category, with subcategory subheaders. Editorial
// counterpart to the 3D constellation — for visitors who want to scan
// linearly rather than fly through space.
//
// Listed at the top: articles. Then category sections. Each entry is a
// compact row with name + host + visit link. Click name → /[slug] (the
// dedicated tool page).
//
// Server-rendered (cache 1h) so it's indexable. lib/slug RESERVED_SLUGS
// already includes "library" so no tool can collide with this path.

import type { Metadata } from "next";
import Link from "next/link";
import { loadLibrary, rarityMeta } from "../../lib/library";
import { loadArticles } from "../../lib/articles";
import Footer from "../components/Footer";

const SITE = "https://aitreelibrary.com";

export const metadata: Metadata = {
  title: "Browse — AI Tree Library",
  description:
    "The full AI Tree Library on one page: every curated tool, website, and resource, grouped by category. Plus every published article.",
  alternates: { canonical: "/library" },
  openGraph: {
    title: "Browse — AI Tree Library",
    description: "Every curated tool on a single scrollable page.",
    url: "/library",
    siteName: "AI Tree Library",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse — AI Tree Library",
    description: "Every curated tool on a single scrollable page.",
  },
};

export const revalidate = 3600;

export default async function LibraryBrowsePage() {
  const [lib, articlesFile] = await Promise.all([loadLibrary(), loadArticles()]);
  const articles = articlesFile?.articles ?? [];

  if (!lib) {
    return (
      <main className="cp-page">
        <header className="cp-topbar">
          <Link href="/" className="cp-back">← Constellation</Link>
        </header>
        <article className="cp-hero">
          <h1 className="cp-title">Browse</h1>
          <p className="cp-desc">Library not loaded yet — check back in a moment.</p>
        </article>
        <Footer />
      </main>
    );
  }

  const topLevel = lib.categories
    .filter((c) => c.isTopLevel)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Group entries: top-level → subcategory → entries[]
  const subsByParent = new Map<string, typeof lib.categories>();
  for (const c of lib.categories) {
    if (c.isTopLevel) continue;
    const list = subsByParent.get(c.parentName) ?? [];
    list.push(c);
    subsByParent.set(c.parentName, list);
  }

  const entriesByCategoryId = new Map<string, typeof lib.entries>();
  for (const e of lib.entries) {
    if (!e.categoryId) continue;
    const list = entriesByCategoryId.get(e.categoryId) ?? [];
    list.push(e);
    entriesByCategoryId.set(e.categoryId, list);
  }
  for (const list of entriesByCategoryId.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalEntries = lib.entries.length;
  const totalArticles = articles.length;

  return (
    <>
      <main className="lib-page">
        <header className="cp-topbar">
          <Link href="/" className="cp-back">← Constellation</Link>
        </header>

        <article className="cp-hero">
          <div className="cp-hero-badge">Browse the library</div>
          <h1 className="cp-title">Everything in one place</h1>
          <p className="cp-desc">
            All {totalEntries} curated tools and {totalArticles}{" "}
            {totalArticles === 1 ? "article" : "articles"}, grouped by category. Click any name
            for the dedicated page, or jump straight to the source.
          </p>
          <div className="lib-jump-row">
            {totalArticles > 0 ? (
              <a href="#articles" className="lib-jump-chip">📰 Articles</a>
            ) : null}
            {topLevel.map((c) => (
              <a key={c.id} href={`#cat-${c.slug}`} className="lib-jump-chip" style={{ borderColor: `${c.color}66` }}>
                {c.name}
              </a>
            ))}
          </div>
        </article>

        {/* ---------- Articles section ---------- */}
        {articles.length > 0 ? (
          <section id="articles" className="lib-section">
            <h2 className="lib-section-title">📰 Articles</h2>
            <div className="lib-rows">
              {articles.map((a) => (
                <Link key={a.id} href={`/article/${a.slug}`} className="lib-row">
                  <span className="lib-row-name">{a.title}</span>
                  {a.excerpt ? <span className="lib-row-desc">{a.excerpt}</span> : null}
                  <span className="lib-row-host">{SITE}/article/{a.slug}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ---------- Categories ---------- */}
        {topLevel.map((cat) => {
          const subs = (subsByParent.get(cat.name) ?? []).sort(
            (a, b) => a.displayOrder - b.displayOrder,
          );
          const allEntries = subs.flatMap((s) => entriesByCategoryId.get(s.id) ?? []);
          if (allEntries.length === 0) return null;
          return (
            <section key={cat.id} id={`cat-${cat.slug}`} className="lib-section">
              <h2 className="lib-section-title" style={{ color: cat.color }}>
                <Link href={`/category/${cat.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {cat.name}
                </Link>
                <span className="lib-section-count">{allEntries.length}</span>
              </h2>
              {subs.map((sub) => {
                const subEntries = entriesByCategoryId.get(sub.id) ?? [];
                if (subEntries.length === 0) return null;
                return (
                  <div key={sub.id} className="lib-sub">
                    <h3 className="lib-sub-title">{sub.name}</h3>
                    <div className="lib-rows lib-rows-dense">
                      {subEntries.map((e) => {
                        const r = rarityMeta(e.rarity);
                        const host = (() => {
                          try {
                            return new URL(e.url).hostname.replace(/^www\./, "");
                          } catch {
                            return "";
                          }
                        })();
                        return (
                          <Link key={e.id} href={`/${e.slug}`} className="lib-row lib-row-dense">
                            <span className="lib-row-name">
                              {r.icon ? <span className="lib-row-rarity" aria-hidden>{r.icon}</span> : null}
                              {e.name}
                            </span>
                            {e.description ? <span className="lib-row-desc">{e.description}</span> : null}
                            <span className="lib-row-host">{host}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        <Footer />
      </main>
    </>
  );
}
