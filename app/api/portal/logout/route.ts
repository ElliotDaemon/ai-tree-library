// POST /api/portal/logout
//
// Clears the session cookie and redirects to /portal/login. Accepts POST
// only (CSRF-resistant — a stray GET image tag can't log you out).

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/portal-auth";

export const runtime = "edge";

export async function POST(req: Request) {
  const target = new URL("/portal/login", req.url);
  const res = NextResponse.redirect(target, { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
