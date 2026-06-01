// Card used in the /articles index and in the "related articles" rail
// at the bottom of each article. Magazine-style: tint accent, headline,
// excerpt, reading time + date byline.

import Link from "next/link";
import type { Article } from "../../lib/articles";
import { formatArticleDate } from "../../lib/articles";

const TINT_COLOR: Record<string, string> = {
  cyan: "#00f3ff",
  purple: "#a78bfa",
  pink: "#f0abfc",
  gold: "#fcd34d",
};

interface Props {
  article: Article;
  /** Compact layout for the related-articles rail. */
  compact?: boolean;
}

export default function ArticleCard({ article, compact }: Props) {
  const accent = TINT_COLOR[article.coverTint] || TINT_COLOR.cyan;
  return (
    <Link href={`/article/${article.slug}`} className={`ar-card ${compact ? "ar-card-compact" : ""}`}>
      <div className="ar-card-accent" style={{ background: accent, boxShadow: `0 0 18px ${accent}55` }} />
      <div className="ar-card-body">
        <div className="ar-card-tags">
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="ar-card-tag" style={{ color: accent }}>{t}</span>
          ))}
        </div>
        <h3 className="ar-card-title">{article.title}</h3>
        {article.excerpt ? <p className="ar-card-excerpt">{article.excerpt}</p> : null}
        <div className="ar-card-byline">
          <span>{article.author}</span>
          {article.publishedDate ? (
            <>
              <span className="ar-card-byline-dot">·</span>
              <span>{formatArticleDate(article.publishedDate)}</span>
            </>
          ) : null}
          <span className="ar-card-byline-dot">·</span>
          <span>{article.readingTimeMinutes} min read</span>
        </div>
      </div>
    </Link>
  );
}
