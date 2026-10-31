"use client";
// The review desk. Every link waits here until the 11:11 team approves it.
// Decisions are staged locally (and survive a reload), then land as ONE commit.
//   J/K or ↑/↓ move · A approve · D decline · S later · X select · ⇧A approve selected
//   E edit name · O open link · U undo · / search · ⌘↵ commit
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BRANCHES, KINDS, branchColor, classify, hostOf } from "@/lib/taxonomy.mjs";
import type { Entry, QueueItem } from "@/lib/types";
import { Favicon } from "./Card";
import { ArrowIcon, CheckIcon, Mark, SearchIcon, XIcon } from "./Icons";
import ThemeToggle from "./ThemeToggle";

type Action = "approve" | "reject" | "defer" | "unpublish";
type Item = (QueueItem | Entry) & { _live?: boolean };
type Patch = Partial<Entry & QueueItem>;
interface Data { library: Entry[]; queue: QueueItem[]; rejected: string[]; mode: "github" | "local" | "readonly" }

const ORIGINS: Record<string, string> = { community: "Community", bookmarks: "Bookmarks", review: "Old queue", legacy: "Previously live" };
const STORE = "portal-stage-v1";

export default function Portal() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"queue" | "live" | "declined">("queue");
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState("");
  const [branchF, setBranchF] = useState("");
  const [cursor, setCursor] = useState(0);
  const [actions, setActions] = useState<Record<string, Action>>({});
  const [edits, setEdits] = useState<Record<string, Patch>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<string[]>([]);
  const [committing, setCommitting] = useState(false);
  const [toast, setToast] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/data", { cache: "no-store" });
    if (res.status === 401) return void (location.href = "/portal/login");
    if (!res.ok) return setError("Couldn't read the library.");
    setData(await res.json());
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
  useEffect(() => { load(); }, [load]);

  // staged work survives reloads
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore staged work from this browser
      if (s.actions) setActions(s.actions);
      if (s.edits) setEdits(s.edits);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ actions, edits })); } catch {}
  }, [actions, edits]);

  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const base: Item[] = tab === "live" ? data.library.map((e) => ({ ...e, _live: true })) : tab === "queue" ? [...data.queue].sort((a, b) => rank(a) - rank(b) || b.submittedAt.localeCompare(a.submittedAt)) : [];
    const t = q.toLowerCase().trim();
    return base.filter((i) =>
      (!origin || i.origin === origin) &&
      (!branchF || (branchF === "_none" ? !i.branch : (edits[i.id]?.branch ?? i.branch) === branchF)) &&
      (!t || `${i.name} ${i.url} ${i.description}`.toLowerCase().includes(t)),
    );
  }, [data, tab, q, origin, branchF, edits]);

  const cur = items[Math.min(cursor, items.length - 1)] as Item | undefined;
  const view = cur ? { ...cur, ...edits[cur.id] } : undefined;

  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new view starts at the top
  useEffect(() => { setCursor(0); setSelected(new Set()); }, [tab, q, origin, branchF]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const stage = useCallback((ids: string[], a: Action | null) => {
    setActions((prev) => {
      const next = { ...prev };
      for (const id of ids) if (a) next[id] = a; else delete next[id];
      return next;
    });
    if (a) setHistory((h) => [...h, ...ids].slice(-200));
  }, []);

  const advance = useCallback(() => {
    // jump to the next item without a staged decision
    for (let i = cursor + 1; i < items.length; i++) if (!actions[items[i].id]) return setCursor(i);
    setCursor((c) => Math.min(c + 1, items.length - 1));
  }, [cursor, items, actions]);

  const decide = useCallback((a: Action) => {
    if (!cur) return;
    if (a === "approve" && !(edits[cur.id]?.sub ?? cur.sub)) return flash("Pick a branch first.");
    stage([cur.id], actions[cur.id] === a ? null : a);
    if (actions[cur.id] !== a) advance();
  }, [cur, edits, actions, stage, advance]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  const patch = (p: Patch) => cur && setEdits((e) => ({ ...e, [cur.id]: { ...e[cur.id], ...p } }));

  const stagedCount = useMemo(() => {
    const c = { approve: 0, reject: 0, defer: 0, unpublish: 0, edits: 0 };
    for (const a of Object.values(actions)) c[a]++;
    for (const id of Object.keys(edits)) if (!actions[id]) c.edits++;
    return c;
  }, [actions, edits]);
  const totalStaged = stagedCount.approve + stagedCount.reject + stagedCount.defer + stagedCount.unpublish + stagedCount.edits;

  async function commit() {
    if (!data || !totalStaged || committing) return;
    if (data.mode === "readonly") return flash("Read-only: add GITHUB_TOKEN to this deployment to commit.");
    const liveIds = new Set(data.library.map((e) => e.id));
    const ids = new Set([...Object.keys(actions), ...Object.keys(edits)]);
    const decisions = [...ids].map((id) => ({
      id,
      action: actions[id] || (liveIds.has(id) ? "update" : "defer"),
      patch: edits[id],
    }));
    setCommitting(true);
    const res = await fetch("/api/portal/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisions }) }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setCommitting(false);
    if (!res?.ok) return flash(out.error || "Commit failed. Your decisions are still staged.");
    setActions({}); setEdits({}); setSelected(new Set()); setHistory([]);
    const t = out.tally || {};
    flash(`Committed: ${t.approve || 0} live, ${t.reject || 0} declined${out.problems?.length ? ` · ${out.problems.length} skipped` : ""}. The site rebuilds in about a minute.`);
    if (out.problems?.length) console.warn(out.problems);
    load();
  }

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select");
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); commit(); return; }
      if (typing) { if (e.key === "Escape") (e.target as HTMLElement).blur(); return; }
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
      else if (k === "k" || e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      else if (k === "a" && e.shiftKey) { approveSelected(); }
      else if (k === "a" && tab === "queue") decide("approve");
      else if ((k === "d" || k === "r") && tab === "queue") decide("reject");
      else if (k === "r" && tab === "live") decide("unpublish");
      else if (k === "s") advance();
      else if (k === "x" && cur) toggle(cur.id);
      else if (k === "e") { e.preventDefault(); nameField.current?.focus(); }
      else if (k === "o" && cur) window.open(cur.url, "_blank", "noopener");
      else if (k === "u") undo();
      else if (k === "/") { e.preventDefault(); search.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const undo = () => setHistory((h) => { const id = h.at(-1); if (id) stage([id], null); return h.slice(0, -1); });
  function approveSelected() {
    const ids = [...selected].filter((id) => { const i = items.find((x) => x.id === id); return i && (edits[id]?.sub ?? i.sub); });
    const missing = selected.size - ids.length;
    stage(ids, tab === "live" ? "unpublish" : "approve");
    setSelected(new Set());
    if (missing) flash(`${missing} still need a branch.`);
  }
  const declineSelected = () => { stage([...selected], tab === "live" ? "unpublish" : "reject"); setSelected(new Set()); };

  if (error) return <div className="pt-center"><p className="err">{error}</p></div>;
  if (!data) return <div className="pt-center"><span className="spin" /></div>;

  const queueLeft = data.queue.filter((i) => !actions[i.id]).length;
  const reviewed = data.library.length + data.rejected.length;
  const pct = reviewed + data.queue.length ? Math.round((reviewed / (reviewed + data.queue.length)) * 100) : 100;
  const origins = [...new Set(data.queue.map((i) => i.origin))];
  const suggestion = view && tab === "queue" && !view.sub ? classify({ name: view.name, url: view.url, description: view.description }) : null;

  return (
    <div className="pt">
      <header className="pt-top">
        <Link href="/" className="brand"><Mark /> <span>Portal</span></Link>
        <nav className="pt-tabs">
          <button className="pill sm" aria-pressed={tab === "queue"} onClick={() => setTab("queue")}>Queue <span className="n">{queueLeft}</span></button>
          <button className="pill sm" aria-pressed={tab === "live"} onClick={() => setTab("live")}>Live <span className="n">{data.library.length}</span></button>
          <button className="pill sm" aria-pressed={tab === "declined"} onClick={() => setTab("declined")}>Declined <span className="n">{data.rejected.length}</span></button>
        </nav>
        <div className="pt-progress" title={`${pct}% of everything reviewed`}>
          <svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" stroke="var(--line-2)" strokeWidth="2.5" fill="none" /><circle cx="13" cy="13" r="10" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeDasharray={`${(pct / 100) * 62.8} 62.8`} transform="rotate(-90 13 13)" strokeLinecap="round" /></svg>
          <span className="mono">{pct}%</span>
        </div>
        <span className="spacer" />
        <span className={`pt-mode ${data.mode}`}>{data.mode === "github" ? "Commits to GitHub" : data.mode === "local" ? "Local files" : "Read-only"}</span>
        <ThemeToggle />
        <form action="/api/portal/logout" method="post"><button className="pill sm ghost">Log out</button></form>
      </header>

      {data.mode === "readonly" && (
        <div className="pt-banner">Read-only on this deployment. Add a <b>GITHUB_TOKEN</b> (fine-grained, Contents read and write on this repository) in Vercel → Settings → Environment Variables, then redeploy. Staged decisions are kept in this browser meanwhile.</div>
      )}

      {tab === "declined" ? (
        <div className="pt-declined wrap">
          <p className="muted">{data.rejected.length ? "Links declined before. Submissions of these are turned away automatically." : "Nothing declined yet."}</p>
          <div className="chips">{data.rejected.map((k) => <span key={k} className="tag mono">{k}</span>)}</div>
        </div>
      ) : (
        <div className="pt-body">
          <aside className="pt-list">
            <div className="pt-filters">
              <label className="pt-search"><SearchIcon size={15} /><input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" /><kbd>/</kbd></label>
              <div className="chips">
                {tab === "queue" && <button className="pill sm ghost" aria-pressed={!origin} onClick={() => setOrigin("")}>All</button>}
                {tab === "queue" && origins.map((o) => (
                  <button key={o} className="pill sm ghost" aria-pressed={origin === o} onClick={() => setOrigin(origin === o ? "" : o)}>
                    {ORIGINS[o] || o} <span className="n">{data.queue.filter((i) => i.origin === o).length}</span>
                  </button>
                ))}
              </div>
              <select className="select pt-select" value={branchF} onChange={(e) => setBranchF(e.target.value)}>
                <option value="">Every branch</option>
                {tab === "queue" && <option value="_none">Needs a branch</option>}
                {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <div className="pt-bulk">
                <button className="pill sm ghost" onClick={() => setSelected(selected.size ? new Set() : new Set(items.map((i) => i.id)))}>
                  {selected.size ? `Clear ${selected.size}` : `Select all ${items.length}`}
                </button>
                {selected.size > 0 && <>
                  <button className="pill sm" onClick={approveSelected}><CheckIcon size={14} /> {tab === "live" ? "Unpublish" : "Approve"} {selected.size}</button>
                  {tab === "queue" && <button className="pill sm" onClick={declineSelected}><XIcon size={14} /> Decline</button>}
                </>}
              </div>
            </div>
            <div className="pt-rows" ref={listRef}>
              {items.length === 0 && <p className="muted" style={{ padding: 20 }}>{tab === "queue" ? "Queue clear. Beautiful." : "Nothing live yet."}</p>}
              {items.map((i, n) => {
                const a = actions[i.id];
                const b = edits[i.id]?.branch ?? i.branch;
                return (
                  <div key={i.id} data-i={n} className={`pt-row ${n === cursor ? "cur" : ""} ${a || ""}`} onClick={() => setCursor(n)}>
                    <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} onClick={(e) => e.stopPropagation()} aria-label="Select" />
                    <Favicon host={hostOf(i.url)} name={i.name} />
                    <div className="pt-row-main">
                      <b>{edits[i.id]?.name ?? i.name}</b>
                      <span className="mono">{hostOf(i.url)}</span>
                    </div>
                    <span className="swatch" style={{ "--c": b ? branchColor(b) : "transparent", boxShadow: b ? undefined : "inset 0 0 0 1px var(--faint)" } as React.CSSProperties} title={b || "No branch"} />
                    {a && <span className={`pt-badge ${a}`}>{a === "approve" ? "✓" : a === "reject" || a === "unpublish" ? "✕" : "…"}</span>}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="pt-detail">
            {view ? (
              <>
                <div className="pt-detail-head">
                  <span className="tag">{ORIGINS[view.origin] || view.origin}</span>
                  {"submittedAt" in view && <span className="muted mono" style={{ fontSize: 12 }}>{new Date(view.submittedAt || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                  {view.submitter && <span className="muted" style={{ fontSize: 12 }}>by @{view.submitter}</span>}
                  <span className="spacer" />
                  <a className="pill sm" href={view.url} target="_blank" rel="noopener">Open <ArrowIcon size={14} /> <kbd>O</kbd></a>
                </div>
                <div className="pt-grid">
                  <div className="shot pt-shot">
                    <div className="chrome"><i /><i /><i /><span>{hostOf(view.url)}</span></div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img key={view.url} src={`https://s0.wp.com/mshots/v1/${encodeURIComponent(view.url)}?w=1000&h=625`} alt="" />
                  </div>
                  <div className="pt-form">
                    <label className="field"><span>Name</span><input ref={nameField} className="input" value={view.name} onChange={(e) => patch({ name: e.target.value })} /></label>
                    <label className="field"><span>URL</span><input className="input mono" value={view.url} onChange={(e) => patch({ url: e.target.value })} /></label>
                    <label className="field"><span>Description</span><textarea className="textarea" value={view.description} onChange={(e) => patch({ description: e.target.value })} placeholder="One line on why it's useful" /></label>
                    {"note" in view && view.note && <p className="note">Note: {view.note}</p>}
                    <div className="field"><span>Kind</span>
                      <div className="chips">{KINDS.map((k) => <button key={k.id} type="button" className="pill sm" aria-pressed={view.kind === k.id} onClick={() => patch({ kind: k.id as Entry["kind"] })}>{k.name}</button>)}</div>
                    </div>
                    <div className="two">
                      <label className="field"><span>Branch</span>
                        <select className="select" value={view.branch} onChange={(e) => patch({ branch: e.target.value, sub: BRANCHES.find((b) => b.id === e.target.value)?.subs[0]?.id || "" })}>
                          <option value="">—</option>
                          {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </label>
                      <label className="field"><span>Sub-branch</span>
                        <select className="select" value={view.sub} onChange={(e) => patch({ sub: e.target.value })}>
                          <option value="">—</option>
                          {BRANCHES.find((b) => b.id === view.branch)?.subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {suggestion?.sub && (
                      <button type="button" className="pill sm pt-suggest" onClick={() => patch({ branch: suggestion.branch, sub: suggestion.sub })}>
                        Suggest: {BRANCHES.find((b) => b.id === suggestion.branch)?.subs.find((s) => s.id === suggestion.sub)?.name} <span className="n">{Math.round(suggestion.confidence * 100)}%</span>
                      </button>
                    )}
                    <div className="two">
                      <label className="field"><span>Tags</span><input className="input" value={(view.tags || []).join(", ")} onChange={(e) => patch({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></label>
                      <label className="field"><span>Pricing</span>
                        <select className="select" value={view.pricing || ""} onChange={(e) => patch({ pricing: e.target.value })}>
                          {["", "Free", "Freemium", "Paid", "Subscription", "Pay per use", "Open source"].map((p) => <option key={p} value={p}>{p || "—"}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="chips">
                      <button type="button" className="pill sm" aria-pressed={!!view.featured} onClick={() => patch({ featured: !view.featured })}>Featured</button>
                      <button type="button" className="pill sm" aria-pressed={!!view.gem} onClick={() => patch({ gem: !view.gem })}>Hidden gem</button>
                    </div>
                  </div>
                </div>
                <div className="pt-actions">
                  {tab === "queue" ? <>
                    <button className={`pill lg pt-no ${actions[view.id] === "reject" ? "on" : ""}`} onClick={() => decide("reject")}><XIcon size={16} /> Decline <kbd>D</kbd></button>
                    <button className="pill lg ghost" onClick={advance}>Later <kbd>S</kbd></button>
                    <button className={`pill lg pt-yes ${actions[view.id] === "approve" ? "on" : ""}`} onClick={() => decide("approve")}><CheckIcon size={16} /> Approve <kbd>A</kbd></button>
                  </> : <>
                    <button className={`pill lg pt-no ${actions[view.id] === "unpublish" ? "on" : ""}`} onClick={() => decide("unpublish")}><XIcon size={16} /> Unpublish <kbd>R</kbd></button>
                    <a className="pill lg ghost" href={`/${view.id}`} target="_blank">View on site <ArrowIcon size={14} /></a>
                  </>}
                </div>
              </>
            ) : <p className="muted" style={{ padding: 40 }}>Select something on the left.</p>}
          </section>
        </div>
      )}

      {(totalStaged > 0 || toast) && (
        <div className="pt-dock glass">
          {toast ? <span>{toast}</span> : <>
            <span className="mono">
              {stagedCount.approve > 0 && <b className="ok">{stagedCount.approve} approve</b>}
              {stagedCount.reject > 0 && <b className="err"> · {stagedCount.reject} decline</b>}
              {stagedCount.unpublish > 0 && <b className="err"> · {stagedCount.unpublish} unpublish</b>}
              {stagedCount.edits > 0 && <b> · {stagedCount.edits} edited</b>}
            </span>
            <button className="pill sm ghost" onClick={() => { if (confirm("Discard every staged decision?")) { setActions({}); setEdits({}); setHistory([]); } }}>Discard</button>
            <button className="pill sm ghost" onClick={undo} disabled={!history.length}>Undo <kbd>U</kbd></button>
            <button className="pill accent" onClick={commit} disabled={committing}>{committing ? <span className="spin" /> : null} Commit <kbd style={{ color: "inherit" }}>⌘↵</kbd></button>
          </>}
        </div>
      )}
    </div>
  );
}

const rank = (i: QueueItem) => ({ community: 0, review: 1, bookmarks: 2, legacy: 3 } as Record<string, number>)[i.origin] ?? 4;
