// Article data loaders. Reads public/articles.json (built by
// scripts/fetch-articles.mjs).

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { cache } from "react";

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
    return JSON.parse(raw) as ArticlesFile;
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
