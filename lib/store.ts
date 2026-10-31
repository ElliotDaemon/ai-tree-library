// The database is three JSON files in data/, versioned in git. No API bill, nothing to go down:
// the public site is built from them, and the portal and submit form write them through the
// GitHub Git Data API (one atomic commit per action, retried on conflict). Without GITHUB_TOKEN
// (local dev) the same calls read and write the files on disk.
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { serialize } from "@/scripts/data-io.mjs";
import type { Entry, QueueItem } from "./types";

export interface Db {
  library: Entry[];
  queue: QueueItem[];
  rejected: string[];
}
type File = keyof Db;
const FILES: File[] = ["library", "queue", "rejected"];

const token = () => process.env.GITHUB_TOKEN || "";
const repo = () => process.env.GITHUB_REPO || "ElliotDaemon/ai-tree-library";
const branch = () => process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";
export const storeMode = () => (token() ? "github" : process.env.VERCEL ? "readonly" : "local");

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${repo()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status} on ${path}`), { status: res.status });
  return (await res.json()) as T;
}

async function readGithub(): Promise<{ db: Db; head: string; tree: string }> {
  const ref = await gh<{ object: { sha: string } }>(`/git/ref/heads/${branch()}`);
  const commit = await gh<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
  const db = {} as Db;
  await Promise.all(
    FILES.map(async (f) => {
      try {
        const meta = await gh<{ sha: string }>(`/contents/data/${f}.json?ref=${ref.object.sha}`, {
          headers: { accept: "application/vnd.github.object+json" },
        }).catch(() => null);
        if (!meta) return void ((db as unknown as Record<string, unknown>)[f] = []);
        // Blobs API handles files past the 1 MB contents limit.
        const blob = await gh<{ content: string }>(`/git/blobs/${meta.sha}`);
        (db as unknown as Record<string, unknown>)[f] = JSON.parse(Buffer.from(blob.content, "base64").toString("utf8"));
      } catch {
        (db as unknown as Record<string, unknown>)[f] = [];
      }
    }),
  );
  return { db, head: ref.object.sha, tree: commit.tree.sha };
}

async function readLocal(): Promise<Db> {
  const db = {} as Db;
  for (const f of FILES) {
    try {
      (db as unknown as Record<string, unknown>)[f] = JSON.parse(await fs.readFile(join(process.cwd(), "data", `${f}.json`), "utf8"));
    } catch {
      (db as unknown as Record<string, unknown>)[f] = [];
    }
  }
  return db;
}

export async function readDb(): Promise<Db> {
  return token() ? (await readGithub()).db : readLocal();
}

/**
 * Read, change, write — atomically. `change` receives a fresh copy and returns the files it touched
 * (or null for no-op). On a concurrent write the whole cycle re-runs on the newer data.
 */
export async function mutateDb(message: string, change: (db: Db) => Partial<Db> | null): Promise<Partial<Db> | null> {
  if (!token()) {
    if (process.env.VERCEL) throw new Error("Writes need GITHUB_TOKEN on this deployment.");
    const db = await readLocal();
    const out = change(db);
    if (out) for (const [f, v] of Object.entries(out)) await fs.writeFile(join(process.cwd(), "data", `${f}.json`), serialize(v as unknown[]));
    return out;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const { db, head, tree } = await readGithub();
    const out = change(db);
    if (!out) return null;
    const entries = await Promise.all(
      Object.entries(out).map(async ([f, v]) => {
        const blob = await gh<{ sha: string }>(`/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: serialize(v as unknown[]), encoding: "utf-8" }),
        });
        return { path: `data/${f}.json`, mode: "100644", type: "blob", sha: blob.sha };
      }),
    );
    const newTree = await gh<{ sha: string }>(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: tree, tree: entries }) });
    const commit = await gh<{ sha: string }>(`/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }),
    });
    try {
      await gh(`/git/refs/heads/${branch()}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
      return out;
    } catch (e) {
      if ((e as { status?: number }).status !== 422) throw e; // 422 = not a fast-forward: someone wrote first
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw new Error("Could not commit after 4 attempts.");
}
