// Admin-only: upload an article hero image to Vercel Blob storage and
// return the public URL. The portal calls this when the user drops a
// file into the hero-image editor; the resulting URL is then saved to
// Notion's "Hero Image URL" field via /api/portal/update-article.
//
// Auth: same signed-cookie middleware as /portal.
//
// Request: multipart/form-data with one field:
//   file: the image blob (jpg / png / webp / avif / gif, ≤ 8MB)
// Optional form fields:
//   slug: article slug — used to namespace the blob path
//
// Response: { ok: true, url: string } | { ok: false, error: string }
//
// Env: requires BLOB_READ_WRITE_TOKEN. The token is created on the
// Vercel dashboard (Storage → Blob → Create store) and is auto-exposed
// to the deployment. For local development, copy it from Vercel CLI
// (`vercel env pull`) — without it, the route returns a clear error.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { verifySession, SESSION_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "article";
}

function extFromType(type: string): string {
  switch (type) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/avif": return "avif";
    case "image/gif": return "gif";
    default: return "bin";
  }
}

export async function POST(req: Request) {
  // Auth gate
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const session = sessionMatch?.[1];
  if (!(await verifySession(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Blob storage isn't configured. Create a Blob store in the Vercel dashboard (Storage → Blob) and BLOB_READ_WRITE_TOKEN will be auto-injected. URL paste still works without it.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "file field required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: `unsupported type ${file.type || "(unknown)"} — use jpg/png/webp/avif/gif` },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `file too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
  }

  const slugField = (form.get("slug") ?? "") as string;
  const slug = safeSlug(slugField || "article");
  const ext = extFromType(file.type);
  // Namespaced path so different articles' uploads don't collide and
  // the most recent upload always wins per article. Random suffix on
  // top in case the same slug is uploaded multiple times — Notion only
  // keeps the latest URL pointer anyway.
  const stamp = Date.now().toString(36);
  const path = `article-hero/${slug}/${stamp}.${ext}`;

  try {
    const result = await put(path, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
