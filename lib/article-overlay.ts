// Live overlay for article metadata. Solves the "wait for next deploy"
// problem after editing in the portal.
//
// Articles are baked into public/articles.json at build time. That file
// holds the long-form body blocks + every metadata field. Rebuilding it
// requires a Notion fetch + a Vercel deploy — slow + burns build
// minutes.
//
// Instead, the portal Save endpoint writes a small overlay JSON for the
// edited article into Vercel Blob at a deterministic path:
//   article-overlay/<id>.json
//
// On every request, loadArticles() reads the base from articles.json,
// then applies the overlay so the user's most recent portal edits win.
// The overlay fetch is cached via unstable_cache + tag, so subsequent
// requests don't re-hit the network. The Save endpoint calls
// revalidateTag('article-overlay') to invalidate the cache and have the
// next render pull the fresh overlay.
//
// Net effect: a Save in the portal is visible on the live article in
// the time it takes Vercel to render the next request (sub-second),
// without rebuilding anything.

import { unstable_cache } from "next/cache";
import { head, put } from "@vercel/blob";

const OVERLAY_TAG = "article-overlay";
const OVERLAY_PATH = (id: string) => `article-overlay/${id}.json`;

/** Only the fields the portal currently edits. Body blocks still live
 *  in articles.json — editing prose requires a Notion edit + re-fetch. */
export interface ArticleOverlay {
  title?: string;
  excerpt?: string;
  heroImageUrl?: string | null;
  coverTint?: string;
  tags?: string[];
  /** ISO timestamp of when the overlay was last written, for debugging. */
  updatedAt?: string;
}

async function fetchOverlayUncached(id: string): Promise<ArticleOverlay | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const blob = await head(OVERLAY_PATH(id));
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ArticleOverlay;
  } catch {
    // head() throws on 404 — that's the no-overlay case
    return null;
  }
}

/** Cached read. Invalidated whenever the Save endpoint calls
 *  revalidateTag('article-overlay'). The per-id key in keyParts means
 *  each article's overlay is cached independently. */
export function getOverlay(id: string): Promise<ArticleOverlay | null> {
  return unstable_cache(
    () => fetchOverlayUncached(id),
    ["article-overlay", id],
    { tags: [OVERLAY_TAG, `${OVERLAY_TAG}:${id}`], revalidate: 3600 },
  )();
}

/** Write an overlay for one article. Called by /api/portal/update-article
 *  immediately after the Notion write succeeds. Always overwrites in
 *  place — Notion remains the source of truth, this is just the live
 *  read cache. Returns the public URL of the written overlay (handy
 *  for debugging — the portal surfaces it in the Save response). */
export async function writeOverlay(id: string, fields: ArticleOverlay): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const existing = (await fetchOverlayUncached(id)) ?? {};
  const merged: ArticleOverlay = {
    ...existing,
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  const result = await put(OVERLAY_PATH(id), JSON.stringify(merged), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    // Disable random suffix so the path is deterministic for head()/fetch().
    addRandomSuffix: false,
    // Bypass Vercel Blob's edge cache so the next overlay read sees
    // this write immediately, not a 60s-stale copy.
    cacheControlMaxAge: 0,
  });
  return result.url;
}

export const ARTICLE_OVERLAY_TAG = OVERLAY_TAG;
