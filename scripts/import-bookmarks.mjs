#!/usr/bin/env node
// Import a Chrome/Netscape bookmarks export into the review queue.
//   node scripts/import-bookmarks.mjs ~/Downloads/bookmarks.html [--dry]
//
// Everything lands in data/queue.json as "pending": nothing goes live until it is approved in /portal.
// The repo is public, so private links are filtered before they are written: personal folders,
// accounts, dashboards, docs, socials and anything carrying a token never leave your machine.

import { readFile } from "node:fs/promises";
import { canonicalKey, classify, cleanUrl, detectKind, hostOf, suggestTags, tidyName, urlKey } from "../lib/taxonomy.mjs";
import { readData, writeData } from "./data-io.mjs";
import { PRIVATE_FOLDER, PRIVATE_HOST, PRIVATE_PATH } from "../lib/import-filters.mjs";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) {
  console.error("usage: node scripts/import-bookmarks.mjs <bookmarks.html> [--dry]");
  process.exit(1);
}


function parse(html) {
  const out = [];
  const stack = [];
  let pending = null;
  const re = /<H3[^>]*>([\s\S]*?)<\/H3>|<DL>|<\/DL>|<A HREF="([^"]*)"[^>]*>([\s\S]*?)<\/A>/gi;
  const un = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  for (const m of html.matchAll(re)) {
    const t = m[0].toUpperCase();
    if (t.startsWith("<H3")) pending = un(m[1]);
    else if (t === "<DL>") { stack.push(pending || ""); pending = null; }
    else if (t === "</DL>") stack.pop();
    else out.push({ folder: stack.filter(Boolean).join("/"), url: un(m[2]), title: un(m[3]) });
  }
  return out;
}

const html = await readFile(file, "utf8");
const marks = parse(html);
const { library, queue, rejected } = await readData();
const seen = new Set([...library.flatMap((e) => [urlKey(e.url), canonicalKey(e.url)]), ...queue.flatMap((e) => [urlKey(e.url), canonicalKey(e.url)]), ...rejected]);

const now = new Date().toISOString();
let added = 0, skipped = 0;
for (const b of marks) {
  const url = cleanUrl(b.url);
  const host = hostOf(url);
  if (!url || !host || PRIVATE_FOLDER.test(b.folder) || PRIVATE_HOST.test(host) || PRIVATE_PATH.test(url)) { skipped++; continue; }
  // A bookmark deep inside a product: keep the product's front door unless it's an app-store or extension listing.
  const kind = detectKind(url, b.title);
  const u = new URL(url);
  const store = ["ios", "android", "extension", "desktop"].includes(kind);
  const front = store ? url : u.pathname.split("/").filter(Boolean).length > 1 ? `${u.origin}/` : `${u.origin}${u.pathname}`;
  const key = urlKey(front);
  if (seen.has(key) || seen.has(canonicalKey(front))) { skipped++; continue; }
  seen.add(key); seen.add(canonicalKey(front));
  const collapsed = front !== url;
  const hostWord = host.split(".").slice(-2, -1)[0] || host;
  const titled = tidyName(b.title, front);
  const name = collapsed && !titled.toLowerCase().replace(/[^a-z0-9]/g, "").includes(hostWord.replace(/[^a-z0-9]/g, ""))
    ? hostWord[0].toUpperCase() + hostWord.slice(1)
    : titled;
  const hint = b.folder.split("/").slice(-2).join(" ");
  const c = classify({ name, url: front, description: b.title, hint });
  queue.push({
    id: `q-${key.replace(/[^a-z0-9]+/g, "-").slice(0, 48)}-${(added + queue.length).toString(36)}`,
    url: front, name, description: "", kind,
    branch: c.branch, sub: c.sub, confidence: Number(c.confidence.toFixed(2)),
    tags: suggestTags({ name, url: front, description: b.title }),
    origin: "bookmarks", submitter: "", note: b.title !== name ? b.title.slice(0, 140) : "", submittedAt: now,
  });
  added++;
}

console.log(`[import] ${marks.length} bookmarks · ${added} queued · ${skipped} skipped (private, duplicate or invalid)`);
if (!dry) await writeData({ queue });
