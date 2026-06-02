// Article data loaders. Reads public/articles.json (built by
// scripts/fetch-articles.mjs) and applies the per-article overlay
// stored in Vercel Blob so portal Saves are visible without a rebuild.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { getOverlay } from "./article-overlay";

export interface RichSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

export type ArticleBlock =
  | { type: "p"; segments: RichSegment[] }
  | { type: "h"; level: 1 | 2 | 3; segments: RichSegment[] }
  | { type: "ul"; items: RichSegment[][] }
  | { type: "ol"; items: RichSegment[][] }
  | { type: "quote"; segments: RichSegment[] }
  | { type: "callout"; emoji: string; segments: RichSegment[] }
  | { type: "code"; language: string; text: string }
  | { type: "img"; url: string; caption?: RichSegment[]; alt?: string }
  | { type: "table"; headers: RichSegment[][] | null; rows: RichSegment[][][] }
  | { type: "hr" }
  | { type: "tool"; slug: string; name: string; description: string; pricing?: string; rarity?: string };

export interface Article {
  id: string;
  title: string;
  slug: string;
  author: string;
  status: string;
  publishedDate: string | null;
  updatedDate: string | null;
  excerpt: string;
  coverTint: string;
  /** Custom hero image (URL or uploaded asset). When null/empty the
   *  article falls back to the auto-generated /article/[slug]/opengraph-image. */
  heroImageUrl?: string | null;
  tags: string[];
  featuredToolIds: string[];
  readingTimeMinutes: number;
  wordCount: number;
  body: ArticleBlock[];
}

export interface ArticlesFile {
  generatedAt: string;
  articles: Article[];
}

export const loadArticles = cache(async (): Promise<ArticlesFile | null> => {
  try {
    const raw = await fs.readFile(join(process.cwd(), "public", "articles.json"), "utf8");
    const base = JSON.parse(raw) as ArticlesFile;

    // Apply the live overlay layer on top of the baked file. The overlay
    // is cached per-article via unstable_cache + tag, so this is cheap
    // after the first request. Save endpoint calls revalidateTag to
    // invalidate. Falls back silently if Blob isn't configured.
    const articles = await Promise.all(
      base.articles.map(async (a) => {
        const overlay = await getOverlay(a.id);
        if (!overlay) return a;
        return {
          ...a,
          ...(overlay.title !== undefined ? { title: overlay.title } : {}),
          ...(overlay.excerpt !== undefined ? { excerpt: overlay.excerpt } : {}),
          ...(overlay.coverTint !== undefined ? { coverTint: overlay.coverTint } : {}),
          ...(overlay.heroImageUrl !== undefined ? { heroImageUrl: overlay.heroImageUrl } : {}),
          ...(overlay.tags !== undefined ? { tags: overlay.tags } : {}),
        };
      }),
    );

    return { ...base, articles };
  } catch {
    return null;
  }
});

export async function getAllArticleSlugs(): Promise<string[]> {
  const f = await loadArticles();
  if (!f) return [];
  return f.articles.map((a) => a.slug).filter(Boolean);
}

export async function findArticleBySlug(slug: string): Promise<Article | null> {
  const f = await loadArticles();
  if (!f) return null;
  return f.articles.find((a) => a.slug === slug) ?? null;
}

export async function articlesFeaturingTool(toolId: string): Promise<Article[]> {
  const f = await loadArticles();
  if (!f) return [];
  return f.articles.filter((a) => a.featuredToolIds.includes(toolId));
}

export async function relatedArticles(article: Article, n = 4): Promise<Article[]> {
  const f = await loadArticles();
  if (!f) return [];
  const my = new Set(article.tags);
  return f.articles
    .filter((a) => a.id !== article.id)
    .map((a) => ({ a, overlap: a.tags.filter((t) => my.has(t)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, n)
    .map((x) => x.a);
}

export function formatArticleDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}
