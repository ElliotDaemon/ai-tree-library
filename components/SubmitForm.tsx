"use client";
import { useEffect, useRef, useState } from "react";
import { KIND_LABEL } from "./Card";
import { CheckIcon } from "./Icons";

interface B { id: string; name: string; subs: { id: string; name: string }[] }
interface Meta { url: string; host: string; name: string; description: string; kind: string; branch: string; sub: string }

export default function SubmitForm({ branches }: { branches: B[] }) {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [form, setForm] = useState({ name: "", description: "", kind: "website", branch: "", sub: "", submitter: "", note: "", website: "" });
  const [phase, setPhase] = useState<"idle" | "reading" | "ready" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    if (!/\.[a-z]{2,}/i.test(url)) return;
    timer.current = setTimeout(async () => {
      setPhase("reading");
      const res = await fetch(`/api/meta?url=${encodeURIComponent(url.trim())}`).catch(() => null);
      const m = res?.ok ? ((await res.json()) as Meta) : null;
      if (!m) { setPhase("error"); setMsg("That link didn't read as a public page."); return; }
      setMeta(m);
      setForm((f) => ({ ...f, name: m.name, description: m.description, kind: m.kind, branch: m.branch, sub: m.sub }));
      setPhase("ready"); setMsg("");
    }, 500);
  }, [url]);

  const subs = branches.find((b) => b.id === form.branch)?.subs || [];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setPhase("sending");
    const res = await fetch("/api/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: meta?.url || url, ...form }) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { message?: string; error?: string }) : {};
    if (res?.ok) { setPhase("done"); setMsg(data.message || "Received."); }
    else { setPhase("ready"); setMsg(data.error || "Something went wrong. Try again."); }
  }

  if (phase === "done")
    return (
      <div className="sheet" style={{ textAlign: "center" }}>
        <div style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: 999, background: "var(--accent)", color: "#fff", marginBottom: 16 }}><CheckIcon size={26} /></div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Thank you</h2>
        <p className="muted" style={{ margin: "0 0 22px" }}>{msg}</p>
        <button className="pill" onClick={() => { setUrl(""); setMeta(null); setPhase("idle"); setForm((f) => ({ ...f, name: "", description: "", note: "" })); }}>Submit another</button>
      </div>
    );

  return (
    <form className="sheet" onSubmit={send}>
      <label className="field">
        <span>Link</span>
        <input className="input big" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus required />
      </label>
      <p className="note" style={{ margin: "-4px 0 18px", minHeight: 18 }}>
        {phase === "reading" ? <><span className="spin" /> Reading the page…</> : phase === "error" ? <span className="err">{msg}</span> : meta ? <>Found <span className="mono">{meta.host}</span>. Check the details below.</> : "Websites, tools, iOS and Android apps, widgets and browser extensions are all welcome."}
      </p>
      {meta && (
        <>
          <div className="two">
            <label className="field"><span>Name</span><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required /></label>
            <label className="field"><span>What is it</span>
              <select className="select" value={form.kind} onChange={(e) => set("kind", e.target.value)}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>One line on why it&apos;s useful</span><textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={280} /></label>
          <div className="two">
            <label className="field"><span>Branch</span>
              <select className="select" value={form.branch} onChange={(e) => { set("branch", e.target.value); set("sub", ""); }}>
                <option value="">Let the 11:11 team decide</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Sub-branch</span>
              <select className="select" value={form.sub} onChange={(e) => set("sub", e.target.value)} disabled={!subs.length}>
                <option value="">—</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div className="two">
            <label className="field"><span>Credit (optional)</span><input className="input" placeholder="@handle" value={form.submitter} onChange={(e) => set("submitter", e.target.value)} maxLength={60} /></label>
            <label className="field"><span>Note to the 11:11 team (optional)</span><input className="input" value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={280} /></label>
          </div>
          <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={(e) => set("website", e.target.value)} name="website" />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            <button className="pill accent lg" disabled={phase === "sending"}>{phase === "sending" ? <span className="spin" /> : null} Submit for review</button>
            {msg && <span className="note err">{msg}</span>}
          </div>
        </>
      )}
    </form>
  );
}
