// Portal data fetcher — pulls everything for the dashboard.
//
// Sources:
//   1. Notion API (always works, NOTION_TOKEN required)
//      - Library counts grouped by Status
//      - Recent pending submissions
//      - Recent Ready entries
//   2. Vercel Web Analytics REST API (optional — needs VERCEL_TOKEN +
//      VERCEL_PROJECT_ID + VERCEL_TEAM_ID env vars). If unavailable, the
//      dashboard renders without those sections and links to the Vercel
//      dashboard instead.

import { Client } from "@notionhq/client";

const LIBRARY_DS = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";

export interface DashboardData {
  ok: boolean;
  generatedAt: string;
  notionOk: boolean;
  vercelOk: boolean;
  vercelDashboardUrl: string;
  // Counts
  statusCounts: { ready: number; submitted: number; needsReview: number; hidden: number; total: number };
  // Lists
  pendingSubmissions: Array<{
    id: string;
    name: string;
    url: string;
    source: string;
    ageHours: number;
    createdAt: string;
  }>;
  recentReady: Array<{
    id: string;
    name: string;
    url: string;
    createdAt: string;
    ageHours: number;
    rarity: string;
  }>;
  // Vercel Analytics (best-effort)
  visitors?: { day: number; week: number; month: number };
  topRoutes?: Array<{ route: string; views: number }>;
  topToolEvents?: Array<{ slug: string; name: string; views: number; clicks: number; ctr: number }>;
  topCategoryEvents?: Array<{ slug: string; name: string; views: number }>;
  topSearches?: string[];
  errors: string[];
}

interface NotionRichText { plain_text?: string }
interface NotionTitle { plain_text?: string }
interface NotionSelect { name?: string }
interface NotionUrl { url?: string }
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

async function fetchNotionData(): Promise<Partial<DashboardData>> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { notionOk: false, errors: ["NOTION_TOKEN not set"] };
  const notion = new Client({ auth: token });

  const statusCounts = { ready: 0, submitted: 0, needsReview: 0, hidden: 0, total: 0 };
  const pendingSubmissions: DashboardData["pendingSubmissions"] = [];
  const recentReady: DashboardData["recentReady"] = [];

  try {
    // Paginate the full Library to count statuses. ~500 rows is fast.
    let cursor: string | undefined;
    const allRows: NotionRow[] = [];
    do {
      const res = await notion.databases.query({
        database_id: LIBRARY_DS,
        start_cursor: cursor,
        page_size: 100,
      });
      for (const r of res.results) {
        if ("properties" in r) allRows.push(r as unknown as NotionRow);
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    statusCounts.total = allRows.length;

    for (const r of allRows) {
      const status = getSelect(r.properties.Status);
      if (status === "Ready") statusCounts.ready++;
      else if (status === "Submitted") statusCounts.submitted++;
      else if (status === "Needs Review") statusCounts.needsReview++;
      else if (status === "Hidden") statusCounts.hidden++;
    }

    // Pending submissions = Submitted, newest first
    const submitted = allRows
      .filter((r) => getSelect(r.properties.Status) === "Submitted")
      .sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())
      .slice(0, 10);

    for (const r of submitted) {
      pendingSubmissions.push({
        id: r.id,
        name: getText(r.properties.Name) || new URL(r.properties.URL?.url || "https://x").hostname,
        url: r.properties.URL?.url ?? "",
        source: getText(r.properties.Source) || "anonymous",
        createdAt: r.created_time,
        ageHours: hoursAgo(r.created_time),
      });
    }

    // Recent Ready = newest 10 by created_time
    const ready = allRows
      .filter((r) => getSelect(r.properties.Status) === "Ready")
      .sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())
      .slice(0, 10);
    for (const r of ready) {
      recentReady.push({
        id: r.id,
        name: getText(r.properties.Name),
        url: r.properties.URL?.url ?? "",
        createdAt: r.created_time,
        ageHours: hoursAgo(r.created_time),
        rarity: getSelect(r.properties.Rarity) || "",
      });
    }

    return { notionOk: true, statusCounts, pendingSubmissions, recentReady };
  } catch (e) {
    return {
      notionOk: false,
      statusCounts,
      pendingSubmissions,
      recentReady,
      errors: [`Notion: ${(e as Error).message}`],
    };
  }
}

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

  const errors: string[] = [];

  // Best-effort: call several Vercel analytics endpoints in parallel. Each
  // returns null on failure so partial data is fine.
  const [
    totalDay,
    totalWeek,
    totalMonth,
    pages,
    events,
  ] = await Promise.all([
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
    ? pages.slice(0, 10).map((p) => ({ route: p.key, views: p.value }))
    : undefined;

  // Custom event aggregation: group tool_view + link_click by slug
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
      .slice(0, 10)
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
      .slice(0, 10)
      .map((c) => ({ slug: c.slug, name: c.name, views: c.count }));
    topSearches = [...searches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([q]) => q);
  }

  return {
    vercelOk: true,
    visitors,
    topRoutes,
    topToolEvents,
    topCategoryEvents,
    topSearches,
    errors,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const team = process.env.VERCEL_TEAM_SLUG || "eperus";
  const project = process.env.VERCEL_PROJECT_SLUG || "ai-tree-library";

  const [notionRes, vercelRes] = await Promise.all([fetchNotionData(), fetchVercelData()]);

  const errors: string[] = [];
  if (notionRes.errors) errors.push(...notionRes.errors);
  if (vercelRes.errors) errors.push(...vercelRes.errors);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    notionOk: !!notionRes.notionOk,
    vercelOk: !!vercelRes.vercelOk,
    vercelDashboardUrl: `https://vercel.com/${team}/${project}/analytics`,
    statusCounts: notionRes.statusCounts ?? { ready: 0, submitted: 0, needsReview: 0, hidden: 0, total: 0 },
    pendingSubmissions: notionRes.pendingSubmissions ?? [],
    recentReady: notionRes.recentReady ?? [],
    visitors: vercelRes.visitors,
    topRoutes: vercelRes.topRoutes,
    topToolEvents: vercelRes.topToolEvents,
    topCategoryEvents: vercelRes.topCategoryEvents,
    topSearches: vercelRes.topSearches,
    errors,
  };
}
