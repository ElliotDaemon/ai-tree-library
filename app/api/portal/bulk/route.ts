// Bulk add: a batch of links → described, placed, de-duplicated → the review queue, in one commit.
// The portal sends large uploads in small batches so each request stays well inside the time limit.
import { NextResponse, after } from "next/server";
import { isAdmin } from "@/lib/guard";
import { readMeta } from "@/lib/meta";
import { mutateDb } from "@/lib/store";
import { admit } from "@/lib/import-filters.mjs";
import { canonicalKey, cleanUrl, detectKind, tidyName, urlKey } from "@/lib/taxonomy.mjs";
import { shotUrl } from "@/lib/shot";
import type { QueueItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface In { url: string; title?: string; folder?: string }
type Result = { url: string; name?: string; status: "added" | "exists" | "declined" | "skipped" | "invalid"; note?: string };

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { items, source } = (await req.json().catch(() => ({}))) as { items?: In[]; source?: "bookmarks" | "list" };
  if (!Array.isArray(items) || !items.length || items.length > 25) return NextResponse.json({ error: "send 1–25 links per batch" }, { status: 400 });

  // 1. admit: clean, refuse private pages, collapse bookmarks to the product's front door
  const results: Result[] = [];
  const todo: { url: string; title: string }[] = [];
  for (const it of items) {
    const clean = cleanUrl(String(it.url || ""));
    if (!clean) { results.push({ url: String(it.url), status: "invalid", note: "not a link" }); continue; }
    const a = admit(clean, { source: source === "bookmarks" ? "bookmarks" : "list", folder: it.folder || "", kind: detectKind(clean, it.title || "") });
    if ("skip" in a) { results.push({ url: clean, status: "skipped", note: a.skip }); continue; }
    if (todo.some((t) => canonicalKey(t.url) === canonicalKey(a.url))) { results.push({ url: a.url, status: "exists", note: "twice in this upload" }); continue; }
    todo.push({ url: a.url, title: String(it.title || "").slice(0, 200) });
  }

  // 2. describe and place, five at a time
  const metas: { url: string; title: string; meta: Awaited<ReturnType<typeof readMeta>> }[] = [];
  for (let i = 0; i < todo.length; i += 5)
    metas.push(...(await Promise.all(todo.slice(i, i + 5).map(async (t) => ({ ...t, meta: await readMeta(t.url) })))));

  // 3. one commit: skip anything already live, queued or declined
  const added: string[] = [];
  let committed: Result[] = [];
  try {
    await mutateDb(`queue: bulk add (${metas.length})`, (db) => {
      added.length = 0;
      const out: Result[] = []; // rebuilt on every attempt, so a retried commit never double-counts
      committed = out;
      const known = new Set([...db.library, ...db.queue].flatMap((e) => [urlKey(e.url), canonicalKey(e.url)]));
      const declined = new Set(db.rejected);
      const fresh: QueueItem[] = [];
      for (const { url, title, meta } of metas) {
        if (!meta) { out.push({ url, status: "invalid", note: "not a public page" }); continue; }
        const keys = [urlKey(meta.url), canonicalKey(meta.url)];
        if (keys.some((k) => known.has(k))) { out.push({ url: meta.url, name: meta.name, status: "exists" }); continue; }
        if (keys.some((k) => declined.has(k))) { out.push({ url: meta.url, name: meta.name, status: "declined", note: "declined before" }); continue; }
        keys.forEach((k) => known.add(k));
        const name = meta.name && !/^untitled/i.test(meta.name) ? meta.name : tidyName(title, meta.url);
        fresh.push({
          id: `q-${keys[0].replace(/[^a-z0-9]+/g, "-").slice(0, 48)}-${(Date.now() + fresh.length).toString(36)}`,
          url: meta.url, name, description: meta.description, kind: meta.kind,
          branch: meta.branch, sub: meta.sub, confidence: Number(meta.confidence.toFixed(2)), tags: meta.tags,
          origin: "bulk", submitter: "", note: title && title !== name ? title.slice(0, 140) : "", submittedAt: new Date().toISOString(),
        });
        added.push(meta.url);
        out.push({ url: meta.url, name, status: "added" });
      }
      return fresh.length ? { queue: [...db.queue, ...fresh] } : null;
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
  results.push(...committed);
  // start capturing previews now, so review shows real screenshots
  after(async () => { await Promise.allSettled(added.map((u) => fetch(shotUrl(u, 1000, 625), { signal: AbortSignal.timeout(8000) }))); });
  return NextResponse.json({ ok: true, results });
}
