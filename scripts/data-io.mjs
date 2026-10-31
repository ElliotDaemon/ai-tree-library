// Read/write the git-backed database in data/. Used by scripts; the app has its own GitHub-aware store.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

const load = async (f, fallback) => {
  try { return JSON.parse(await readFile(join(DATA, f), "utf8")); } catch { return fallback; }
};

export async function readData() {
  return {
    library: await load("library.json", []),
    queue: await load("queue.json", []),
    rejected: await load("rejected.json", []),
  };
}

/** One entry per line: diffs stay readable and pull requests rarely conflict. */
export const serialize = (arr) => (arr.length ? `[\n${arr.map((x) => JSON.stringify(x)).join(",\n")}\n]\n` : "[]\n");

export async function writeData(parts) {
  for (const [k, v] of Object.entries(parts)) await writeFile(join(DATA, `${k}.json`), serialize(v));
}
