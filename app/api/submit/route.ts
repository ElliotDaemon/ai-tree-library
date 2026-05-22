// Public submission endpoint.
// POST /api/submit  { url, name?, note?, submitter?, email?, turnstileToken? }
//
// Pipeline:
//   1. Validate URL
//   2. (If TURNSTILE_SECRET_KEY set) verify Cloudflare Turnstile token
//   3. Dedupe against Notion Library (normalize hostname + path)
//   4. (If ANTHROPIC_API_KEY set) classify category + draft long description
//   5. POST to Notion Library DB with Status=Submitted, Source=submitter
//
// Always writes Status=Submitted — public submissions never auto-publish.

import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

const LIBRARY_DS = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";
const CATEGORIES_DS = "0f31f74d-5899-4402-a863-5725927d96cd";

export const runtime = "nodejs"; // Notion SDK uses node-fetch internals

interface SubmitBody {
  url?: string;
  name?: string;
  note?: string;
  submitter?: string;
  email?: string;
  turnstileToken?: string;
}

function normalizeUrl(u: string): string {
  try {
    const p = new URL(u);
    return `${p.protocol}//${p.host.replace(/^www\./, "").toLowerCase()}${p.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return (u || "").toLowerCase();
  }
}

function ensureProtocol(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not configured → skip
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "AITreeLibraryBot/1.0 (+https://aitreelibrary.com)" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return "";
    const buf = await res.text();
    return buf.slice(0, 8000);
  } catch {
    return "";
  }
}

interface ClassifyResult {
  name: string;
  description: string;
  longDescription: string;
  category: string;
  rarity: string;
  type: string;
}

async function classifyWithClaude(url: string, hint: { name?: string; note?: string }, pageText: string, topLevelCats: string[]): Promise<ClassifyResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const systemPrompt = `You classify tools/websites for the AI Tree Library — a curated 3D constellation of AI tools, design inspo, and creative resources.

Return STRICT JSON with these exact keys, no markdown fences:
{
  "name": "Short product/site name",
  "description": "One sentence, ~150 chars. Definitional. e.g. 'X is a Y that does Z, made by W.'",
  "longDescription": "2-3 short paragraphs, 200-350 words, factual and citable. Lead with the definitional sentence. Mention key capabilities, who uses it, and how it compares to similar tools. Avoid marketing fluff.",
  "category": "Pick ONE from the allowed list",
  "rarity": "One of: Legendary, Established, Rare, Hidden Gem",
  "type": "One of: Tool, Website, Inspiration, Resource"
}

Rarity guidance:
- Legendary: mainstream household-name tools (ChatGPT, Midjourney, Figma, Notion, Adobe)
- Established: well-known in their niche (Cursor, Suno, Mobbin, Krea)
- Rare: known to enthusiasts/insiders
- Hidden Gem: niche, recently-discovered, or unknown to most

Allowed categories: ${topLevelCats.join(", ")}`;

    const userPrompt = `URL: ${url}
${hint.name ? `Suggested name: ${hint.name}` : ""}
${hint.note ? `Submitter note: ${hint.note}` : ""}

Page excerpt (first 8KB):
${pageText.slice(0, 4500)}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
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
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as ClassifyResult;
    return parsed;
  } catch (e) {
    console.error("[submit] Claude classify failed:", e);
    return null;
  }
}

export async function POST(req: Request) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // ---- 1. Validate URL ----
  const rawUrl = ensureProtocol((body.url || "").trim());
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ ok: false, error: "Please enter a valid URL." }, { status: 400 });
  }
  const url = parsed.toString();
  const normalized = normalizeUrl(url);

  // ---- 2. Verify Turnstile (if configured) ----
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const tokenOk = await verifyTurnstile(body.turnstileToken || "", ip);
  if (!tokenOk) {
    return NextResponse.json({ ok: false, error: "Bot check failed. Please reload and try again." }, { status: 403 });
  }

  // ---- 3. Auth to Notion ----
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    console.error("[submit] NOTION_TOKEN not configured");
    return NextResponse.json({ ok: false, error: "Submissions are temporarily unavailable." }, { status: 503 });
  }
  const notion = new Client({ auth: notionToken });

  // ---- 4. Dedupe against existing Library URLs ----
  try {
    const existing = await notion.databases.query({
      database_id: LIBRARY_DS,
      filter: { property: "URL", url: { equals: url } },
      page_size: 1,
    });
    if (existing.results.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "Already in the library.",
        existing: true,
      }, { status: 409 });
    }
    // Also check the normalized variant (without trailing slash, www, etc.)
    const altUrl = parsed.host.startsWith("www.")
      ? url.replace("://www.", "://")
      : `${parsed.protocol}//www.${parsed.host}${parsed.pathname}${parsed.search}`;
    if (altUrl !== url) {
      const alt = await notion.databases.query({
        database_id: LIBRARY_DS,
        filter: { property: "URL", url: { equals: altUrl } },
        page_size: 1,
      });
      if (alt.results.length > 0) {
        return NextResponse.json({ ok: false, error: "Already in the library.", existing: true }, { status: 409 });
      }
    }
  } catch (e) {
    console.error("[submit] Notion dedupe query failed:", e);
    // Continue — don't block submission over a Notion read error
  }

  // ---- 5. Fetch top-level categories (for classification) ----
  let topLevelCatNames: string[] = [];
  let categoriesById: Record<string, { id: string; name: string }> = {};
  try {
    const catRes = await notion.databases.query({
      database_id: CATEGORIES_DS,
      filter: { property: "Is Top Level", checkbox: { equals: true } },
      page_size: 100,
    });
    for (const r of catRes.results) {
      const props = (r as { properties: Record<string, { title?: Array<{ plain_text: string }> }> }).properties;
      const name = props.Name?.title?.map((t) => t.plain_text).join("") ?? "";
      if (name) {
        topLevelCatNames.push(name);
        categoriesById[name] = { id: r.id, name };
      }
    }
  } catch (e) {
    console.error("[submit] Categories fetch failed:", e);
  }

  // ---- 6. Scrape + classify (best effort) ----
  const pageText = await fetchPageText(url);
  const classified = await classifyWithClaude(
    url,
    { name: body.name, note: body.note },
    pageText,
    topLevelCatNames
  );

  // ---- 7. Build the Notion page properties ----
  const finalName = (classified?.name || body.name || parsed.hostname.replace(/^www\./, "")).slice(0, 200);
  const finalDescription = (
    classified?.description ||
    body.note ||
    `Submitted by ${body.submitter || "anonymous"}`
  ).slice(0, 600);

  type RichText = { rich_text: Array<{ text: { content: string } }> };
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: finalName } }] },
    URL: { url },
    Status: { select: { name: "Submitted" } },
    Type: { select: { name: classified?.type || "Tool" } },
    Description: { rich_text: [{ text: { content: finalDescription } }] } as RichText,
    Source: { rich_text: [{ text: { content: body.submitter ? `@${body.submitter}` : "anonymous" } }] } as RichText,
  };

  if (classified?.longDescription) {
    (properties as Record<string, RichText>)["LongDescription"] = {
      rich_text: [{ text: { content: classified.longDescription.slice(0, 1900) } }],
    };
  }

  if (classified?.rarity) {
    properties["Rarity"] = { select: { name: matchRarity(classified.rarity) } };
  }

  if (classified?.category && categoriesById[classified.category]) {
    properties["Category"] = { relation: [{ id: categoriesById[classified.category].id }] };
  }

  // Submitter email kept in a different field if it exists; not exposed publicly.
  if (body.email && body.email.includes("@")) {
    (properties as Record<string, RichText>)["Submitter Email"] = {
      rich_text: [{ text: { content: body.email.slice(0, 200) } }],
    };
  }

  // ---- 8. Create the row ----
  try {
    await notion.pages.create({
      parent: { database_id: LIBRARY_DS },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
    });
  } catch (e) {
    // If a property like "Submitter Email" or "LongDescription" doesn't exist
    // on the DB, retry without the optional ones rather than failing.
    console.error("[submit] First create attempt failed, retrying minimal:", e);
    try {
      delete (properties as Record<string, unknown>)["Submitter Email"];
      delete (properties as Record<string, unknown>)["LongDescription"];
      delete (properties as Record<string, unknown>)["Rarity"];
      delete (properties as Record<string, unknown>)["Category"];
      delete (properties as Record<string, unknown>)["Type"];
      await notion.pages.create({
        parent: { database_id: LIBRARY_DS },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      });
    } catch (e2) {
      console.error("[submit] Retry also failed:", e2);
      return NextResponse.json({ ok: false, error: "Couldn't save your submission. Please try again later." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: classified
      ? "Thanks! It's been auto-classified and is in the review queue."
      : "Thanks! It's in the review queue.",
    host: parsed.hostname.replace(/^www\./, ""),
    classified: !!classified,
  });

  void normalized;
}

function matchRarity(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("legend")) return "👑 Legendary";
  if (r.includes("estab")) return "⭐ Established";
  if (r.includes("hidden") || r.includes("gem")) return "🌟 Hidden Gem";
  if (r.includes("rare")) return "💎 Rare";
  return "⭐ Established";
}
