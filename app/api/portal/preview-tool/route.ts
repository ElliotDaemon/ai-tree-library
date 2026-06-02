// Admin-only: preview what would get added to the Library for a given
// URL — scrape the target page, extract title/description/og:image,
// and (if Claude is configured) classify category + draft long
// description. Returns the suggested fields so the portal can show a
// preview the user can edit before committing via /add-tool.
//
// Auth: signed-cookie session like the other portal endpoints.
//
// Body: { url: string }
// Response: {
//   ok: true,
//   suggestion: {
//     name, description, longDescription,
//     category, rarity, type, pricing,
//     ogImage, hostname,
//     allCategories: [{ id, name }],   // for the dropdown
//   },
//   existing?: { id, name, status }    // if URL is already in Library
// }

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { verifySession, SESSION_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const maxDuration = 30; // page fetch + Claude call can take >10s

const LIBRARY_DB = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";
const CATEGORIES_DB = "0f31f74d-5899-4402-a863-5725927d96cd";

function ensureProtocol(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

async function fetchPageMeta(url: string): Promise<{
  title: string;
  description: string;
  ogImage: string;
  body: string;
}> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; AITreeLibraryBot/1.0; +https://aitreelibrary.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return { title: "", description: "", ogImage: "", body: "" };
    const html = (await res.text()).slice(0, 80_000);

    // Quick-and-dirty extractors — good enough for AI classification.
    const titleMatch =
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<title[^>]*>([^<]+)</i);
    const descMatch =
      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const ogMatch = html.match(
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    );

    // Strip scripts/styles for the body extract (sent to Claude)
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);

    let ogImage = ogMatch?.[1] ?? "";
    // Resolve relative og:image against page URL
    if (ogImage && !/^https?:\/\//i.test(ogImage)) {
      try {
        ogImage = new URL(ogImage, url).toString();
      } catch {
        ogImage = "";
      }
    }

    return {
      title: (titleMatch?.[1] ?? "").trim().slice(0, 200),
      description: (descMatch?.[1] ?? "").trim().slice(0, 400),
      ogImage,
      body,
    };
  } catch {
    return { title: "", description: "", ogImage: "", body: "" };
  }
}

interface Classified {
  name: string;
  description: string;
  longDescription: string;
  category: string;
  rarity: "Legendary" | "Established" | "Rare" | "Hidden Gem";
  type: "Tool" | "Website" | "Inspiration" | "Resource";
  pricing: "Free" | "Freemium" | "Paid" | "Unknown";
}

async function classifyWithClaude(
  url: string,
  meta: { title: string; description: string; body: string },
  topLevelCats: string[],
): Promise<Classified | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You classify AI tools and creative resources for the AI Tree Library — a curated 3D constellation of AI tools, design inspo, and creative resources.

Return STRICT JSON, no markdown fences:
{
  "name": "Short product/site name",
  "description": "One sentence, ~150 chars. Definitional. e.g. 'X is a Y that does Z, made by W.'",
  "longDescription": "2-3 short paragraphs, 200-350 words, factual and citable. Lead with the definitional sentence. Mention key capabilities, who uses it, and how it compares to similar tools. Avoid marketing fluff.",
  "category": "Pick ONE from the allowed list",
  "rarity": "One of: Legendary, Established, Rare, Hidden Gem",
  "type": "One of: Tool, Website, Inspiration, Resource",
  "pricing": "One of: Free, Freemium, Paid, Unknown"
}

Rarity guidance:
- Legendary: household-name tools (ChatGPT, Midjourney, Figma, Notion, Adobe)
- Established: well-known in their niche (Cursor, Suno, Mobbin, Krea)
- Rare: known to enthusiasts/insiders
- Hidden Gem: niche, recently-discovered, or unknown to most

Allowed categories: ${topLevelCats.join(", ")}`;

  const userPrompt = `URL: ${url}
Title from page: ${meta.title}
Meta description: ${meta.description}

Page text excerpt:
${meta.body}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as Classified;
  } catch (e) {
    console.warn("[preview-tool] Claude classify failed:", (e as Error).message);
    return null;
  }
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const session = sessionMatch?.[1];
  if (!(await verifySession(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "NOTION_TOKEN not configured" },
      { status: 500 },
    );
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const rawUrl = ensureProtocol((body.url ?? "").trim());
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false, error: "Enter a valid URL" }, { status: 400 });
  }
  const url = parsed.toString();
  const hostname = parsed.hostname.replace(/^www\./, "");

  const notion = new Client({ auth: token });

  // ---- Check for existing entry first
  let existing: { id: string; name: string; status: string } | null = null;
  try {
    const dup = await notion.databases.query({
      database_id: LIBRARY_DB,
      filter: { property: "URL", url: { equals: url } },
      page_size: 1,
    });
    if (dup.results.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = dup.results[0];
      existing = {
        id: r.id,
        name: r.properties?.Name?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "",
        status: r.properties?.Status?.select?.name ?? "",
      };
    }
  } catch (e) {
    console.warn("[preview-tool] dedupe query failed:", (e as Error).message);
  }

  // ---- Categories (for dropdown + classification context)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCategories: Array<{ id: string; name: string }> = [];
  const topLevelNames: string[] = [];
  try {
    const cats = await notion.databases.query({
      database_id: CATEGORIES_DB,
      page_size: 100,
    });
    for (const r of cats.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rr: any = r;
      const name =
        rr.properties?.Name?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "";
      const isTop = !!rr.properties?.["Is Top Level"]?.checkbox;
      if (name) {
        allCategories.push({ id: rr.id, name });
        if (isTop) topLevelNames.push(name);
      }
    }
  } catch (e) {
    console.warn("[preview-tool] categories fetch failed:", (e as Error).message);
  }
  allCategories.sort((a, b) => a.name.localeCompare(b.name));

  // ---- Scrape page + classify
  const meta = await fetchPageMeta(url);
  const classified = await classifyWithClaude(url, meta, topLevelNames);

  const suggestion = {
    name: classified?.name || meta.title || hostname,
    description: classified?.description || meta.description || "",
    longDescription: classified?.longDescription || "",
    category: classified?.category || "",
    rarity: classified?.rarity || "Established",
    type: classified?.type || "Tool",
    pricing: classified?.pricing || "Unknown",
    ogImage: meta.ogImage,
    hostname,
    url,
    allCategories,
    aiUsed: !!classified,
  };

  return NextResponse.json({ ok: true, suggestion, existing });
}
