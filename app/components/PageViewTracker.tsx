// Client components that fire a single custom analytics event on mount.
// Mounted from server pages so the rest of the page stays static-friendly.

"use client";

import { useEffect } from "react";
import { trackToolView, trackCategoryView } from "../../lib/track";

export function ToolViewTracker(props: {
  slug: string;
  name: string;
  category?: string;
  rarity?: string;
}) {
  useEffect(() => {
    trackToolView(props);
  }, [props]);
  return null;
}

export function CategoryViewTracker(props: { slug: string; name: string }) {
  useEffect(() => {
    trackCategoryView(props);
  }, [props]);
  return null;
}
