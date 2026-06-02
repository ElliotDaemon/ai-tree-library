// Admin-only: issue a short-lived client token so the portal's hero-
// image editor can upload directly from the browser to Vercel Blob.
// The browser POSTs to this route to *get the token*, then uploads
// straight to Blob storage — bypassing the 4.5 MB serverless body
// limit that would reject large hero images.
//
// Flow:
//   1. Portal calls `upload(pathname, file, { handleUploadUrl: this })`
//   2. @vercel/blob/client POSTs a JSON body here asking for a token
//   3. This route's `handleUpload` verifies auth, generates a token
//      scoped to the pathname + content-type, returns it
//   4. Browser uploads directly to Vercel Blob using the token
//   5. Blob calls back to this route once the upload is committed
//      (onUploadCompleted) — we don't need to do anything there
//
// Auth: same signed-cookie middleware that gates /portal. The cookie
// rides along with the token-issuance request from the browser.

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifySession, SESSION_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

export async function POST(req: Request): Promise<NextResponse> {
  // Auth gate — same session cookie as /portal
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
          "Blob storage isn't configured. Create a Blob store in the Vercel dashboard (Storage → Blob) — BLOB_READ_WRITE_TOKEN will be auto-injected.",
      },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        // Pathname comes from the client; we've already auth-gated the
        // route, so the caller is trusted. Lock down content types +
        // size in the token so the browser can't swap to e.g. an exe.
        return {
          allowedContentTypes: ALLOWED_TYPES,
          // 16 MB — generous ceiling for hero images. Real photo files
          // are usually 1-4 MB. Anything bigger is suspicious.
          maximumSizeInBytes: 16 * 1024 * 1024,
          // Random suffix avoids cache-poisoning when the same article
          // gets multiple uploads (latest URL written to Notion wins).
          addRandomSuffix: true,
          // Token TTL — 30 min is plenty to upload a single image even
          // on a slow connection.
          validUntil: Date.now() + 30 * 60_000,
          // Pin the pathname so the client can't smuggle a different
          // one between requesting the token and uploading.
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async () => {
        // No-op — the client already gets the final URL and writes
        // it to Notion via /api/portal/update-article. We keep this
        // handler defined because @vercel/blob requires it.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
