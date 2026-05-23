// Auth gate for /portal.
//
// Replaces the old query-string-token flow with proper username/password
// auth that integrates cleanly with password managers (Proton Pass, 1Password,
// Bitwarden, browser keychain). The gate uses an httpOnly HMAC-signed
// session cookie set by /api/portal/login.
//
// Fail-closed in production: if ADMIN_PASSWORD is missing on a production
// deploy, /portal returns 403 with setup instructions. Only true localhost
// dev gets open access for testing.
//
// /portal/login is the only path under /portal that bypasses the cookie
// check — otherwise nobody could ever log in.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminConfigured, verifySession, SESSION_COOKIE } from "@/lib/portal-auth";

const FORBIDDEN_HTML = (msg: string) =>
  `<!doctype html><html><head><title>Portal — AI Tree Library</title>
<meta name="robots" content="noindex, nofollow" />
<style>
body{font-family:system-ui;background:#030508;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem;box-sizing:border-box;}
.card{padding:2.4rem 2.6rem;border:1px solid rgba(0,243,255,0.3);border-radius:14px;background:rgba(7,14,28,0.6);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);max-width:28rem;text-align:center;box-shadow:0 14px 60px rgba(0,0,0,0.55), 0 0 40px rgba(0,243,255,0.08);}
h1{font-size:1.1rem;letter-spacing:0.32em;font-weight:200;text-transform:uppercase;margin:0 0 1rem;color:#00f3ff;text-shadow:0 0 18px rgba(0,243,255,0.4);}
p{font-size:0.86rem;color:#a4b5d0;line-height:1.55;margin:0.4rem 0;}
code{color:#00f3ff;background:rgba(0,243,255,0.08);padding:2px 6px;border-radius:3px;font-size:0.85em;}
a{color:#00f3ff;text-decoration:none;border-bottom:1px dashed rgba(0,243,255,0.4);}
</style></head><body><div class="card"><h1>🔒 Portal</h1>${msg}</div></body></html>`;

function forbidden(message: string) {
  return new NextResponse(FORBIDDEN_HTML(message), {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (!url.pathname.startsWith("/portal")) return NextResponse.next();

  // /portal/login is the auth check itself — must be reachable unauthenticated
  if (url.pathname === "/portal/login") return NextResponse.next();

  const isProductionLike =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (!isAdminConfigured()) {
    if (isProductionLike) {
      // FAIL CLOSED. Without this, anyone with the URL would see analytics.
      return forbidden(
        `<p>Portal is locked.</p>
         <p>An <code>ADMIN_PASSWORD</code> env var must be set on this deployment for the portal to be reachable.</p>
         <p style="font-size:0.7rem;color:#566b8e;margin-top:1.2rem;">Site admin: add <code>ADMIN_PASSWORD</code> (and optionally <code>ADMIN_USER</code>, defaults to <code>admin</code>) in Vercel → Settings → Environment Variables, then trigger a fresh deploy.</p>`,
      );
    }
    // Local dev — allow through (no password needed)
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(cookie)) return NextResponse.next();

  // No valid session → send to login, preserve the destination via ?from=
  const login = new URL("/portal/login", url);
  if (url.pathname !== "/portal") {
    login.searchParams.set("from", url.pathname + url.search);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/portal/:path*"],
};
