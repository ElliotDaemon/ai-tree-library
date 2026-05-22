// Auth gate for /portal.
//
// Two ways in:
//   1. ?key=<ADMIN_TOKEN>  (URL query — works on mobile, sets a cookie so
//      you don't have to keep the query string)
//   2. The ne_admin cookie (set automatically after first successful key auth)
//
// Fail-closed by default in production. If ADMIN_TOKEN is missing on a
// production deploy, the portal returns 403 with setup instructions
// instead of being wide open. Only Vercel preview deployments (which Vercel
// itself protects with a deployment-protection password) get the same
// behavior as production. Localhost dev stays open for testing.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (!url.pathname.startsWith("/portal")) return NextResponse.next();

  const expected = process.env.ADMIN_TOKEN;
  // Treat any Vercel deploy as production for security purposes — including
  // preview deployments. Only true localhost dev gets open access.
  const isProductionLike =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (!expected) {
    if (isProductionLike) {
      // FAIL CLOSED. Without this, anyone with the URL would see analytics.
      return forbidden(
        `<p>Portal is locked.</p>
         <p>An <code>ADMIN_TOKEN</code> env var must be set on this deployment for the portal to be reachable.</p>
         <p style="font-size:0.7rem;color:#566b8e;margin-top:1.2rem;">Site admin: add <code>ADMIN_TOKEN</code> in Vercel → Settings → Environment Variables, then redeploy.</p>`
      );
    }
    // Local dev — allow through (no token needed)
    return NextResponse.next();
  }

  const cookie = req.cookies.get("ne_admin")?.value;
  if (cookie === expected) return NextResponse.next();

  const provided = url.searchParams.get("key");
  if (provided && provided === expected) {
    // Strip the key from the URL, set cookie, redirect to clean URL
    const clean = new URL(url);
    clean.searchParams.delete("key");
    const res = NextResponse.redirect(clean);
    res.cookies.set("ne_admin", expected, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  }

  // Wrong/missing key
  return forbidden(
    `<p>Access requires the admin token.</p>
     <p>Append <code>?key=&lt;your token&gt;</code> to the URL.</p>`
  );
}

export const config = {
  matcher: ["/portal/:path*"],
};
