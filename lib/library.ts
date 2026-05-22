// Data load + lookup helpers used by the tool/category pages, sitemap, etc.
// Reads public/library.json (built by scripts/fetch-content.mjs).

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { cache } from "react";

export interface LibraryEntry {
  id: string;
  name: string;
  slug: string; // computed in fetch-content.mjs
  url: string;
  type: string;
  description: string;
  longDescription?: string;
  categoryId: string | null;
  tags: string[];
  pricing: string;
  featured: boolean;
  gem: boolean;
  rarity?: string;
  logoUrl: string;
  screenshotUrl: string;
  source: string;
}

export interface LibraryCategory {
  id: string;
  name: string;
  slug: string; // URL-safe slug from fetch-content.mjs
  color: string;
  description?: string;
  parentName: string;
  isTopLevel: boolean;
  displayOrder: number;
  v1ToolCount: number;
}

export interface LibraryStats {
  categories: number;
  topLevel: number;
  entries: number;
  featured: number;
  gems: number;
}

export interface LibraryFile {
  generatedAt: string;
  stats: LibraryStats;
  categories: LibraryCategory[];
  entries: LibraryEntry[];
  layout: {
    nodes: Array<unknown>;
    links: Array<{ source: string; target: string; kind: string }>;
  };
}

/**
 * Load library.json once per request. `cache()` dedupes calls within a single
 * server render — multiple components can call `loadLibrary()` and we only
 * hit the filesystem once.
 */
export const loadLibrary = cache(async (): Promise<LibraryFile | null> => {
  try {
    const raw = await fs.readFile(join(process.cwd(), "public", "library.json"), "utf8");
    return JSON.parse(raw) as LibraryFile;
  } catch {
    return null;
  }
});

export async function getAllEntrySlugs(): Promise<string[]> {
  const lib = await loadLibrary();
  if (!lib) return [];
  return lib.entries.map((e) => e.slug).filter(Boolean);
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const lib = await loadLibrary();
  if (!lib) return [];
  return lib.categories.filter((c) => c.isTopLevel).map((c) => c.slug).filter(Boolean);
}

export async function findEntryBySlug(slug: string): Promise<LibraryEntry | null> {
  const lib = await loadLibrary();
  if (!lib) return null;
  return lib.entries.find((e) => e.slug === slug) ?? null;
}

export async function findCategoryBySlug(slug: string): Promise<LibraryCategory | null> {
  const lib = await loadLibrary();
  if (!lib) return null;
  return lib.categories.find((c) => c.slug === slug && c.isTopLevel) ?? null;
}

export async function findCategoryById(id: string): Promise<LibraryCategory | null> {
  const lib = await loadLibrary();
  if (!lib) return null;
  return lib.categories.find((c) => c.id === id) ?? null;
}

/**
 * Returns the top-level parent category for a given subcategory (or the
 * category itself if it's already top-level).
 */
export async function topLevelOf(category: LibraryCategory): Promise<LibraryCategory | null> {
  if (category.isTopLevel) return category;
  const lib = await loadLibrary();
  if (!lib) return null;
  return lib.categories.find((c) => c.isTopLevel && c.name === category.parentName) ?? null;
}

export async function entriesInTopLevelCategory(topLevelSlug: string): Promise<LibraryEntry[]> {
  const lib = await loadLibrary();
  if (!lib) return [];
  const top = lib.categories.find((c) => c.slug === topLevelSlug && c.isTopLevel);
  if (!top) return [];
  const subIds = new Set(
    lib.categories.filter((c) => !c.isTopLevel && c.parentName === top.name).map((c) => c.id)
  );
  // entry.categoryId points at a SUBCATEGORY in our schema
  return lib.entries.filter((e) => e.categoryId && subIds.has(e.categoryId));
}

export async function subcategoriesOf(topLevelSlug: string): Promise<LibraryCategory[]> {
  const lib = await loadLibrary();
  if (!lib) return [];
  const top = lib.categories.find((c) => c.slug === topLevelSlug && c.isTopLevel);
  if (!top) return [];
  return lib.categories
    .filter((c) => !c.isTopLevel && c.parentName === top.name)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Related entries — same subcategory first, then siblings in same top-level
 * category, then anything sharing 2+ tags. Self excluded.
 */
export async function relatedEntries(entry: LibraryEntry, n = 8): Promise<LibraryEntry[]> {
  const lib = await loadLibrary();
  if (!lib) return [];
  const out: LibraryEntry[] = [];
  const taken = new Set<string>([entry.id]);

  // Same subcategory
  if (entry.categoryId) {
    for (const e of lib.entries) {
      if (taken.has(e.id)) continue;
      if (e.categoryId === entry.categoryId) {
        out.push(e);
        taken.add(e.id);
        if (out.length >= n) return out;
      }
    }
  }

  // Same top-level category (different subcat)
  const sub = entry.categoryId ? lib.categories.find((c) => c.id === entry.categoryId) : null;
  if (sub) {
    const top = lib.categories.find((c) => c.isTopLevel && c.name === sub.parentName);
    if (top) {
      const siblingSubIds = new Set(
        lib.categories.filter((c) => !c.isTopLevel && c.parentName === top.name).map((c) => c.id)
      );
      for (const e of lib.entries) {
        if (taken.has(e.id)) continue;
        if (e.categoryId && siblingSubIds.has(e.categoryId)) {
          out.push(e);
          taken.add(e.id);
          if (out.length >= n) return out;
        }
      }
    }
  }

  // Shared tags (2+)
  const myTags = new Set(entry.tags);
  if (myTags.size >= 2) {
    for (const e of lib.entries) {
      if (taken.has(e.id)) continue;
      const overlap = e.tags.filter((t) => myTags.has(t)).length;
      if (overlap >= 2) {
        out.push(e);
        taken.add(e.id);
        if (out.length >= n) return out;
      }
    }
  }

  return out;
}

export function rarityMeta(rarity?: string): { tier: string; label: string; icon: string } {
  if (!rarity) return { tier: "established", label: "Established", icon: "⭐" };
  if (rarity.includes("Legendary")) return { tier: "legendary", label: "Legendary", icon: "👑" };
  if (rarity.includes("Hidden Gem")) return { tier: "gem", label: "Hidden Gem", icon: "🌟" };
  if (rarity.includes("Rare")) return { tier: "rare", label: "Rare", icon: "💎" };
  return { tier: "established", label: "Established", icon: "⭐" };
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
