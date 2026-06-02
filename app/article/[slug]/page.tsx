// /article/[slug] — single article page. Editorial layout matching the
// tool pages: Spectral serif headline, italic dek, byline strip, prose
// body. Inline ToolCardInline embeds wherever the article references a
// Library entry.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findArticleBySlug,
  getAllArticleSlugs,
  loadArticles,
  formatArticleDate,
  relatedArticles,
} from "../../../lib/articles";
import { loadLibrary, type LibraryEntry } from "../../../lib/library";
import ArticleBody from "../../components/ArticleBody";
import ArticleCard from "../../components/ArticleCard";
import ToolCardInline from "../../components/ToolCardInline";
import Footer from "../../components/Footer";

const SITE = "https://aitreelibrary.com";

const TINT_COLOR: Record<string, string> = {
  cyan: "#00f3ff",
  purple: "#a78bfa",
  pink: "#f0abfc",
  gold: "#fcd34d",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = true;

// Force dynamic rendering. The portal's Save flow needs the article
// page to reflect changes the instant the user reloads — any cache
// layer (page-level revalidate window, CDN HTML cache, Next data
// cache) introduces a wait that confuses the user ("did it save?").
// Each render is just a filesystem read + a handful of small blob
// fetches, so the cost of going fully dynamic is negligible vs. the
// editor-UX win. We can re-enable caching once content stabilises.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await findArticleBySlug(slug);
  if (!article) return { title: "Article not found — AI Tree Library" };

  const description = (article.excerpt || article.title).slice(0, 160);

  return {
    title: `${article.title} — AI Tree Library`,
    description,
    alternates: { canonical: `/article/${article.slug}` },
    authors: [{ name: article.author }],
    openGraph: {
      title: article.title,
      description,
      url: `/article/${article.slug}`,
      siteName: "AI Tree Library",
      type: "article",
      authors: [article.author],
      ...(article.publishedDate ? { publishedTime: article.publishedDate } : {}),
      ...(article.updatedDate ? { modifiedTime: article.updatedDate } : {}),
      tags: article.tags,
      // When the editor sets a custom Hero Image URL via the portal,
      // social shares should use it too — otherwise Next picks up the
      // auto-generated /article/[slug]/opengraph-image route by convention.
      ...(article.heroImageUrl
        ? { images: [{ url: article.heroImageUrl, width: 1200, height: 630, alt: article.title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      ...(article.heroImageUrl ? { images: [article.heroImageUrl] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await findArticleBySlug(slug);
  if (!article) notFound();

  const [lib, relAll] = await Promise.all([loadLibrary(), relatedArticles(article)]);

  const entryBySlug = new Map<string, LibraryEntry>();
  if (lib) {
    for (const e of lib.entries) entryBySlug.set(e.slug, e);
  }

  // Resolve featured tools (relation IDs → full entries) for the
  // "Tools featured in this piece" rail at the bottom.
  const featuredTools: LibraryEntry[] = [];
  if (lib && article.featuredToolIds.length > 0) {
    const byId = new Map(lib.entries.map((e) => [e.id, e]));
    for (const id of article.featuredToolIds) {
      const e = byId.get(id);
      if (e) featuredTools.push(e);
    }
  }

  const accent = TINT_COLOR[article.coverTint] || TINT_COLOR.cyan;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt || article.title,
            author: { "@type": "Person", name: article.author },
            datePublished: article.publishedDate ?? undefined,
            dateModified: article.updatedDate ?? article.publishedDate ?? undefined,
            url: `${SITE}/article/${article.slug}`,
            isPartOf: { "@type": "WebSite", name: "AI Tree Library", url: SITE },
            keywords: article.tags.join(", "),
            wordCount: article.wordCount,
            ...(featuredTools.length > 0
              ? {
                  mentions: featuredTools.map((t) => ({
                    "@type": "SoftwareApplication",
                    name: t.name,
                    url: `${SITE}/${t.slug}`,
                  })),
                }
              : {}),
          }),
        }}
      />

      <main className="cp-page">
        <header className="cp-topbar">
          <Link href="/" className="cp-back" aria-label="Back to constellation">
            ← Constellation
          </Link>
        </header>

        <article className="ar-article">
          {/* Hero image — if the article has a custom Hero Image URL set
              (via the portal), use that. Otherwise fall back to the auto-
              generated constellation OG image, which doubles as the social
              share preview and is cached at the edge. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ar-hero"
            src={article.heroImageUrl || `/article/${article.slug}/opengraph-image`}
            alt={article.title}
            width={1200}
            height={630}
            loading="eager"
          />

          <div className="ar-eyebrow">
            <Link href="/articles" style={{ color: accent }}>Articles</Link>
            {article.tags.slice(0, 2).map((t) => (
              <span key={t}>
                <span className="ar-eyebrow-sep">/</span>
                <span className="ar-eyebrow-tag">{t}</span>
              </span>
            ))}
          </div>

          <h1 className="ar-title">{article.title}</h1>

          {article.excerpt ? <p className="ar-lede">{article.excerpt}</p> : null}

          <div className="ar-byline">
            <span className="ar-byline-author">{article.author}</span>
            {article.publishedDate ? (
              <>
                <span className="ar-byline-dot">·</span>
                <span>{formatArticleDate(article.publishedDate)}</span>
              </>
            ) : null}
            <span className="ar-byline-dot">·</span>
            <span>{article.readingTimeMinutes} min read</span>
          </div>

          <ArticleBody blocks={article.body} entryBySlug={entryBySlug} />

          {featuredTools.length > 0 ? (
            <section className="ar-featured">
              <h2 className="ar-featured-title">Tools featured in this piece</h2>
              <div className="ar-featured-list">
                {featuredTools.map((t) => (
                  <ToolCardInline
                    key={t.id}
                    slug={t.slug}
                    name={t.name}
                    description={t.description}
                    entry={t}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </article>

        {relAll.length > 0 ? (
          <section className="ar-related">
            <h2 className="ar-related-title">Related reading</h2>
            <div className="ar-related-grid">
              {relAll.map((r) => (
                <ArticleCard key={r.id} article={r} compact />
              ))}
            </div>
          </section>
        ) : null}

        <Footer />
      </main>
    </>
  );
}
