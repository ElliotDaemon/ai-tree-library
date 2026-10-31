// One-off: merge links that are the same product, fix entries that pointed at the wrong page,
// and record redirects so every removed live page lands on the one that stayed.
//   node scripts/migrations/2026-10-31-dedupe.mjs [--dry]
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readData, writeData, DATA } from "../data-io.mjs";

// keep: the entry that stays (matched by URL); drop: same product elsewhere; set: corrections
const MERGES = [
  { keep: "www.kimi.com/", drop: ["www.kimi.com/en"], set: { name: "Kimi", url: "https://www.kimi.com/" } },
  { keep: "mobbin.com/", drop: ["mobbin.com/browse/ios/apps"] },
  { keep: "bfl.ai/", drop: ["blackforestlabs.ai/"] },
  { keep: "toolost.com/user-portal", drop: ["toolost.com/"], set: { name: "Too Lost", url: "https://toolost.com/" } },
  { keep: "www.celemony.com/en/start", drop: ["www.celemony.com/"], set: { name: "Celemony", url: "https://www.celemony.com/" } },
  { keep: "soundcharts.com/blog", drop: ["soundcharts.com/"], set: { name: "Soundcharts", url: "https://soundcharts.com/" } },
  { keep: "soundbetter.com/jobs", drop: ["soundbetter.com/"], set: { name: "SoundBetter", url: "https://soundbetter.com/" } },
  { keep: "cribofart.com/", drop: ["cribofart.com/collections/shop-all"], set: { name: "Crib of Art" } },
  { keep: "chat.openai.com/", drop: ["chatgpt.com/"], set: { name: "ChatGPT", url: "https://chatgpt.com/" } },
  { keep: "grok.com/", drop: ["grok.x.ai/"], set: { name: "Grok" } },
  { keep: "www.farfetch.com/shopping", drop: ["www.farfetch.com/"], set: { name: "Farfetch", url: "https://www.farfetch.com/" } },
  { keep: "relevanceai.com/", drop: ["app.relevanceai.com/"] },
  { keep: "suno.com/", drop: ["suno.ai/"] },
  { keep: "chat.mistral.ai/", drop: ["chat.mistral.ai/chat"], set: { name: "Le Chat" } },
  { keep: "mistral.ai/", drop: ["mistral.ai/en"], set: { name: "Mistral AI" } },
  { keep: "v0.app/", drop: ["v0.dev/"], set: { name: "v0" } },
  { keep: "midjourney.com/", drop: ["www.midjourney.com/imagine"] },
  { keep: "deepseek.com/", drop: ["chat.deepseek.com/"] },
  { keep: "openai.com/sora", drop: ["sora.chatgpt.com/", "higgsfield.ai/create/video"], set: { name: "Sora", url: "https://sora.chatgpt.com/" } },
  { keep: "www.dexlab.space/", drop: ["www.dexlab.space/home"] },
  { keep: "app.bubblemaps.io/", drop: ["app.bubblemaps.io/eth/"] },
  { keep: "www.sixiemeson.com/", drop: ["www.sixiemeson.com/welcome-us/"] },
  { keep: "typeset.com/", drop: ["app.typeset.com/home"] },
  { keep: "venngage.com/", drop: ["infograph.venngage.com/infographics"] },
  { keep: "flowiseai.com/", drop: ["cloud.flowiseai.com/"] },
  { keep: "zencal.io/", drop: ["app.zencal.io/meeting-topics"] },
  { keep: "lostboyent.com/music-pr-firms", drop: ["lostboyent.com/music-promotion-agency"], set: { name: "Lost Boy Entertainment" } },
  { keep: "www.artist.tools/home", drop: ["www.artist.tools/bot-checker"], set: { name: "Artist.tools", url: "https://www.artist.tools/" } },
];
// names that were page titles, not product names
const RENAMES = [
  ["www.riaa.com/", "RIAA"], ["www.themlc.com/", "The MLC"], ["app.daomaker.com/", "DAO Maker"],
  ["www.xlnaudio.com/", "XLN Audio"], ["waves.com/cosmos", "Waves Cosmos"], ["www.cosmos.so/", "Cosmos"],
  ["www.musicgateway.com/isrc-finder", "ISRC Finder (Music Gateway)"], ["musicfetch.io/isrc-finder", "ISRC Finder (Musicfetch)"],
  ["www.spectrasonics.net/products/omnispher", "Omnisphere"], ["www.soundradix.com/products/surfereq", "SurferEQ 2"],
];

const dry = process.argv.includes("--dry");
const { library, queue } = await readData();
const norm = (u) => u.replace(/^https?:\/\//, "");
const find = (frag, exact) => {
  const hit = (e) => (exact ? norm(e.url) === frag : norm(e.url).startsWith(frag));
  return library.find(hit) ? { list: library, e: library.find(hit) } : queue.find(hit) ? { list: queue, e: queue.find(hit) } : null;
};
const redirects = JSON.parse(await readFile(join(DATA, "redirects.json"), "utf8").catch(() => "{}"));
const log = [];
for (const m of MERGES) {
  const k = find(m.keep, true) || find(m.keep, false);
  if (!k) { log.push(`skip (not found): ${m.keep}`); continue; }
  for (const d of m.drop) {
    const x = find(d, true) || find(d, false);
    if (!x || x.e === k.e) continue;
    // combine: the richer description, every tag, any featured or gem flag
    if ((x.e.description || "").length > (k.e.description || "").length) k.e.description = x.e.description;
    k.e.tags = [...new Set([...(k.e.tags || []), ...(x.e.tags || [])])].slice(0, 8);
    if (x.e.featured) k.e.featured = true;
    if (x.e.gem) k.e.gem = true;
    if (x.list === library && k.list === library) redirects[x.e.id] = k.e.id;
    x.list.splice(x.list.indexOf(x.e), 1);
    log.push(`merged  ${x.e.name} <${norm(x.e.url)}>  →  ${m.set?.name || k.e.name}`);
  }
  if (m.set) Object.assign(k.e, m.set);
}
for (const [frag, name] of RENAMES) {
  const x = find(frag, false);
  if (x && x.e.name !== name) { log.push(`renamed ${x.e.name.slice(0, 40)}  →  ${name}`); x.e.name = name; }
}
// a redirect must never point at a page that itself redirects
for (const [from, to] of Object.entries(redirects)) { let t = to; while (redirects[t]) t = redirects[t]; redirects[from] = t; }
console.log(log.join("\n"));
console.log(`\nlibrary ${library.length} · queue ${queue.length} · redirects ${Object.keys(redirects).length}`);
if (!dry) {
  await writeData({ library, queue });
  await writeFile(join(DATA, "redirects.json"), JSON.stringify(redirects, null, 1) + "\n");
}

// second pass: survivors take the clean address their duplicate used to hold
import { slugify } from "../../lib/taxonomy.mjs";
{
  const { library: lib } = await readData();
  const reds = JSON.parse(await readFile(join(DATA, "redirects.json"), "utf8").catch(() => "{}"));
  const taken = new Set(lib.map((e) => e.id));
  const want = { "kimicom": "kimi", "grok-2": "grok", "suno-2": "suno", "v0-2": "v0", "openai-sora": "sora", "search-78bd": "artist-tools", "too-lost": "too-lost" };
  for (const e of lib) {
    const to = want[e.id];
    if (!to || to === e.id || taken.has(to)) continue;
    taken.delete(e.id); taken.add(to);
    reds[e.id] = to;
    for (const k of Object.keys(reds)) if (reds[k] === e.id) reds[k] = to;
    delete reds[to]; // the clean address is live again
    console.log(`address ${e.id} → ${to}`);
    e.id = to;
  }
  void slugify;
  if (!dry) { await writeData({ library: lib }); await writeFile(join(DATA, "redirects.json"), JSON.stringify(reds, null, 1) + "\n"); }
}
