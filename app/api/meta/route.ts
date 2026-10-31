import { NextResponse } from "next/server";
import { readMeta } from "@/lib/meta";
import { clientIp } from "@/lib/guard";
import { hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!hitRateLimit(`meta:${clientIp(req)}`, { max: 30, windowMs: 60_000, lockMs: 60_000 }).allowed)
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  const url = new URL(req.url).searchParams.get("url") || "";
  const meta = await readMeta(url);
  if (!meta) return NextResponse.json({ error: "That doesn't look like a public URL." }, { status: 400 });
  return NextResponse.json(meta, { headers: { "cache-control": "public, max-age=3600" } });
}
