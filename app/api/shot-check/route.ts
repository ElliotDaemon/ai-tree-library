// Does this site put a bot check in front of automated visitors? If so, any capture is of the
// check page ("Verify you are human"), not the site, and the preview frame should say so instead.
// Answers are cached at the edge for a week per URL.
import { NextResponse } from "next/server";
import { isPublicHost } from "@/lib/meta";
import { cleanUrl, hostOf } from "@/lib/taxonomy.mjs";
import { clientIp } from "@/lib/guard";
import { hitRateLimit } from "@/lib/rate-limit";
import { botCheck } from "@/lib/botcheck.mjs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!hitRateLimit(`shot:${clientIp(req)}`, { max: 60, windowMs: 60_000, lockMs: 60_000 }).allowed)
    return NextResponse.json({ blocked: false }, { status: 429 });
  const url = cleanUrl(new URL(req.url).searchParams.get("url") || "");
  if (!url || !isPublicHost(hostOf(url))) return NextResponse.json({ blocked: false }, { status: 400 });

  let blocked = false, reason = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; AITreeLibraryPreview/1.0; +https://aitreelibrary.com/about)", accept: "text/html" },
    });
    reason = botCheck(res.status, res.headers, await res.text());
    blocked = !!reason;
  } catch {
    // unreachable from here says nothing about the capture service; let the capture decide
  }
  return NextResponse.json(
    { blocked, reason },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
