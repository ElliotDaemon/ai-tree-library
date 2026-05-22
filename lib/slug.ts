// Slug utilities for per-tool and per-category URLs.
//
// Design:
//   - slugify() turns any name into a URL-safe lowercase hyphenated string.
//   - RESERVED_SLUGS protects routes/files that must NOT be claimed by a tool
//     (e.g. /privacy, /sitemap.xml, /api, /portal, etc.).
//   - resolveSlug() applies a hand-written override if present, otherwise
//     derives from name; collisions are broken by suffixing the last 4 chars
//     of the Notion UUID.

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_/]/g, "") // keep alnum, spaces, hyphens, slashes
    .replace(/[\s_/]+/g, "-") // whitespace/slashes/underscores -> hyphen
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Slugs that MUST NOT be claimed by an entry — Next.js routes + protected paths. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Next.js / framework
  "_next",
  "api",
  "sw",
  "favicon",
  "favicon.ico",
  "icon",
  "icon.svg",
  "manifest",
  "manifest.json",
  "opengraph-image",
  "twitter-image",
  "robots",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  // Our own routes
  "category",
  "c",
  "tools",
  "tool",
  "privacy",
  "terms",
  "about",
  "search",
  "submit",
  "portal",
  "admin",
  "dashboard",
  "llms",
  "llms.txt",
  "llms-full",
  "llms-full.txt",
  // Empty / placeholder
  "",
  "index",
  "home",
  "404",
  "500",
]);

export function isReserved(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Resolve a slug for an entry or category.
 * Priority:
 *   1. `override` (hand-written `Slug Override` field), slugified for safety
 *   2. `existingSlug` (the legacy `Slug` field on categories)
 *   3. derived from `name`
 * Reserved-slug collisions get an `-<id4>` suffix.
 * Cross-entry collisions are broken by the caller (uniqueSlug below).
 */
export function resolveSlug(
  name: string,
  id: string,
  override?: string | null,
  existingSlug?: string | null
): string {
  let base =
    (override && slugify(override)) ||
    (existingSlug && slugify(existingSlug)) ||
    slugify(name);
  if (!base) base = slugify(id).slice(0, 12);
  if (isReserved(base)) base = `${base}-${id.replace(/-/g, "").slice(-4)}`;
  return base;
}

/**
 * Assign a unique slug given the set of slugs already taken.
 * Mutates `taken` by adding the chosen slug.
 */
export function uniqueSlug(base: string, id: string, taken: Set<string>): string {
  if (!taken.has(base) && !isReserved(base)) {
    taken.add(base);
    return base;
  }
  const suffix = id.replace(/-/g, "").slice(-4);
  const withSuffix = `${base}-${suffix}`;
  if (!taken.has(withSuffix)) {
    taken.add(withSuffix);
    return withSuffix;
  }
  // Last resort: incrementing counter
  let n = 2;
  while (taken.has(`${withSuffix}-${n}`)) n++;
  const final = `${withSuffix}-${n}`;
  taken.add(final);
  return final;
}
