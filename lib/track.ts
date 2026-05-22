// Custom event tracking — thin wrapper over Vercel Analytics' track().
// Centralizes event names + prop shapes so the portal can rely on consistent
// keys when querying Vercel's REST API.

"use client";

import { track } from "@vercel/analytics";

// Event taxonomy. Keep names short — Vercel charges per-event over the free
// tier and we want analytics readouts to be quick to scan.

export function trackToolView(args: {
  slug: string;
  name: string;
  category?: string;
  rarity?: string;
}) {
  track("tool_view", {
    slug: args.slug,
    name: args.name,
    category: args.category ?? "",
    rarity: args.rarity ?? "",
  });
}

export function trackCategoryView(args: { slug: string; name: string }) {
  track("category_view", { slug: args.slug, name: args.name });
}

export function trackNodeDive(args: {
  id: string;
  name: string;
  kind: string;
  category?: string;
  rarity?: string;
  source: "constellation" | "search" | "list" | "related" | "url";
}) {
  track("node_dive", {
    id: args.id,
    name: args.name,
    kind: args.kind,
    category: args.category ?? "",
    rarity: args.rarity ?? "",
    source: args.source,
  });
}

export function trackLinkClick(args: {
  name: string;
  slug?: string;
  destination: string;
  source: "tool_page" | "data_panel" | "list" | "category_card";
}) {
  let host = args.destination;
  try {
    host = new URL(args.destination).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  track("link_click", {
    name: args.name,
    slug: args.slug ?? "",
    destination: host,
    source: args.source,
  });
}

export function trackSearchQuery(args: { q: string; resultCount: number }) {
  if (!args.q.trim()) return;
  track("search_query", { q: args.q.slice(0, 80), resultCount: args.resultCount });
}

export function trackFilterApply(args: { kind: string; value: string }) {
  track("filter_apply", { kind: args.kind, value: args.value });
}

export function trackSubmissionSent(args: { host: string }) {
  track("submission_sent", { host: args.host });
}

export function trackFlightToggle(args: { enabled: boolean }) {
  track("flight_toggle", { enabled: args.enabled ? "on" : "off" });
}

export function trackListOpen() {
  track("list_open", {});
}
