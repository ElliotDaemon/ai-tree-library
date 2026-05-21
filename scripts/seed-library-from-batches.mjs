// One-shot import of remaining V1 tools into the Library DB.
// Reads library-pages-batch-N.json files from ../../v1-data/ and POSTs to Notion.
//
// Usage:
//   NOTION_TOKEN=secret_xxx node scripts/seed-library-from-batches.mjs
//
// Idempotent (skips entries whose URL already exists in the DB).

import { Client } from "@notionhq/client";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const V1_DATA = join(__dirname, "..", "..", "v1-data");
const LIBRARY_DS = "695ea981-738e-42bf-bec6-43ffd530d89c";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("Set NOTION_TOKEN env var");
  process.exit(1);
}
const notion = new Client({ auth: token });

// 1) Build a set of URLs already in the Library so we can skip dupes
console.log("[seed] Fetching existing URLs from Library...");
const existingUrls = new Set();
{
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: LIBRARY_DS,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const r of res.results) {
      const u = r.properties?.URL?.url;
      if (u) existingUrls.add(u.toLowerCase().replace(/\/+$/, ""));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
}
console.log(`[seed] Existing in Library: ${existingUrls.size}`);

// 2) Load all batch files
const allBatches = (await readdir(V1_DATA)).filter((f) => /^library-pages-batch-\d+\.json$/.test(f)).sort();
console.log(`[seed] Batch files: ${allBatches.join(", ")}`);

let totalCreated = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const batchFile of allBatches) {
  const data = JSON.parse(await readFile(join(V1_DATA, batchFile), "utf8"));
  const toCreate = data.filter((p) => {
    const u = p.properties["userDefined:URL"];
    if (!u) return false;
    return !existingUrls.has(u.toLowerCase().replace(/\/+$/, ""));
  });
  console.log(`[seed] ${batchFile}: ${data.length} entries, ${toCreate.length} need create`);

  for (const page of toCreate) {
    try {
      // Map our flat shape to Notion's property format
      const props = page.properties;
      const created = await notion.pages.create({
        parent: { database_id: LIBRARY_DS },
        properties: {
          Name: { title: [{ text: { content: props.Name || "" } }] },
          URL: { url: props["userDefined:URL"] || null },
          Type: { select: { name: props.Type || "Tool" } },
          Description: { rich_text: [{ text: { content: props.Description || "" } }] },
          Category: { relation: parseRelation(props.Category) },
          Pricing: { select: { name: props.Pricing || "Unknown" } },
          Featured: { checkbox: props.Featured === "__YES__" },
          Gem: { checkbox: props.Gem === "__YES__" },
          Status: { select: { name: props.Status || "Ready" } },
          "Logo URL": props["Logo URL"] ? { url: props["Logo URL"] } : { url: null },
        },
      });
      totalCreated++;
      if (totalCreated % 25 === 0) console.log(`[seed] ...${totalCreated} created`);
    } catch (e) {
      totalErrors++;
      console.error(`[seed] FAIL: ${page.properties.Name} — ${e.message}`);
    }
  }
  totalSkipped += data.length - toCreate.length;
}

console.log(`\n[seed] Done. Created ${totalCreated}, skipped ${totalSkipped} (dupes), errors ${totalErrors}`);

function parseRelation(catVal) {
  // The batch files store category as a JSON string like '["https://www.notion.so/<id-no-dashes>"]'
  if (!catVal) return [];
  try {
    const arr = JSON.parse(catVal);
    return arr.map((u) => {
      const m = String(u).match(/notion\.so\/([0-9a-f]+)/i);
      if (!m) return null;
      const id = m[1];
      // re-insert dashes: 8-4-4-4-12
      const dashed = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
      return { id: dashed };
    }).filter(Boolean);
  } catch {
    return [];
  }
}
