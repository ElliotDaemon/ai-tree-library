// Admin-only: change a Library entry's Status. Used by the portal's
// inline Approve / Hide buttons so the curator can run the review queue
// without leaving the dashboard.
//
// Auth: same signed-cookie middleware that gates /portal. This route
// lives under /api/portal/* so portal-only access is enforced by
// middleware matcher.
//
// Body: { id: string, status: "Ready" | "Hidden" | "Needs Review" | "Submitted" }
// Response: { ok: true } or { ok: false, error: string }

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { verifySession, SESSION_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set(["Ready", "Hidden", "Needs Review", "Submitted", "New"]);

export async function POST(req: Request) {
  // Auth — same session cookie as /portal
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

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const status = (body.status ?? "").trim();
  if (!id || !status) {
    return NextResponse.json({ ok: false, error: "id and status required" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}` }, { status: 400 });
  }

  try {
    const notion = new Client({ auth: token });
    await notion.pages.update({
      page_id: id,
      properties: { Status: { select: { name: status } } },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
