// Admin-only: edit an Article's Notion properties from inside the
// portal. The portal calls this for any inline edit on an article row
// (title, excerpt, cover tint, hero image URL, status, tags). Notion
// stays the source of truth — this is just the write path so the user
// never has to leave the dashboard.
//
// Auth: same signed-cookie middleware as /portal.
//
// Body: {
//   id: string,                  // Notion page id
//   fields: {
//     title?: string,
//     excerpt?: string,
//     heroImageUrl?: string | null,   // pass null/"" to clear
//     coverTint?: "cyan" | "purple" | "pink" | "gold",
//     status?: "Draft" | "Ready" | "Hidden",
//     tags?: string[],
//     slug?: string,
//     author?: string,
//   }
// }
//
// Response: { ok: true } | { ok: false, error: string }
//
// IMPORTANT: this only writes property values. Article body edits (the
// long-form prose blocks) still happen in Notion — we'd need a full
// rich-text editor in the portal to handle those, which is its own
// project.

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { Client } from "@notionhq/client";
import { verifySession, SESSION_COOKIE } from "@/lib/portal-auth";
import { writeOverlay, ARTICLE_OVERLAY_TAG, type ArticleOverlay } from "@/lib/article-overlay";

export const runtime = "nodejs";

const ALLOWED_TINTS = new Set(["cyan", "purple", "pink", "gold"]);
const ALLOWED_STATUSES = new Set(["Draft", "Ready", "Hidden"]);

interface UpdateFields {
  title?: string;
  excerpt?: string;
  heroImageUrl?: string | null;
  coverTint?: string;
  status?: string;
  tags?: string[];
  slug?: string;
  author?: string;
  /** Optional — passed by the portal so we can revalidate the right
   *  path. If absent we revalidate the dynamic route catch-all instead. */
  __slugForRevalidate?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildNotionProperties(fields: UpdateFields): { props: Record<string, any>; error?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = {};

  if (typeof fields.title === "string") {
    const v = fields.title.trim();
    if (!v) return { props: {}, error: "title cannot be empty" };
    props.Title = { title: [{ text: { content: v } }] };
  }

  if (typeof fields.excerpt === "string") {
    props.Excerpt = { rich_text: [{ text: { content: fields.excerpt } }] };
  }

  if (typeof fields.slug === "string") {
    props.Slug = { rich_text: [{ text: { content: fields.slug.trim() } }] };
  }

  if (typeof fields.author === "string") {
    props.Author = { rich_text: [{ text: { content: fields.author.trim() } }] };
  }

  if (fields.heroImageUrl !== undefined) {
    // Notion validates URL format. Empty/null = clear the field.
    const v = fields.heroImageUrl?.trim?.() ?? "";
    if (v && !/^https?:\/\//i.test(v)) {
      return { props: {}, error: "heroImageUrl must start with http:// or https://" };
    }
    props["Hero Image URL"] = { url: v || null };
  }

  if (typeof fields.coverTint === "string") {
    if (!ALLOWED_TINTS.has(fields.coverTint)) {
      return { props: {}, error: `coverTint must be one of: ${[...ALLOWED_TINTS].join(", ")}` };
    }
    props["Cover Tint"] = { select: { name: fields.coverTint } };
  }

  if (typeof fields.status === "string") {
    if (!ALLOWED_STATUSES.has(fields.status)) {
      return { props: {}, error: `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}` };
    }
    props.Status = { select: { name: fields.status } };
  }

  if (Array.isArray(fields.tags)) {
    props.Tags = { multi_select: fields.tags.map((name) => ({ name })) };
  }

  return { props };
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
    return NextResponse.json({ ok: false, error: "NOTION_TOKEN not configured" }, { status: 500 });
  }

  let body: { id?: string; fields?: UpdateFields };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ ok: false, error: "fields required" }, { status: 400 });
  }

  const { props, error } = buildNotionProperties(body.fields);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  if (Object.keys(props).length === 0) {
    return NextResponse.json({ ok: false, error: "no recognized fields to update" }, { status: 400 });
  }

  try {
    const notion = new Client({ auth: token });
    await notion.pages.update({ page_id: id, properties: props });

    // Live overlay so the change is visible on the live site instantly
    // — no rebuild needed. Only writes the portal-editable subset.
    const overlay: ArticleOverlay = {};
    if (body.fields.title !== undefined) overlay.title = body.fields.title;
    if (body.fields.excerpt !== undefined) overlay.excerpt = body.fields.excerpt;
    if (body.fields.heroImageUrl !== undefined) overlay.heroImageUrl = body.fields.heroImageUrl;
    if (body.fields.coverTint !== undefined) overlay.coverTint = body.fields.coverTint;
    if (body.fields.tags !== undefined) overlay.tags = body.fields.tags;
    if (Object.keys(overlay).length > 0) {
      try {
        await writeOverlay(id, overlay);
      } catch (e) {
        // Overlay is best-effort. Notion already has the change; next
        // deploy will pick it up even if blob is offline.
        console.warn("[update-article] overlay write failed:", (e as Error)?.message);
      }
    }

    // Bust the cached overlay so the next page render reads fresh data.
    // Next 16 requires a profile arg — "max" gives stale-while-revalidate
    // (page stays instant; fresh data fills in on the next render after).
    revalidateTag(ARTICLE_OVERLAY_TAG, "max");
    revalidateTag(`${ARTICLE_OVERLAY_TAG}:${id}`, "max");
    revalidatePath("/articles");
    if (body.fields.__slugForRevalidate) {
      revalidatePath(`/article/${body.fields.__slugForRevalidate}`);
    } else {
      // Fall back to invalidating the whole dynamic segment if we
      // weren't told which slug to refresh.
      revalidatePath("/article/[slug]", "page");
    }

    return NextResponse.json({ ok: true, fieldsUpdated: Object.keys(props), liveUpdated: Object.keys(overlay).length > 0 });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
