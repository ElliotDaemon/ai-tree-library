// Apply a batch of portal decisions in one commit.
//   approve   queue item → library (with any edits)
//   reject    queue item → removed, its URL remembered in rejected.json
//   defer     queue item stays, edits saved
//   update    library entry edited in place
//   unpublish library entry → back to the queue
import { NextResponse, after } from "next/server";
import { shotUrl } from "@/lib/shot";
import { isAdmin } from "@/lib/guard";
import { mutateDb } from "@/lib/store";
import { findSub, uniqueSlug, urlKey, canonicalKey, cleanUrl, KINDS } from "@/lib/taxonomy.mjs";
import type { Entry, Kind, QueueItem } from "@/lib/types";

export const runtime = "nodejs";

type Action = "approve" | "reject" | "defer" | "update" | "unpublish";
interface Decision { id: string; action: Action; patch?: Partial<Entry & QueueItem> }

const s = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
function clean(p: Partial<Entry & QueueItem> = {}) {
  const out: Partial<Entry & QueueItem> = {};
  if (p.name !== undefined) out.name = s(p.name, 80);
  if (p.url !== undefined) out.url = cleanUrl(p.url) || undefined;
  if (p.description !== undefined) out.description = s(p.description, 400);
  if (p.kind !== undefined && KINDS.some((k) => k.id === p.kind)) out.kind = p.kind as Kind;
  if (p.branch !== undefined) out.branch = s(p.branch, 64);
  if (p.sub !== undefined) out.sub = s(p.sub, 64);
  if (p.tags !== undefined) out.tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => s(t, 24)).filter(Boolean).slice(0, 8);
  if (p.pricing !== undefined) out.pricing = s(p.pricing, 24);
  if (p.featured !== undefined) out.featured = !!p.featured;
  if (p.gem !== undefined) out.gem = !!p.gem;
  for (const k of Object.keys(out) as (keyof typeof out)[]) if (out[k] === undefined) delete out[k];
  return out;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { decisions } = (await req.json().catch(() => ({}))) as { decisions?: Decision[] };
  if (!Array.isArray(decisions) || !decisions.length) return NextResponse.json({ error: "nothing to commit" }, { status: 400 });

  const tally = { approve: 0, reject: 0, defer: 0, update: 0, unpublish: 0 } as Record<Action, number>;
  const problems: string[] = [];
  const approvedUrls: string[] = [];
  try {
    await mutateDb(`portal: ${decisions.length} decision${decisions.length === 1 ? "" : "s"}`, (db) => {
      for (const k of Object.keys(tally) as Action[]) tally[k] = 0;
      problems.length = 0;
      approvedUrls.length = 0;
      const queue = new Map(db.queue.map((q) => [q.id, q]));
      const library = new Map(db.library.map((e) => [e.id, e]));
      const rejected = new Set(db.rejected);
      const taken = new Set(library.keys());
      const today = new Date().toISOString();

      for (const d of decisions) {
        const patch = clean(d.patch);
        if (d.action === "update" || d.action === "unpublish") {
          const e = library.get(d.id);
          if (!e) { problems.push(`${d.id}: not in library`); continue; }
          if (d.action === "update") library.set(e.id, { ...e, ...patch, id: e.id });
          else {
            library.delete(e.id);
            queue.set(`q-${e.id}`, { ...e, id: `q-${e.id}`, slug: e.id, origin: e.origin, submittedAt: e.added, note: "unpublished" });
          }
          tally[d.action]++;
          continue;
        }
        const q = queue.get(d.id);
        if (!q) { problems.push(`${d.id}: not in queue`); continue; }
        const merged = { ...q, ...patch };
        if (d.action === "defer") { queue.set(q.id, merged); tally.defer++; continue; }
        if (d.action === "reject") { queue.delete(q.id); rejected.add(urlKey(q.url)); rejected.add(canonicalKey(q.url)); tally.reject++; continue; }
        // approve
        if (!findSub(merged.branch, merged.sub)) { problems.push(`${merged.name}: pick a branch first`); continue; }
        const dupe = [...library.values()].find((e) => urlKey(e.url) === urlKey(merged.url) || canonicalKey(e.url) === canonicalKey(merged.url));
        if (dupe) { queue.delete(q.id); problems.push(`${merged.name}: already live as /${dupe.id}`); continue; }
        const id = merged.slug && !taken.has(merged.slug) ? (taken.add(merged.slug), merged.slug) : uniqueSlug(merged.name, taken);
        const entry: Entry = {
          id, name: merged.name, url: merged.url, kind: merged.kind, branch: merged.branch, sub: merged.sub,
          description: merged.description || "", tags: merged.tags || [],
          ...(merged.pricing ? { pricing: merged.pricing } : {}),
          ...(merged.featured ? { featured: true } : {}),
          ...(merged.gem ? { gem: true } : {}),
          added: today, origin: merged.origin,
          ...(merged.submitter ? { submitter: merged.submitter } : {}),
        };
        library.set(id, entry);
        approvedUrls.push(entry.url);
        queue.delete(q.id);
        tally.approve++;
      }
      if (!Object.values(tally).some(Boolean)) return null;
      return { library: [...library.values()], queue: [...queue.values()], rejected: [...rejected] };
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
  // ask the capture service to start on newly approved links now; by the time anyone opens them, it's done
  after(async () => {
    const urls = approvedUrls.slice(0, 60);
    for (let i = 0; i < urls.length; i += 6)
      await Promise.allSettled(urls.slice(i, i + 6).map((u) => fetch(shotUrl(u), { signal: AbortSignal.timeout(8000) })));
  });
  return NextResponse.json({ ok: true, tally, problems });
}
