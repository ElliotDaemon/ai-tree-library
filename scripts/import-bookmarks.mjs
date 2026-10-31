#!/usr/bin/env node
// Import a Chrome/Netscape bookmarks export into the review queue.
//   node scripts/import-bookmarks.mjs ~/Downloads/bookmarks.html [--dry]
//
// Everything lands in data/queue.json as "pending": nothing goes live until it is approved in /portal.
// The repo is public, so private links are filtered before they are written: personal folders,
// accounts, dashboards, docs, socials and anything carrying a token never leave your machine.

import { readFile } from "node:fs/promises";
import { classify, cleanUrl, detectKind, hostOf, suggestTags, tidyName, urlKey } from "../lib/taxonomy.mjs";
import { readData, writeData } from "./data-io.mjs";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) {
  console.error("usage: node scripts/import-bookmarks.mjs <bookmarks.html> [--dry]");
  process.exit(1);
}

// Folders whose links are personal, not library material.
const PRIVATE_FOLDER = /(official roster|\/projects$|proton|\/save$|\/wix$|\/x$|youtube|\/google$|11:11 inc|global & ip|\/ir$|\/re$|data recovery)/i;
// Hosts that are accounts, personal properties or platforms too generic to list.
const PRIVATE_HOST = /(^|\.)(google\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|reddit\.com|notion\.so|notion\.site|proton\.me|wix\.com|editorx\.com|1111[a-z]*\.(com|org)|elliotdaemon\.com|alinacak\.com|sparkwrld\.com|aitreelibrary\.com|vercel\.app|localhost|amazon\.[a-z.]+|ebay\.[a-z.]+|paypal\.com|stripe\.com|dropbox\.com|wetransfer\.com|we\.tl|bit\.ly|linktr\.ee|t\.co|spotify\.com|apple\.com|icloud\.com|microsoft\.com|live\.com|outlook\.com|gmail\.com|whatsapp\.com|discord\.(com|gg)|zoom\.us|calendly\.com|airtable\.com|canva\.com|slack\.com|twitch\.tv|docusign\.(com|net)|thinkific\.com|quora\.com|worldcat\.org|bookshop\.org|bankrate\.com|rollingstone\.com|ign\.com|xda-developers\.com|sahibinden\.com|disneyplus\.com|crunchyroll\.com|tvplus\.com\.tr)$/i;
// Paths that point inside an account rather than at a product.
const PRIVATE_PATH = /^chrome|^https:\/\/(my|labels|admin|console)\.|\/~|\/(backstage|watchlist|password|bank|dashboard|admin|account|settings|billing|login|signin|sign-in|signup|sign-up|auth|edit|invoice|inbox|checkout|cart|my-|profile|projects?\/[a-z0-9-]{8,}|d\/[a-z0-9_-]{20,})|[?&](token|key|code|session|sig|auth)=/i;

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
const seen = new Set([...library.map((e) => urlKey(e.url)), ...queue.map((e) => urlKey(e.url)), ...rejected.map(urlKey)]);

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
  if (seen.has(key)) { skipped++; continue; }
  seen.add(key);
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
