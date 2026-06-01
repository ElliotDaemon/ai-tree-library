import type { MetadataRoute } from "next";
import { getAllTags, loadLibrary } from "../lib/library";
import { loadArticles } from "../lib/articles";

const SITE = "https://aitreelibrary.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [lib, articlesFile] = await Promise.all([loadLibrary(), loadArticles()]);
  const lastMod = lib?.generatedAt ?? new Date().toISOString();

  const out: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: lastMod, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/articles`, lastModified: articlesFile?.generatedAt ?? lastMod, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/legendary`, lastModified: lastMod, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/hidden-gems`, lastModified: lastMod, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/about`, lastModified: lastMod, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/privacy`, lastModified: lastMod, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: lastMod, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Articles — highest-priority editorial pages
  if (articlesFile) {
    for (const a of articlesFile.articles) {
      out.push({
        url: `${SITE}/article/${a.slug}`,
        lastModified: a.updatedDate ?? a.publishedDate ?? lastMod,
        changeFrequency: "monthly",
        priority: 0.85,
      });
    }
  }

  if (lib) {
    // Top-level categories
    for (const c of lib.categories.filter((x) => x.isTopLevel)) {
      out.push({
        url: `${SITE}/category/${c.slug}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    // Every entry
    for (const e of lib.entries) {
      out.push({
        url: `${SITE}/${e.slug}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: e.featured ? 0.7 : 0.6,
      });
    }
    // Every tag (long-tail SEO surface)
    const tags = await getAllTags();
    for (const t of tags) {
      // Only include tags that appear on 2+ entries — single-occurrence tags
      // are mostly noise (typos / one-off labels) and bloat the sitemap.
      if (t.count < 2) continue;
      out.push({
        url: `${SITE}/tag/${t.slug}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return out;
}
