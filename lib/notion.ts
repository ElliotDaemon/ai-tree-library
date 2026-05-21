/**
 * Notion client + typed data fetchers for the AI Tree Library.
 *
 * Library and Categories DBs live under the user's 🌌 AI TREE LIBRARY project
 * page in the 11:11 COMMAND CENTER workspace.
 *
 * Usage:
 *   - At build time: scripts/fetch-content.mjs uses these to pull rows.
 *   - At runtime (serverless): /api/classify uses these to write new rows.
 */

import { Client } from "@notionhq/client";

export const NOTION_DB = {
  LIBRARY: "63c6ed32-e30a-454f-9f66-dc353aeb54c6", // database page id
  CATEGORIES: "0f31f74d-5899-4402-a863-5725927d96cd", // database page id
} as const;

export type LibraryStatus =
  | "New"
  | "Classifying"
  | "Ready"
  | "Needs Review"
  | "Submitted"
  | "Hidden";

export type LibraryType = "Tool" | "Website" | "Inspiration" | "Resource";

export type Pricing =
  | "Free"
  | "Freemium"
  | "Paid"
  | "Pay per use"
  | "Subscription"
  | "N/A"
  | "Unknown"
  | "Varies";

export interface LibraryEntry {
  id: string;
  name: string;
  url: string;
  type: LibraryType;
  description: string;
  categoryId: string | null; // page id of the Categories row this entry belongs to
  tags: string[];
  pricing: Pricing;
  featured: boolean;
  gem: boolean;
  status: LibraryStatus;
  confidence: number | null;
  aiNotes: string;
  logoUrl: string;
  screenshotUrl: string;
  source: string;
  created: string;
}

export interface CategoryEntry {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  description: string;
  parentName: string;
  isTopLevel: boolean;
  displayOrder: number;
  v1ToolCount: number;
}

export function notionClient(): Client {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error(
      "NOTION_TOKEN is required. Add it to .env.local for local dev, or to Vercel env for production builds."
    );
  }
  return new Client({ auth: token });
}

// Extract a plain string from a Notion title/rich_text property
function plainText(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as { title?: Array<{ plain_text: string }>; rich_text?: Array<{ plain_text: string }> };
  const arr = p.title ?? p.rich_text ?? [];
  return arr.map((t) => t.plain_text).join("");
}

function selectName(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as { select?: { name: string } | null };
  return p.select?.name ?? "";
}

function multiSelectNames(prop: unknown): string[] {
  if (!prop || typeof prop !== "object") return [];
  const p = prop as { multi_select?: Array<{ name: string }> };
  return (p.multi_select ?? []).map((t) => t.name);
}

function checkbox(prop: unknown): boolean {
  if (!prop || typeof prop !== "object") return false;
  return (prop as { checkbox?: boolean }).checkbox ?? false;
}

function number(prop: unknown): number | null {
  if (!prop || typeof prop !== "object") return null;
  return (prop as { number?: number | null }).number ?? null;
}

function url(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  return (prop as { url?: string | null }).url ?? "";
}

function relationFirstId(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as { relation?: Array<{ id: string }> };
  return p.relation?.[0]?.id ?? null;
}

function createdTime(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  return (prop as { created_time?: string }).created_time ?? "";
}

/**
 * Fetch every page from a Notion data source, paging through all results.
 */
async function fetchAllPages(
  client: Client,
  dataSourceId: string,
  filter?: Record<string, unknown>
) {
  const pages: Array<{ id: string; properties: Record<string, unknown> }> = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await client.databases.query({
      database_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      filter: filter as never,
    });
    for (const result of response.results) {
      if ("properties" in result) {
        pages.push({
          id: result.id,
          properties: result.properties as unknown as Record<string, unknown>,
        });
      }
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

export async function fetchAllCategories(client?: Client): Promise<CategoryEntry[]> {
  const c = client ?? notionClient();
  const pages = await fetchAllPages(c, NOTION_DB.CATEGORIES);
  return pages.map((p) => ({
    id: p.id,
    name: plainText(p.properties.Name),
    slug: plainText(p.properties.Slug),
    color: plainText(p.properties.Color),
    icon: plainText(p.properties.Icon),
    description: plainText(p.properties.Description),
    parentName: plainText(p.properties.Parent),
    isTopLevel: checkbox(p.properties["Is Top Level"]),
    displayOrder: number(p.properties["Display Order"]) ?? 999,
    v1ToolCount: number(p.properties["V1 Tool Count"]) ?? 0,
  }));
}

export async function fetchReadyLibrary(client?: Client): Promise<LibraryEntry[]> {
  const c = client ?? notionClient();
  const pages = await fetchAllPages(c, NOTION_DB.LIBRARY, {
    property: "Status",
    select: { equals: "Ready" },
  });
  return pages.map(toLibraryEntry);
}

function toLibraryEntry(p: { id: string; properties: Record<string, unknown> }): LibraryEntry {
  return {
    id: p.id,
    name: plainText(p.properties.Name),
    url: url(p.properties.URL),
    type: (selectName(p.properties.Type) as LibraryType) || "Tool",
    description: plainText(p.properties.Description),
    categoryId: relationFirstId(p.properties.Category),
    tags: multiSelectNames(p.properties.Tags),
    pricing: (selectName(p.properties.Pricing) as Pricing) || "Unknown",
    featured: checkbox(p.properties.Featured),
    gem: checkbox(p.properties.Gem),
    status: (selectName(p.properties.Status) as LibraryStatus) || "New",
    confidence: number(p.properties.Confidence),
    aiNotes: plainText(p.properties["AI Notes"]),
    logoUrl: url(p.properties["Logo URL"]),
    screenshotUrl: url(p.properties["Screenshot URL"]),
    source: plainText(p.properties.Source),
    created: createdTime(p.properties.Added) || "",
  };
}
