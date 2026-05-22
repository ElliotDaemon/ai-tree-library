import type { MetadataRoute } from "next";
import { loadLibrary } from "../lib/library";

const SITE = "https://aitreelibrary.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lib = await loadLibrary();
  const lastMod = lib?.generatedAt ?? new Date().toISOString();

  const out: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: lastMod, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/about`, lastModified: lastMod, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/privacy`, lastModified: lastMod, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: lastMod, changeFrequency: "yearly", priority: 0.3 },
  ];

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
  }

  return out;
}
