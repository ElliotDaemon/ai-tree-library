// Public submissions → data/queue.json (one commit each). Nothing publishes without approval in /portal.
import { NextResponse } from "next/server";
import { readMeta } from "@/lib/meta";
import { mutateDb } from "@/lib/store";
import { clientIp } from "@/lib/guard";
import { hitRateLimit } from "@/lib/rate-limit";
import { KINDS, findSub, urlKey } from "@/lib/taxonomy.mjs";
import type { Kind, QueueItem } from "@/lib/types";

export const runtime = "nodejs";

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

async function turnstileOk(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null);
  return Boolean(res && ((await res.json()) as { success?: boolean }).success);
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!hitRateLimit(`submit:${ip}`, { max: 8, windowMs: 60 * 60_000, lockMs: 60 * 60_000 }).allowed)
    return NextResponse.json({ error: "You've sent a lot today. Try again in an hour." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.website) return NextResponse.json({ ok: true }); // honeypot: bots fill every field
  if (!(await turnstileOk(clip(body.turnstileToken, 2048), ip))) return NextResponse.json({ error: "Verification failed." }, { status: 400 });

  const meta = await readMeta(clip(body.url, 2048));
  if (!meta) return NextResponse.json({ error: "Enter a public http(s) link." }, { status: 400 });

  const kind = (KINDS.some((k) => k.id === body.kind) ? body.kind : meta.kind) as Kind;
  const branch = clip(body.branch, 64);
  const sub = clip(body.sub, 64);
  const placed = findSub(branch, sub) ? { branch, sub } : { branch: meta.branch, sub: meta.sub };
  const key = urlKey(meta.url);

  let status = "queued" as "queued" | "exists" | "declined";
  try {
    await mutateDb(`queue: ${meta.host}`, (db) => {
      if (db.library.some((e) => urlKey(e.url) === key)) return void (status = "exists"), null;
      if (db.queue.some((e) => urlKey(e.url) === key)) return void (status = "exists"), null;
      if (db.rejected.includes(key)) return void (status = "declined"), null;
      if (db.queue.length > 5000) throw new Error("Queue is full");
      const item: QueueItem = {
        id: `q-${key.replace(/[^a-z0-9]+/g, "-").slice(0, 48)}-${Date.now().toString(36)}`,
        url: meta.url,
        name: clip(body.name, 80) || meta.name,
        description: clip(body.description, 280) || meta.description,
        kind,
        ...placed,
        confidence: Number(meta.confidence.toFixed(2)),
        tags: meta.tags,
        origin: "community",
        submitter: clip(body.submitter, 60).replace(/^@+/, ""),
        note: clip(body.note, 280),
        submittedAt: new Date().toISOString(),
      };
      return { queue: [...db.queue, item] };
    });
  } catch (e) {
    console.error("[submit]", e);
    return NextResponse.json({ error: "The library couldn't take submissions right now." }, { status: 503 });
  }
  if (status === "exists") return NextResponse.json({ ok: true, status, message: "Already in the library or waiting for review." });
  if (status === "declined") return NextResponse.json({ ok: true, status, message: "The 11:11 team reviewed this one before and passed on it." });
  return NextResponse.json({ ok: true, status, message: "Received. It goes live once the 11:11 team approves it." });
}
