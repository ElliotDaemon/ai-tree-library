// POST /api/portal/login
//
// Form-encoded body: { username, password, from? }
// On success: sets the signed httpOnly session cookie and 303-redirects to
// `from` (or /portal). On failure: 303-redirects back to /portal/login with
// ?error=1 (and the original ?from= preserved) so the browser doesn't
// resubmit the form on refresh.
//
// Hardening:
//   - Rate-limit failed attempts per IP (5 / 15 min → 15 min lock)
//   - Constant-time credential comparison (via verifyCredentials)
//   - Generic "invalid credentials" — never reveal which half is wrong
//   - 800ms artificial delay on failure to slow timing-based probes
//   - httpOnly + secure + sameSite=strict cookie
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
import { hitRateLimit, clearRateLimit } from "@/lib/rate-limit";

// Use Node runtime so the in-memory rate limiter survives across
// requests on a warm instance. (Edge instance lifetimes are shorter,
// limit state would reset more often — not catastrophic but weaker.)
export const runtime = "nodejs";

// Brute-force gate: 5 failed attempts per 15 min per IP → 15 min lock.
// Single admin uses this; legit typos won't trigger it, but
// credential stuffing will be slowed to ~20 attempts/hour.
const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

function safeReturn(from: string | null | undefined): string {
  if (!from) return "/portal";
  if (!from.startsWith("/") || from.startsWith("//")) return "/portal";
  return from;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limitKey = `login:${ip}`;

  // Check the rate limit BEFORE parsing the body so a flood of empty
  // requests still trips the lock.
  const limit = hitRateLimit(limitKey, LOGIN_LIMIT);
  if (!limit.allowed) {
    const retryMin = Math.ceil(limit.retryAfterMs / 60_000);
    const login = new URL("/portal/login", req.url);
    login.searchParams.set("error", "locked");
    login.searchParams.set("retry", String(retryMin));
    return NextResponse.redirect(login, { status: 303 });
  }

  const form = await req.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const from = safeReturn(form.get("from") as string | null);

  if (!verifyCredentials(username, password)) {
    // Small artificial delay to slow credential-stuffing attempts even
    // before the rate-limit kicks in.
    await new Promise((r) => setTimeout(r, 800));
    const login = new URL("/portal/login", req.url);
    if (from !== "/portal") login.searchParams.set("from", from);
    login.searchParams.set("error", "1");
    return NextResponse.redirect(login, { status: 303 });
  }

  // Successful auth — clear the rate-limit bucket so the user isn't
  // locked out by previous typos.
  clearRateLimit(limitKey);

  const session = await signSession();
  const target = new URL(from, req.url);
  const res = NextResponse.redirect(target, { status: 303 });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    // strict not lax: this is an admin cookie that never needs to ride
    // along on cross-site navigation. Strict blocks CSRF entirely.
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });
  return res;
}
