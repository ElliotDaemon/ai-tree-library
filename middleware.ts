// Auth gate for /portal. Two ways in:
//   1. ?key=<ADMIN_TOKEN>  (URL query — works on mobile, sets a cookie so
//      you don't have to keep the query string)
//   2. The ne_admin cookie (set automatically after first successful key auth)
//
// If ADMIN_TOKEN is unset (e.g. local dev), the portal is open.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (!url.pathname.startsWith("/portal")) return NextResponse.next();

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.next(); // dev mode — wide open

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

  // Forbidden — render a minimal HTML response
  return new NextResponse(
    `<!doctype html><html><head><title>Portal — AI Tree Library</title>
<style>
body{font-family:system-ui;background:#030508;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{padding:2rem 2.5rem;border:1px solid rgba(0,243,255,0.3);border-radius:14px;background:rgba(7,14,28,0.6);backdrop-filter:blur(20px);max-width:24rem;text-align:center;}
h1{font-size:1.1rem;letter-spacing:0.32em;font-weight:200;text-transform:uppercase;margin:0 0 1rem;color:#00f3ff;}
p{font-size:0.85rem;color:#8b9bb4;line-height:1.5;}
code{color:#00f3ff;}
</style></head><body><div class="card"><h1>🔒 Portal</h1>
<p>Access requires the admin token.</p>
<p>Append <code>?key=&lt;your token&gt;</code> to the URL.</p></div></body></html>`,
    { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export const config = {
  matcher: ["/portal/:path*"],
};
