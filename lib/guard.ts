import { cookies } from "next/headers";
import { isAdminConfigured, SESSION_COOKIE, verifySession } from "./auth";

/** True when the request carries a valid portal session (or it's local dev with no password set). */
export async function isAdmin(): Promise<boolean> {
  if (!isAdminConfigured()) return !process.env.VERCEL && process.env.NODE_ENV !== "production";
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
}
