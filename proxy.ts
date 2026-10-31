// Gate for /portal. The portal's API routes check the session themselves (lib/guard.ts).
import { NextResponse, type NextRequest } from "next/server";
import { isAdminConfigured, SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/portal/login") return NextResponse.next();
  if (!isAdminConfigured()) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production")
      return new NextResponse("Portal locked: set ADMIN_PASSWORD on this deployment.", { status: 403 });
    return NextResponse.next(); // local dev
  }
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/portal/login", req.url);
  if (pathname !== "/portal") login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/portal", "/portal/:path*"] };
