// Admin-only: commit a new tool to the Library DB in Notion. Called
// after the portal user reviews/edits the preview from /preview-tool.
//
// Auth: signed-cookie session like the other portal endpoints.
//
// Body: {
//   url: string,                  // required, must be valid http(s)
//   name: string,                 // required, what users see in the dock
//   description: string,          // 1-2 sentence summary
//   longDescription?: string,     // 200-350 word factual write-up
//   category?: string,            // category page id (relation target)
//   rarity?: "Legendary"|"Established"|"Rare"|"Hidden Gem",
//   type?: "Tool"|"Website"|"Inspiration"|"Resource",
//   pricing?: "Free"|"Freemium"|"Paid"|"Unknown",
//   status?: "Ready"|"Needs Review"|"Hidden",   // default Ready (admin)
//   source?: string,              // who added it — default "admin"
// }
//
// Response: { ok: true, id, url, slug, name } | { ok: false, error }
//
// Live updates: the new tool shows up on the live site after the next
// rebuild (so the constellation re-flows around it). The Library-list
// pages are likely served from the baked library.json — we'll wire a
// deploy hook later if real-time is needed.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Client } from "@notionhq/client";
import { verifySession, SESSION_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

const LIBRARY_DB = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";

const ALLOWED_RARITY = new Set(["Legendary", "Established", "Rare", "Hidden Gem"]);
const ALLOWED_TYPE = new Set(["Tool", "Website", "Inspiration", "Resource"]);
const ALLOWED_PRICING = new Set(["Free", "Freemium", "Paid", "Unknown"]);
const ALLOWED_STATUS = new Set(["Ready", "Needs Review", "Hidden", "Submitted"]);

interface AddBody {
  url?: string;
  name?: string;
  description?: string;
  longDescription?: string;
  category?: string; // page id (relation)
  rarity?: string;
  type?: string;
  pricing?: string;
  status?: string;
  source?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

  let body: AddBody;
  try {
    body = (await req.json()) as AddBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Validate
  const rawUrl = (body.url ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false, error: "Valid http(s) URL required" }, { status: 400 });
  }
  const url = parsed.toString();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
  }

  const status = body.status && ALLOWED_STATUS.has(body.status) ? body.status : "Ready";
  const rarity = body.rarity && ALLOWED_RARITY.has(body.rarity) ? body.rarity : null;
  const type = body.type && ALLOWED_TYPE.has(body.type) ? body.type : "Tool";
  const pricing = body.pricing && ALLOWED_PRICING.has(body.pricing) ? body.pricing : null;

  const notion = new Client({ auth: token });

  // Dedupe again at commit time (preview may have been from a while ago)
  try {
    const dup = await notion.databases.query({
      database_id: LIBRARY_DB,
      filter: { property: "URL", url: { equals: url } },
      page_size: 1,
    });
    if (dup.results.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Already in the Library", existing: dup.results[0].id },
        { status: 409 },
      );
    }
  } catch (e) {
    console.warn("[add-tool] dedupe failed:", (e as Error).message);
    // Don't block on dedupe failure — Notion might be flaky for a sec.
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: name.slice(0, 200) } }] },
    URL: { url },
    Status: { select: { name: status } },
    Type: { select: { name: type } },
    Description: {
      rich_text: [{ text: { content: (body.description ?? "").slice(0, 600) } }],
    },
    Source: {
      rich_text: [{ text: { content: body.source?.trim() || "admin" } }],
    },
  };

  if (body.longDescription) {
    properties.LongDescription = {
      rich_text: [{ text: { content: body.longDescription.slice(0, 1900) } }],
    };
  }
  if (rarity) properties.Rarity = { select: { name: rarity } };
  if (pricing) properties.Pricing = { select: { name: pricing } };
  if (body.category) properties.Category = { relation: [{ id: body.category }] };

  let pageId: string;
  try {
    const created = await notion.pages.create({
      parent: { database_id: LIBRARY_DB },
      properties,
    });
    pageId = created.id;
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    // Retry without optional properties in case the DB lacks one
    console.warn("[add-tool] full create failed, retrying minimal:", msg);
    try {
      const minimal = {
        Name: properties.Name,
        URL: properties.URL,
        Status: properties.Status,
        Description: properties.Description,
        Source: properties.Source,
      };
      const created = await notion.pages.create({
        parent: { database_id: LIBRARY_DB },
        properties: minimal,
      });
      pageId = created.id;
    } catch (e2) {
      const msg2 = (e2 as Error)?.message || String(e2);
      console.error("[add-tool] minimal create also failed:", msg2);
      return NextResponse.json({ ok: false, error: msg2 }, { status: 500 });
    }
  }

  // Best-effort revalidation — the dock + library scene reads from a
  // build-time JSON file, so the new entry won't show up until the
  // next deploy. The pending kanban item #9 (Notion → Vercel deploy
  // hook) would fully close this loop.
  try {
    revalidatePath("/library");
    revalidatePath("/");
  } catch {
    // Non-fatal.
  }

  const slug = slugify(name);
  return NextResponse.json({
    ok: true,
    id: pageId,
    url,
    slug,
    name,
    note:
      status === "Ready"
        ? "Added as Status=Ready. The new entry will appear on the live constellation after the next deploy."
        : `Added as Status=${status}.`,
  });
}
