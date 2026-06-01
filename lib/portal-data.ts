// Portal data fetcher. Returns everything the dashboard renders.
//
// Sources:
//   1. Notion (always): full Library + counts + full per-status lists
//   2. Notion (always): Articles count + list
//   3. Vercel Analytics REST (optional, needs VERCEL_TOKEN + IDs): visitor
//      totals + top tools/categories/pages + recent searches
//
// All lists return FULL data (every entry, not top-N) so the client UI
// can render expandable drilldowns + filterable tables. The page is
// cached server-side via Next.js revalidate so the heavy Notion paginate
// only runs once per cache window.

import { Client } from "@notionhq/client";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const LIBRARY_DS = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";

export interface DashboardEntry {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: string;
  pricing: string;
  rarity: string;
  source: string;
  createdAt: string;
  ageHours: number;
}

export interface DashboardArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  publishedDate: string | null;
  readingTimeMinutes: number;
}

export interface DashboardData {
  ok: boolean;
  generatedAt: string;
  notionOk: boolean;
  vercelOk: boolean;
  vercelDashboardUrl: string;
  statusCounts: { ready: number; submitted: number; needsReview: number; hidden: number; new: number; total: number };
  // FULL entry lists per status — used for portal drilldowns
  entries: {
    ready: DashboardEntry[];
    pendingReview: DashboardEntry[]; // Submitted + Needs Review + New, sorted newest first
    hidden: DashboardEntry[];
  };
  articles: {
    count: number;
    items: DashboardArticle[];
  };
  // Vercel Analytics (best-effort)
  visitors?: { day: number; week: number; month: number };
  topRoutes?: Array<{ route: string; views: number }>;
  topToolEvents?: Array<{ slug: string; name: string; views: number; clicks: number; ctr: number }>;
  topCategoryEvents?: Array<{ slug: string; name: string; views: number }>;
  topSearches?: string[];
  errors: string[];
}

// ---------- Notion helpers ----------

interface NotionRichText { plain_text?: string }
interface NotionTitle { plain_text?: string }
interface NotionSelect { name?: string }
interface NotionRow {
  id: string;
  created_time: string;
  properties: Record<string, {
    title?: NotionTitle[];
    rich_text?: NotionRichText[];
    select?: NotionSelect | null;
    url?: string;
  }>;
}

function getText(p: NotionRow["properties"][string] | undefined): string {
  if (!p) return "";
  const arr = (p.title ?? p.rich_text ?? []) as Array<NotionRichText | NotionTitle>;
  return arr.map((t) => t.plain_text ?? "").join("");
}

function getSelect(p: NotionRow["properties"][string] | undefined): string {
  return p?.select?.name ?? "";
}

function hoursAgo(iso: string): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3600_000);
}

// Slugify mirrors lib/slug.ts so portal links land on the same URLs the
// site renders. Kept inline to avoid runtime imports of lib/slug (which
// already exists but tree-shaking is finicky in edge runtime).
function slugify(s: string): string {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_/]/g, "")
    .replace(/[\s_/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fetchNotionData(): Promise<Partial<DashboardData>> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { notionOk: false, errors: ["NOTION_TOKEN not set"] };
  const notion = new Client({ auth: token });

  const statusCounts = { ready: 0, submitted: 0, needsReview: 0, hidden: 0, new: 0, total: 0 };
  const ready: DashboardEntry[] = [];
  const pendingReview: DashboardEntry[] = [];
  const hidden: DashboardEntry[] = [];

  try {
    let cursor: string | undefined;
    const allRows: NotionRow[] = [];
    do {
      const res = await notion.databases.query({
        database_id: LIBRARY_DS,
        start_cursor: cursor,
        page_size: 100,
      });
      allRows.push(...(res.results as unknown as NotionRow[]));
      cursor = res.has_more ? (res.next_cursor as string) : undefined;
    } while (cursor);

    for (const row of allRows) {
      const status = getSelect(row.properties.Status);
      const name = getText(row.properties.Name);
      const url = (row.properties.URL?.url ?? "").trim();
      const slugOverride = getText(row.properties["Slug Override"]);
      const slug = slugOverride ? slugify(slugOverride) : slugify(name);
      const pricing = getSelect(row.properties.Pricing) || "Unknown";
      const rarity = getSelect(row.properties.Rarity);
      const source = getText(row.properties.Source);
      const createdAt = row.created_time;
      const entry: DashboardEntry = {
        id: row.id,
        name,
        url,
        slug,
        status,
        pricing,
        rarity,
        source,
        createdAt,
        ageHours: hoursAgo(createdAt),
      };

      statusCounts.total++;
      switch (status) {
        case "Ready": statusCounts.ready++; ready.push(entry); break;
        case "Submitted": statusCounts.submitted++; pendingReview.push(entry); break;
        case "Needs Review": statusCounts.needsReview++; pendingReview.push(entry); break;
        case "Hidden": statusCounts.hidden++; hidden.push(entry); break;
        case "New": statusCounts.new++; pendingReview.push(entry); break;
        default: break;
      }
    }

    ready.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    pendingReview.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    hidden.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      notionOk: true,
      statusCounts,
      entries: { ready, pendingReview, hidden },
      errors: [],
    };
  } catch (e) {
    return {
      notionOk: false,
      statusCounts,
      entries: { ready, pendingReview, hidden },
      errors: [`Notion: ${(e as Error).message}`],
    };
  }
}

// ---------- Articles (from public/articles.json) ----------

async function fetchArticlesData(): Promise<{ count: number; items: DashboardArticle[] }> {
  try {
    const raw = await fs.readFile(join(process.cwd(), "public", "articles.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      articles?: Array<{
        id: string;
        title: string;
        slug: string;
        status: string;
        excerpt: string;
        publishedDate: string | null;
        readingTimeMinutes: number;
      }>;
    };
    const arr = parsed.articles ?? [];
    return {
      count: arr.length,
      items: arr.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        excerpt: a.excerpt,
        publishedDate: a.publishedDate,
        readingTimeMinutes: a.readingTimeMinutes,
      })),
    };
  } catch {
    return { count: 0, items: [] };
  }
}

// ---------- Vercel Analytics ----------

interface VercelAnalyticsResponse<T> { data?: T }
interface VercelTotalRow { value: number }
interface VercelPageRow { key: string; value: number }
interface VercelEventRow { name: string; props?: Record<string, string>; total: number }

async function vercelFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) return null;

  const qs = new URLSearchParams({ projectId, ...(teamId ? { teamId } : {}), ...params });
  try {
    const res = await fetch(`https://api.vercel.com${path}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as VercelAnalyticsResponse<T>;
    return json.data ?? (json as unknown as T);
  } catch {
    return null;
  }
}

async function fetchVercelData(): Promise<Partial<DashboardData>> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { vercelOk: false };

  const now = Date.now();
  const dayAgo = now - 24 * 3600_000;
  const weekAgo = now - 7 * 24 * 3600_000;
  const monthAgo = now - 28 * 24 * 3600_000;

  const [totalDay, totalWeek, totalMonth, pages, events] = await Promise.all([
    vercelFetch<VercelTotalRow[]>("/web/insights/totals", { from: String(dayAgo), to: String(now), event: "pageview" }),
    vercelFetch<VercelTotalRow[]>("/web/insights/totals", { from: String(weekAgo), to: String(now), event: "pageview" }),
    vercelFetch<VercelTotalRow[]>("/web/insights/totals", { from: String(monthAgo), to: String(now), event: "pageview" }),
    vercelFetch<VercelPageRow[]>("/web/insights/pages", { from: String(monthAgo), to: String(now) }),
    vercelFetch<VercelEventRow[]>("/web/insights/customEvents", { from: String(monthAgo), to: String(now) }),
  ]);

  const visitors = {
    day: totalDay?.[0]?.value ?? 0,
    week: totalWeek?.[0]?.value ?? 0,
    month: totalMonth?.[0]?.value ?? 0,
  };

  const topRoutes = pages
    ? pages.slice(0, 20).map((p) => ({ route: p.key, views: p.value }))
    : undefined;

  let topToolEvents: DashboardData["topToolEvents"] | undefined;
  let topCategoryEvents: DashboardData["topCategoryEvents"] | undefined;
  let topSearches: string[] | undefined;
  if (events) {
    const toolViews = new Map<string, { slug: string; name: string; count: number }>();
    const toolClicks = new Map<string, number>();
    const catViews = new Map<string, { slug: string; name: string; count: number }>();
    const searches = new Map<string, number>();
    for (const ev of events) {
      if (ev.name === "tool_view") {
        const slug = ev.props?.slug ?? "?";
        const name = ev.props?.name ?? slug;
        const cur = toolViews.get(slug) ?? { slug, name, count: 0 };
        cur.count += ev.total;
        toolViews.set(slug, cur);
      } else if (ev.name === "link_click" && ev.props?.source === "tool_page") {
        const slug = ev.props?.slug ?? "?";
        toolClicks.set(slug, (toolClicks.get(slug) ?? 0) + ev.total);
      } else if (ev.name === "category_view") {
        const slug = ev.props?.slug ?? "?";
        const name = ev.props?.name ?? slug;
        const cur = catViews.get(slug) ?? { slug, name, count: 0 };
        cur.count += ev.total;
        catViews.set(slug, cur);
      } else if (ev.name === "search_query") {
        const q = (ev.props?.q ?? "").toLowerCase().trim();
        if (q) searches.set(q, (searches.get(q) ?? 0) + ev.total);
      }
    }
    topToolEvents = [...toolViews.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((t) => {
        const clicks = toolClicks.get(t.slug) ?? 0;
        return {
          slug: t.slug,
          name: t.name,
          views: t.count,
          clicks,
          ctr: t.count > 0 ? clicks / t.count : 0,
        };
      });
    topCategoryEvents = [...catViews.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((c) => ({ slug: c.slug, name: c.name, views: c.count }));
    topSearches = [...searches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([q]) => q);
  }

  return {
    vercelOk: true,
    visitors,
    topRoutes,
    topToolEvents,
    topCategoryEvents,
    topSearches,
    errors: [],
  };
}

// ---------- Main ----------

export async function getDashboardData(): Promise<DashboardData> {
  const team = process.env.VERCEL_TEAM_SLUG || "eperus";
  const project = process.env.VERCEL_PROJECT_SLUG || "ai-tree-library";

  const [notionRes, articlesRes, vercelRes] = await Promise.all([
    fetchNotionData(),
    fetchArticlesData(),
    fetchVercelData(),
  ]);

  const errors: string[] = [];
  if (notionRes.errors) errors.push(...notionRes.errors);
  if (vercelRes.errors) errors.push(...vercelRes.errors);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    notionOk: !!notionRes.notionOk,
    vercelOk: !!vercelRes.vercelOk,
    vercelDashboardUrl: `https://vercel.com/${team}/${project}/analytics`,
    statusCounts: notionRes.statusCounts ?? { ready: 0, submitted: 0, needsReview: 0, hidden: 0, new: 0, total: 0 },
    entries: notionRes.entries ?? { ready: [], pendingReview: [], hidden: [] },
    articles: articlesRes,
    visitors: vercelRes.visitors,
    topRoutes: vercelRes.topRoutes,
    topToolEvents: vercelRes.topToolEvents,
    topCategoryEvents: vercelRes.topCategoryEvents,
    topSearches: vercelRes.topSearches,
    errors,
  };
}
