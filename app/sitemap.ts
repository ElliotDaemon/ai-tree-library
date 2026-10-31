import type { MetadataRoute } from "next";
import { loadLibrary, SITE } from "@/lib/library";
import { BRANCHES } from "@/lib/taxonomy.mjs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lib = await loadLibrary();
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    ...["about", "submit"].map((p) => ({ url: `${SITE}/${p}`, priority: 0.5 })),
    ...BRANCHES.map((b) => ({ url: `${SITE}/category/${b.id}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...lib.map((e) => ({ url: `${SITE}/${e.id}`, lastModified: e.added, priority: e.featured ? 0.8 : 0.6 })),
  ];
}
