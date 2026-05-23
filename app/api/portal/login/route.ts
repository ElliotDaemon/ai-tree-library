// POST /api/portal/login
//
// Form-encoded body: { username, password, from? }
// On success: sets the signed httpOnly session cookie and 303-redirects to
// `from` (or /portal). On failure: 303-redirects back to /portal/login with
// ?error=1 (and the original ?from= preserved) so the browser doesn't
// resubmit the form on refresh.
//
// Uses 303 See Other for the post-success redirect specifically to convert
// the POST into a GET — that's the canonical pattern for "form-submitted,
// now go look at this other page."

import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSession,
  verifyCredentials,
} from "@/lib/portal-auth";

// Edge runtime is fine — portal-auth uses Web Crypto only
export const runtime = "edge";

function safeReturn(from: string | null | undefined): string {
  if (!from) return "/portal";
  if (!from.startsWith("/") || from.startsWith("//")) return "/portal";
  return from;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const from = safeReturn(form.get("from") as string | null);

  if (!verifyCredentials(username, password)) {
    // Small artificial delay to slow credential-stuffing attempts
    await new Promise((r) => setTimeout(r, 800));
    const login = new URL("/portal/login", req.url);
    if (from !== "/portal") login.searchParams.set("from", from);
    login.searchParams.set("error", "1");
    return NextResponse.redirect(login, { status: 303 });
  }

  const session = await signSession();
  const target = new URL(from, req.url);
  const res = NextResponse.redirect(target, { status: 303 });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });
  return res;
}
