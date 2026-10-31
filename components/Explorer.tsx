"use client";
// Home: the Field on top, the finder at its foot, then filters and results.
// The browser loads one compact index (public/api/index.json) and does everything else locally.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Card, { KIND_LABEL } from "./Card";
import dynamic from "next/dynamic";
import Field, { type FieldBranch } from "./Field";

// three.js only loads in the browser, after the page is interactive
const Field3D = dynamic(() => import("./Field3D"), { ssr: false, loading: () => <div className="f3-slot"><section className="stage f3" /></div> });
import { SearchIcon } from "./Icons";
import type { Row } from "@/lib/types";

export interface BranchMeta extends FieldBranch { count: number; subs: { id: string; name: string }[] }

const PAGE = 48;

function score(r: Row, terms: string[], subName: string) {
  const name = r.n.toLowerCase();
  const hay = `${name} ${r.h} ${r.d.toLowerCase()} ${r.t.join(" ").toLowerCase()} ${subName.toLowerCase()} ${r.k}`;
  let s = 0;
  for (const t of terms) {
    if (!hay.includes(t)) return 0;
    s += name.startsWith(t) ? 6 : name.includes(t) ? 4 : r.h.includes(t) ? 3 : 1;
  }
  return s + (r.f ? 0.5 : 0);
}

export default function Explorer({ branches, initial, total }: { branches: BranchMeta[]; initial: Row[]; total: number }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState<"new" | "az">("new");
  const [paging, setPaging] = useState({ key: "", n: PAGE });
  const input = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const subName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of branches) for (const s of b.subs) m.set(`${b.id}/${s.id}`, s.name);
    return m;
  }, [branches]);
  const color = useMemo(() => new Map(branches.map((b) => [b.id, b.color])), [branches]);
  const fieldBranches = useMemo(() => branches.map(({ id, name, color }) => ({ id, name, color })), [branches]);

  // full index, once
  useEffect(() => {
    if (total <= initial.length) return;
    fetch("/api/index.json").then((r) => r.json()).then(setRows).catch(() => {});
  }, [total, initial.length]);

  // read and write ?q=&b=&k= so every view is a shareable link
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL after hydration
    setQ(p.get("q") || ""); setBranch(p.get("b") || ""); setKind(p.get("k") || "");
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (branch) p.set("b", branch);
    if (kind) p.set("k", kind);
    const s = p.toString();
    history.replaceState(null, "", s ? `?${s}` : location.pathname);
  }, [q, branch, kind]);

  // ⌘K, Ctrl-K or / focuses the finder; Esc clears it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (e.key === "Escape" && document.activeElement === input.current) setQ("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const results = useMemo(() => {
    let list = rows.filter((r) => (!branch || r.b === branch) && (!kind || r.k === kind));
    if (terms.length) {
      list = list
        .map((r) => [score(r, terms, subName.get(`${r.b}/${r.s}`) || ""), r] as const)
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0])
        .map(([, r]) => r);
    } else if (sort === "az") list = [...list].sort((a, b) => a.n.localeCompare(b.n));
    return list;
  }, [rows, branch, kind, terms, sort, subName]);

  const match = useMemo(() => (terms.length || kind ? new Set(results.map((r) => r.i)) : null), [terms, kind, results]);
  const kinds = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) if (!branch || r.b === branch) c.set(r.k, (c.get(r.k) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, branch]);
  const branchCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) c.set(r.b, (c.get(r.b) || 0) + 1);
    return c;
  }, [rows]);

  const filterKey = `${q}|${branch}|${kind}|${sort}`;
  const shown = paging.key === filterKey ? paging.n : PAGE;
  const more = useCallback(() => setPaging((p) => ({ key: filterKey, n: (p.key === filterKey ? p.n : PAGE) + PAGE })), [filterKey]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, results.length]);

  const live = rows.length;
  const copy = (
    <>
      <div className="eyebrow">Open source · open data · built by everyone</div>
          <h1>The open library of<br />the useful internet</h1>
          <p className="lede">Grown in the open. Shared with everyone. Websites, AI tools, apps and extensions that anyone can add to, take from and build on.</p>
    </>
  );
  return (
    <>
      <Field3D
        rows={rows}
        branches={fieldBranches}
        match={match}
        focus={branch}
        query={q}
        onQuery={setQ}
        subName={(r) => subName.get(`${r.b}/${r.s}`) || ""}
        fallback={
          <section className="stage">
            <Field rows={rows} branches={fieldBranches} match={match} focus={branch} />
            <div className="veil" />
            <div className="copy">{copy}</div>
          </section>
        }
      >
        {copy}
      </Field3D>


      <div className="finder">
        <label>
          <SearchIcon size={20} />
          <span className="sr">Search the library</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={live ? `Search ${live.toLocaleString("en")} links…` : "Search the library…"}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hide-sm">⌘K</kbd>
        </label>
      </div>

      <main className="wrap" id="browse">
        <div className="controls">
          <div className="rail" role="toolbar" aria-label="Branches">
            <button className="pill sm" aria-pressed={!branch} onClick={() => setBranch("")}>All <span className="n">{live}</span></button>
            {branches.filter((b) => branchCounts.get(b.id)).map((b) => (
              <button key={b.id} className="pill sm" aria-pressed={branch === b.id} onClick={() => setBranch(branch === b.id ? "" : b.id)}>
                <span className="swatch" style={{ "--c": b.color } as React.CSSProperties} /> {b.name} <span className="n">{branchCounts.get(b.id)}</span>
              </button>
            ))}
          </div>
          {kinds.length > 1 && (
            <div className="row">
              <div className="rail" role="toolbar" aria-label="Kinds">
                <button className="pill sm ghost" aria-pressed={!kind} onClick={() => setKind("")}>Everything</button>
                {kinds.map(([k, n]) => (
                  <button key={k} className="pill sm ghost" aria-pressed={kind === k} onClick={() => setKind(kind === k ? "" : k)}>
                    {KIND_LABEL[k] || k} <span className="n">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="meta-line">
          <span className="mono">{results.length.toLocaleString("en")} {results.length === 1 ? "result" : "results"}</span>
          {!terms.length && (
            <span className="chips">
              <button className="pill sm ghost" aria-pressed={sort === "new"} onClick={() => setSort("new")}>Newest</button>
              <button className="pill sm ghost" aria-pressed={sort === "az"} onClick={() => setSort("az")}>A–Z</button>
            </span>
          )}
        </div>

        {results.length ? (
          <div className="grid">
            {results.slice(0, shown).map((r) => (
              <Card key={r.i} row={r} color={color.get(r.b) || "#9c9c9a"} subName={subName.get(`${r.b}/${r.s}`) || ""} />
            ))}
          </div>
        ) : (
          <div className="empty glass">
            <h2>{live ? "Nothing matches that yet" : "The library is being re-curated"}</h2>
            <p>{live ? "Know a link that should be here? Add it." : "The 11:11 team is reviewing every link again. Approved links appear here as they land."}</p>
            <p style={{ marginTop: 18 }}><Link className="pill accent" href="/submit">Submit a link</Link></p>
          </div>
        )}
        {shown < results.length && <div ref={sentinel} className="more"><button className="pill" onClick={more}>Show more</button></div>}
      </main>
    </>
  );
}
