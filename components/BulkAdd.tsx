"use client";
// Add many links at once. Paste anything (URLs are found in any text), or drop a file:
// a Chrome/Safari/Firefox bookmarks export, a CSV, a text or markdown list.
// Links go to the review queue in batches of 10, each batch one commit.
import { useRef, useState } from "react";
import { XIcon } from "./Icons";

interface Item { url: string; title?: string; folder?: string }
interface Result { url: string; name?: string; status: "added" | "exists" | "declined" | "skipped" | "invalid"; note?: string }

const URL_RE = /\bhttps?:\/\/[^\s"'<>()[\]{},]+|\bwww\.[a-z0-9-]+\.[^\s"'<>()[\]{},]+/gi;
const BATCH = 10;

/** Netscape bookmark files: every link with its folder path (used to keep personal folders out). */
function fromBookmarks(html: string): Item[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("a[href]")].map((a) => {
    const folders: string[] = [];
    for (let el: Element | null = a.parentElement; el; el = el.parentElement) {
      if (el.tagName === "DL") { const h = el.previousElementSibling; if (h?.tagName === "H3") folders.unshift(h.textContent || ""); }
    }
    return { url: a.getAttribute("href") || "", title: a.textContent?.trim() || "", folder: folders.join("/") };
  });
}
function fromText(text: string): Item[] {
  return (text.match(URL_RE) || []).map((u) => ({ url: u.replace(/[.,;:!?]+$/, "") }));
}

export default function BulkAdd({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [source, setSource] = useState<"list" | "bookmarks">("list");
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState("");
  const stop = useRef(false);

  const unique = (list: Item[]) => {
    const seen = new Set<string>();
    return list.filter((i) => { const k = i.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, ""); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  };
  const fromPaste = (t: string) => { setText(t); setFileName(""); setSource("list"); setItems(unique(fromText(t))); };
  const fromFile = async (f: File) => {
    const body = await f.text();
    const isBookmarks = /<!DOCTYPE NETSCAPE-Bookmark-file/i.test(body) || (/\.html?$/i.test(f.name) && /<a\s[^>]*href/i.test(body));
    setFileName(f.name); setText("");
    setSource(isBookmarks ? "bookmarks" : "list");
    setItems(unique(isBookmarks ? fromBookmarks(body) : fromText(body)));
  };

  async function run() {
    setRunning(true); setResults([]); setDone(0); setError(""); stop.current = false;
    for (let i = 0; i < items.length && !stop.current; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const res = await fetch("/api/portal/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: batch, source }) }).catch(() => null);
      const out = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) { setError(out.error || "A batch failed. Everything before it was saved; run again to continue."); break; }
      setResults((r) => [...r, ...(out.results as Result[])]);
      setDone(Math.min(items.length, i + BATCH));
    }
    setRunning(false);
    onDone();
  }

  const count = (s: Result["status"]) => results.filter((r) => r.status === s).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="bulk-scrim" onClick={(e) => e.target === e.currentTarget && !running && onClose()}>
      <section className="bulk sheet" role="dialog" aria-label="Add links">
        <header>
          <div>
            <div className="eyebrow">Bulk add</div>
            <h2>Add links</h2>
          </div>
          <button className="pill icon-btn" onClick={onClose} disabled={running} aria-label="Close"><XIcon size={16} /></button>
        </header>

        {!running && !results.length && (
          <>
            <textarea
              className="textarea bulk-paste"
              placeholder={"Paste anything with links in it: a list, a doc, a message, a spreadsheet column.\n\nhttps://example.com\nhttps://another.app …"}
              value={text}
              onChange={(e) => fromPaste(e.target.value)}
            />
            <label className="bulk-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) fromFile(f); }}>
              <input type="file" accept=".html,.htm,.csv,.txt,.md,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) fromFile(f); }} />
              <span>{fileName ? <>Loaded <b>{fileName}</b></> : <>Or drop a file: <b>bookmarks export</b> (.html), .csv, .txt or .md</>}</span>
            </label>
            <div className="bulk-foot">
              <span className="note">
                {items.length ? <><b>{items.length}</b> links found{source === "bookmarks" ? " · personal folders, accounts and private pages are skipped automatically" : ""}</> : "Every link is described, placed in a branch and checked for duplicates. Nothing goes live until you approve it."}
              </span>
              <button className="pill accent" disabled={!items.length} onClick={run}>Add {items.length || ""} to queue</button>
            </div>
          </>
        )}

        {(running || results.length > 0) && (
          <div className="bulk-progress">
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <div className="bulk-tally mono">
              <span className="ok">{count("added")} added</span>
              <span>{count("exists")} already there</span>
              <span>{count("declined")} declined before</span>
              <span>{count("skipped")} private, skipped</span>
              <span>{count("invalid")} unreachable</span>
              <span className="spacer" />
              <span>{done}/{items.length}</span>
            </div>
            {error && <p className="note err">{error}</p>}
            <div className="bulk-list">
              {results.slice().reverse().map((r, i) => (
                <div key={i} className={`bulk-row ${r.status}`}>
                  <span className="dot" />
                  <span className="nm">{r.name || r.url.replace(/^https?:\/\//, "")}</span>
                  <span className="st">{r.status === "added" ? "added" : r.note || r.status}</span>
                </div>
              ))}
            </div>
            <div className="bulk-foot">
              {running ? <button className="pill" onClick={() => (stop.current = true)}>Stop after this batch</button> : <span className="note">Added links are in the queue under <b>Bulk upload</b>.</span>}
              {!running && <button className="pill accent" onClick={onClose}>Review them</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
