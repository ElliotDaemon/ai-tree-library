// /articles — index of every Ready article in the Articles DB.
// Magazine grid sorted by published date desc.

import type { Metadata } from "next";
import Link from "next/link";
import { loadArticles } from "../../lib/articles";
import ArticleCard from "../components/ArticleCard";
import Footer from "../components/Footer";

const SITE = "https://aitreelibrary.com";

export const metadata: Metadata = {
  title: "Articles — AI Tree Library",
  description:
    "Curated long-form articles on AI tools, image generators, coding assistants, design platforms, and the broader creative tech landscape. Updated continuously.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "Articles — AI Tree Library",
    description: "Curated long-form articles on AI tools and the creative tech landscape.",
    url: "/articles",
    siteName: "AI Tree Library",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Articles — AI Tree Library",
    description: "Curated long-form articles on AI tools.",
  },
};

// Refresh hourly so newly-flipped articles show up without a redeploy
export const revalidate = 3600;

export default async function ArticlesIndexPage() {
  const file = await loadArticles();
  const articles = file?.articles ?? [];

  return (
    <>
      {/* Graph: Blog (signals editorial site to Google + makes it
          eligible for News/Discover features) + BreadcrumbList +
          ItemList of all articles for rich-result rendering. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Blog",
                "@id": `${SITE}/articles#blog`,
                name: "AI Tree Library Articles",
                description:
                  "Curated long-form articles on AI tools, image generators, coding assistants, design platforms, and the broader creative tech landscape.",
                url: `${SITE}/articles`,
                inLanguage: "en",
                publisher: {
                  "@type": "Organization",
                  "@id": `${SITE}/#organization`,
                  name: "AI Tree Library",
                  url: SITE,
                  logo: { "@type": "ImageObject", url: `${SITE}/apple-touch-icon.png` },
                },
                blogPost: articles.map((a) => ({
                  "@type": "BlogPosting",
                  "@id": `${SITE}/article/${a.slug}#article`,
                  headline: a.title,
                  url: `${SITE}/article/${a.slug}`,
                  datePublished: a.publishedDate ?? undefined,
                  dateModified: a.updatedDate ?? a.publishedDate ?? undefined,
                  author: { "@type": "Person", name: a.author },
                  image: a.heroImageUrl
                    ? [a.heroImageUrl]
                    : [`${SITE}/article/${a.slug}/opengraph-image`],
                })),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: SITE },
                  { "@type": "ListItem", position: 2, name: "Articles", item: `${SITE}/articles` },
                ],
              },
              {
                "@type": "ItemList",
                numberOfItems: articles.length,
                itemListElement: articles.map((a, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `${SITE}/article/${a.slug}`,
                  name: a.title,
                })),
              },
            ],
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
          <div className="cp-hero-badge">Articles</div>
          <h1 className="cp-title">Articles</h1>
          <p className="cp-desc">
            Long-form picks on AI tools and creative tech.{" "}
            {articles.length} {articles.length === 1 ? "story" : "stories"} so far, each one
            linking back into specific tools from the library.
          </p>
        </article>

        {articles.length === 0 ? (
          <p className="cp-desc" style={{ marginTop: "3rem", textAlign: "center" }}>
            No articles yet. New pieces drop every few weeks — check back.
          </p>
        ) : (
          <section className="ar-grid">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </section>
        )}

        <Footer />
      </main>
    </>
  );
}
