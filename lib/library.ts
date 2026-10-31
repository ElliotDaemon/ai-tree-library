// Build-time reads of the published library (data/library.json). Every public page is static.
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { BRANCHES, branchColor, hostOf } from "./taxonomy.mjs";
import type { Entry, Row } from "./types";

export const SITE = "https://aitreelibrary.com";

export const loadLibrary = cache(async (): Promise<Entry[]> => {
  try {
    const list = JSON.parse(await fs.readFile(join(process.cwd(), "data", "library.json"), "utf8")) as Entry[];
    return list.sort((a, b) => (b.added || "").localeCompare(a.added || "") || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
});

export async function findEntry(id: string) {
  return (await loadLibrary()).find((e) => e.id === id) ?? null;
}

export async function branchStats() {
  const lib = await loadLibrary();
  return BRANCHES.map((b) => ({
    id: b.id,
    name: b.name,
    blurb: b.blurb,
    color: branchColor(b.id),
    count: lib.filter((e) => e.branch === b.id).length,
    subs: b.subs.map((s) => ({ id: s.id, name: s.name, count: lib.filter((e) => e.branch === b.id && e.sub === s.id).length })),
  }));
}

/** Same sub-branch first, then same branch, then shared tags. */
export async function related(entry: Entry, n = 6) {
  const lib = await loadLibrary();
  const score = (e: Entry) =>
    (e.sub === entry.sub ? 4 : 0) + (e.branch === entry.branch ? 2 : 0) + e.tags.filter((t) => entry.tags.includes(t)).length;
  return lib
    .filter((e) => e.id !== entry.id)
    .map((e) => [score(e), e] as const)
    .filter(([s]) => s > 1)
    .sort((a, b) => b[0] - a[0])
    .slice(0, n)
    .map(([, e]) => e);
}

export const toRow = (e: Entry): Row => ({
  i: e.id,
  n: e.name,
  h: hostOf(e.url),
  u: e.url,
  d: e.description.length > 160 ? `${e.description.slice(0, 157).trim()}…` : e.description,
  b: e.branch,
  s: e.sub,
  k: e.kind,
  t: e.tags,
  ...(e.featured ? { f: 1 as const } : {}),
  ...(e.gem ? { g: 1 as const } : {}),
  a: (e.added || "").slice(0, 10),
});
