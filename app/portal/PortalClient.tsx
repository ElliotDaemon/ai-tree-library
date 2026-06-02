// Interactive portal dashboard. Owns:
//   - Expandable drilldowns on the stat-strip (Ready / Pending / Hidden /
//     Articles cards expand inline to show their full list)
//   - Inline Approve / Hide actions on every pending-review row (optimistic
//     UI — row fades out on success)
//   - In-list filter/search
//
// The wrapping page.tsx owns the server data fetch. This component just
// receives the typed data and renders the UI.

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import type { DashboardData, DashboardEntry, DashboardArticle } from "../../lib/portal-data";

// Parse a response that we expect to be JSON, but gracefully recover
// when the platform (Vercel proxy, network appliance) returns plain
// text — typically for 413/502/504 errors. Without this, the user sees
// "Unexpected token 'R'…" for "Request Entity Too Large" responses.
async function safeJson(res: Response): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return { ok: false, error: `Bad JSON from server (HTTP ${res.status})` };
    }
  }
  const text = await res.text();
  const snippet = text.slice(0, 200).trim();
  return { ok: false, error: `HTTP ${res.status} — ${snippet || res.statusText}` };
}

interface Props {
  data: DashboardData;
}

function fmtNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}

function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function shortHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

const SITE = "https://aitreelibrary.com";

type PanelKey = "ready" | "pending" | "hidden" | "articles" | "top-tools" | "top-categories" | "top-pages" | "searches" | null;

export default function PortalClient({ data }: Props) {
  const [openPanel, setOpenPanel] = useState<PanelKey>(
    data.entries.pendingReview.length > 0 ? "pending" : null,
  );
  const [search, setSearch] = useState("");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set()); // optimistically-removed rows
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const pending = useMemo(
    () => data.entries.pendingReview.filter((e) => !hiddenIds.has(e.id)),
    [data.entries.pendingReview, hiddenIds],
  );

  const filtered = (list: DashboardEntry[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((e) => e.name.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
  };

  async function setStatus(id: string, status: "Ready" | "Hidden") {
    setActionErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch("/api/portal/set-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `${res.status}`);
      // Optimistic remove from local pending list
      startTransition(() => {
        setHiddenIds((prev) => new Set(prev).add(id));
      });
    } catch (e) {
      setActionErrors((prev) => ({ ...prev, [id]: (e as Error).message }));
    }
  }

  const pendingCount = pending.length;
  const visitors = data.visitors;

  return (
    <div className="pv-page">
      <header className="pv-header">
        <div className="pv-brand">
          <div className="pv-brand-dot" />
          <div className="pv-brand-text">
            <div className="pv-brand-name">AI Tree Library</div>
            <div className="pv-brand-tag">Portal</div>
          </div>
        </div>
        <div className="pv-header-meta">
          <span className="pv-meta-item">Updated {ageLabel((Date.now() - new Date(data.generatedAt).getTime()) / 3_600_000)} ago</span>
          <Link href="/" className="pv-meta-link">Site</Link>
          <form method="POST" action="/api/portal/logout" style={{ display: "inline" }}>
            <button type="submit" className="pv-meta-link" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", padding: 0 }}>
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* AT-A-GLANCE STRIP — compact, no boxes */}
      <section className="pv-strip">
        <StripStat
          label="Ready"
          value={data.statusCounts.ready}
          active={openPanel === "ready"}
          onClick={() => setOpenPanel(openPanel === "ready" ? null : "ready")}
        />
        <StripStat
          label="Pending review"
          value={pendingCount}
          tone={pendingCount > 0 ? "warn" : undefined}
          active={openPanel === "pending"}
          onClick={() => setOpenPanel(openPanel === "pending" ? null : "pending")}
        />
        <StripStat
          label="Hidden"
          value={data.statusCounts.hidden}
          active={openPanel === "hidden"}
          onClick={() => setOpenPanel(openPanel === "hidden" ? null : "hidden")}
        />
        <StripStat
          label="Articles"
          value={data.articles.count}
          active={openPanel === "articles"}
          onClick={() => setOpenPanel(openPanel === "articles" ? null : "articles")}
        />
        <StripStat label="Total library" value={data.statusCounts.total} />
        {visitors ? (
          <StripStat label="Visitors 28d" value={visitors.month} />
        ) : (
          <StripStat label="Visitors 28d" value={"—"} sub="see Vercel" />
        )}
      </section>

      {/* Drilldown panel — shows the full list for whichever strip card is open */}
      {openPanel === "pending" && (
        <PendingReviewPanel
          entries={pending}
          search={search}
          onSearch={setSearch}
          onApprove={(id) => setStatus(id, "Ready")}
          onHide={(id) => setStatus(id, "Hidden")}
          errors={actionErrors}
        />
      )}
      {openPanel === "ready" && (
        <EntryListPanel
          title="Ready"
          entries={filtered(data.entries.ready)}
          search={search}
          onSearch={setSearch}
          mode="ready"
        />
      )}
      {openPanel === "hidden" && (
        <EntryListPanel
          title="Hidden"
          entries={filtered(data.entries.hidden)}
          search={search}
          onSearch={setSearch}
          mode="hidden"
        />
      )}
      {openPanel === "articles" && (
        <ArticlesPanel articles={data.articles.items} />
      )}

      {/* TRAFFIC — only if Vercel data available */}
      {visitors && (
        <section className="pv-section">
          <h2 className="pv-h2">Traffic</h2>
          <div className="pv-traffic">
            <div className="pv-traffic-cell">
              <div className="pv-num">{fmtNum(visitors.day)}</div>
              <div className="pv-num-sub">today</div>
            </div>
            <div className="pv-traffic-cell">
              <div className="pv-num">{fmtNum(visitors.week)}</div>
              <div className="pv-num-sub">last 7 days</div>
            </div>
            <div className="pv-traffic-cell">
              <div className="pv-num">{fmtNum(visitors.month)}</div>
              <div className="pv-num-sub">last 28 days</div>
            </div>
          </div>
        </section>
      )}

      {/* Top tools / categories / pages — only if Vercel data */}
      {data.topToolEvents && data.topToolEvents.length > 0 && (
        <section className="pv-section">
          <h2 className="pv-h2">Top tools <span className="pv-h2-sub">(28d)</span></h2>
          <BarList
            rows={data.topToolEvents.map((t, i) => ({
              rank: i + 1,
              title: <Link href={`/${t.slug}`}>{t.name}</Link>,
              metaRight: `${t.views} views · ${Math.round(t.ctr * 100)}% CTR`,
              fill: t.views / (data.topToolEvents![0]?.views || 1),
            }))}
          />
        </section>
      )}

      {data.topCategoryEvents && data.topCategoryEvents.length > 0 && (
        <section className="pv-section">
          <h2 className="pv-h2">Top categories <span className="pv-h2-sub">(28d)</span></h2>
          <BarList
            rows={data.topCategoryEvents.map((c, i) => ({
              rank: i + 1,
              title: <Link href={`/category/${c.slug}`}>{c.name}</Link>,
              metaRight: `${c.views} views`,
              fill: c.views / (data.topCategoryEvents![0]?.views || 1),
            }))}
          />
        </section>
      )}

      {data.topRoutes && data.topRoutes.length > 0 && (
        <section className="pv-section">
          <h2 className="pv-h2">Top pages <span className="pv-h2-sub">(28d)</span></h2>
          <BarList
            rows={data.topRoutes.map((r, i) => ({
              rank: i + 1,
              title: <a href={r.route} target="_blank" rel="noopener noreferrer">{r.route}</a>,
              metaRight: `${r.views} views`,
              fill: r.views / (data.topRoutes![0]?.views || 1),
            }))}
          />
        </section>
      )}

      {data.topSearches && data.topSearches.length > 0 && (
        <section className="pv-section">
          <h2 className="pv-h2">Recent searches</h2>
          <div className="pv-tags">
            {data.topSearches.map((q) => (
              <span key={q} className="pv-tag">{q}</span>
            ))}
          </div>
        </section>
      )}

      {/* SYSTEM / health footer */}
      <section className="pv-section pv-footer">
        <div className="pv-health">
          <span>
            Notion API <strong className={data.notionOk ? "pv-ok" : "pv-bad"}>{data.notionOk ? "OK" : "down"}</strong>
          </span>
          <span>
            Vercel Analytics <strong className={data.vercelOk ? "pv-ok" : "pv-warn"}>{data.vercelOk ? "OK" : "not configured"}</strong>
          </span>
          <a href={data.vercelDashboardUrl} target="_blank" rel="noopener noreferrer" className="pv-meta-link">
            Open Vercel Analytics →
          </a>
        </div>
        {data.errors.length > 0 && (
          <ul className="pv-errors">
            {data.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Small subcomponents ----------

function StripStat({
  label,
  value,
  sub,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "warn";
  active?: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      className={`pv-strip-cell ${active ? "is-active" : ""} ${tone === "warn" ? "is-warn" : ""} ${interactive ? "is-clickable" : ""}`}
      onClick={onClick}
      disabled={!interactive}
    >
      <div className="pv-strip-value">{typeof value === "number" ? fmtNum(value) : value}</div>
      <div className="pv-strip-label">
        {label}
        {sub ? <span className="pv-strip-sub"> · {sub}</span> : null}
      </div>
      {interactive ? (
        <span className="pv-strip-chevron" aria-hidden>
          {active ? "▴" : "▾"}
        </span>
      ) : null}
    </button>
  );
}

function PendingReviewPanel({
  entries,
  search,
  onSearch,
  onApprove,
  onHide,
  errors,
}: {
  entries: DashboardEntry[];
  search: string;
  onSearch: (s: string) => void;
  onApprove: (id: string) => void;
  onHide: (id: string) => void;
  errors: Record<string, string>;
}) {
  const filtered = entries.filter(
    (e) =>
      !search.trim() ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.url.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="pv-section pv-panel">
      <div className="pv-panel-head">
        <div>
          <div className="pv-panel-title">Pending review</div>
          <div className="pv-panel-sub">
            {entries.length} item{entries.length === 1 ? "" : "s"} awaiting your decision
          </div>
        </div>
        <input
          className="pv-search"
          type="text"
          placeholder="Search name or URL…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="pv-empty">
          {entries.length === 0 ? "Nothing to review — caught up." : "No matches."}
        </div>
      ) : (
        <div className="pv-table">
          {filtered.map((entry) => (
            <PendingRow
              key={entry.id}
              entry={entry}
              onApprove={() => onApprove(entry.id)}
              onHide={() => onHide(entry.id)}
              error={errors[entry.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PendingRow({
  entry,
  onApprove,
  onHide,
  error,
}: {
  entry: DashboardEntry;
  onApprove: () => void;
  onHide: () => void;
  error?: string;
}) {
  const [busy, setBusy] = useState<"approve" | "hide" | null>(null);
  const run = async (action: "approve" | "hide", fn: () => void) => {
    setBusy(action);
    fn();
    // The parent removes the row optimistically; if an error comes back,
    // re-enable. The parent passes the error via the `error` prop.
    setTimeout(() => setBusy(null), 1200);
  };
  const host = entry.url ? shortHost(entry.url) : "";
  const status = entry.status;
  return (
    <div className="pv-row">
      <div className="pv-row-main">
        <div className="pv-row-name">
          {entry.name || "(untitled)"}
          <span className={`pv-status-pill pv-status-${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
        </div>
        {entry.url ? (
          <a className="pv-row-host" href={entry.url} target="_blank" rel="noopener noreferrer">
            {host} ↗
          </a>
        ) : (
          <span className="pv-row-host pv-row-host-empty">no URL</span>
        )}
      </div>
      <div className="pv-row-meta">
        <span>{ageLabel(entry.ageHours)}</span>
        {entry.source ? (
          <>
            <span className="pv-sep">·</span>
            <span>{entry.source}</span>
          </>
        ) : null}
      </div>
      <div className="pv-row-actions">
        {entry.slug ? (
          <Link href={`/${entry.slug}`} target="_blank" rel="noopener noreferrer" className="pv-btn pv-btn-ghost">
            View
          </Link>
        ) : null}
        <button
          type="button"
          className="pv-btn pv-btn-primary"
          onClick={() => run("approve", onApprove)}
          disabled={busy !== null}
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
        <button
          type="button"
          className="pv-btn pv-btn-danger"
          onClick={() => run("hide", onHide)}
          disabled={busy !== null}
        >
          {busy === "hide" ? "…" : "Hide"}
        </button>
      </div>
      {error ? <div className="pv-row-error">{error}</div> : null}
    </div>
  );
}

function EntryListPanel({
  title,
  entries,
  search,
  onSearch,
  mode,
}: {
  title: string;
  entries: DashboardEntry[];
  search: string;
  onSearch: (s: string) => void;
  mode: "ready" | "hidden";
}) {
  const [showCount, setShowCount] = useState(50);
  const visible = entries.slice(0, showCount);
  return (
    <section className="pv-section pv-panel">
      <div className="pv-panel-head">
        <div>
          <div className="pv-panel-title">{title}</div>
          <div className="pv-panel-sub">{entries.length} {entries.length === 1 ? "entry" : "entries"}</div>
        </div>
        <input
          className="pv-search"
          type="text"
          placeholder="Search name or URL…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {entries.length === 0 ? (
        <div className="pv-empty">No matches.</div>
      ) : (
        <>
          <div className="pv-table pv-table-dense">
            {visible.map((entry) => (
              <div className="pv-row pv-row-dense" key={entry.id}>
                <div className="pv-row-main">
                  <Link href={`/${entry.slug}`} target="_blank" rel="noopener noreferrer" className="pv-row-name pv-row-name-link">
                    {entry.name || "(untitled)"}
                  </Link>
                  <span className="pv-row-host pv-row-host-internal">
                    {SITE}/{entry.slug}
                  </span>
                </div>
                <div className="pv-row-meta">
                  {entry.url ? (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer">
                      {shortHost(entry.url)} ↗
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {entries.length > showCount ? (
            <button type="button" className="pv-show-more" onClick={() => setShowCount((c) => c + 100)}>
              Show {Math.min(100, entries.length - showCount)} more
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function ArticlesPanel({ articles }: { articles: DashboardArticle[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <section className="pv-section pv-panel">
      <div className="pv-panel-head">
        <div>
          <div className="pv-panel-title">Articles</div>
          <div className="pv-panel-sub">
            {articles.length} published · click to edit
          </div>
        </div>
      </div>
      {articles.length === 0 ? (
        <div className="pv-empty">No articles yet.</div>
      ) : (
        <div className="pv-table pv-table-dense">
          {articles.map((a) => (
            <ArticleRow
              key={a.id}
              article={a}
              isExpanded={expanded === a.id}
              onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ArticleRow({
  article,
  isExpanded,
  onToggle,
}: {
  article: DashboardArticle;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`pv-row pv-row-dense pv-row-collapsible ${isExpanded ? "pv-row-expanded" : ""}`}>
      <button type="button" className="pv-row-header" onClick={onToggle} aria-expanded={isExpanded}>
        <div className="pv-row-main">
          <span className="pv-row-name">{article.title}</span>
          <span className="pv-row-host pv-row-host-internal">
            {SITE}/article/{article.slug}
          </span>
        </div>
        <div className="pv-row-meta">
          {article.heroImageUrl ? (
            <span className="pv-pill pv-pill-good" title={article.heroImageUrl}>
              hero set
            </span>
          ) : (
            <span className="pv-pill">auto hero</span>
          )}
          {article.publishedDate ? <span>{article.publishedDate.slice(0, 10)}</span> : null}
          <span className="pv-sep">·</span>
          <span>{article.readingTimeMinutes} min</span>
          <span className="pv-row-caret">{isExpanded ? "−" : "+"}</span>
        </div>
      </button>
      {isExpanded ? <ArticleEditor article={article} /> : null}
    </div>
  );
}

const TINT_OPTIONS = ["cyan", "purple", "pink", "gold"] as const;

function ArticleEditor({ article }: { article: DashboardArticle }) {
  const [title, setTitle] = useState(article.title);
  const [excerpt, setExcerpt] = useState(article.excerpt);
  const [coverTint, setCoverTint] = useState(article.coverTint || "cyan");
  const [heroUrl, setHeroUrl] = useState(article.heroImageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty =
    title !== article.title ||
    excerpt !== article.excerpt ||
    coverTint !== (article.coverTint || "cyan") ||
    (heroUrl || null) !== (article.heroImageUrl || null);

  async function handleUpload(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      // Direct-to-Blob upload. The browser talks to Vercel Blob, and
      // our server endpoint only hands out a short-lived token. This
      // sidesteps the 4.5 MB serverless body limit that would
      // otherwise reject larger hero images with "Request Entity Too
      // Large" (plain-text, unparseable as JSON).
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const pathname = `article-hero/${article.slug}/${Date.now()}.${ext}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/portal/upload-image",
        contentType: file.type || undefined,
      });
      setHeroUrl(blob.url);
      setMsg({ kind: "ok", text: "Uploaded. Click Save to apply." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const fields: Record<string, unknown> = {
        // Pass slug so the server can revalidate the exact page path.
        __slugForRevalidate: article.slug,
      };
      if (title !== article.title) fields.title = title;
      if (excerpt !== article.excerpt) fields.excerpt = excerpt;
      if (coverTint !== (article.coverTint || "cyan")) fields.coverTint = coverTint;
      if ((heroUrl || null) !== (article.heroImageUrl || null)) {
        fields.heroImageUrl = heroUrl.trim() || null;
      }
      const res = await fetch("/api/portal/update-article", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: article.id, fields }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error || "save failed");
      setMsg({
        kind: "ok",
        text: json.liveUpdated
          ? "Saved. Reload the live article to see your changes."
          : "Saved to Notion. Next deploy will rebuild the article page.",
      });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function clearHero() {
    setHeroUrl("");
    setMsg({ kind: "ok", text: "Hero cleared. Click Save to revert to auto-generated image." });
  }

  return (
    <div className="pv-article-editor">
      <div className="pv-form-grid">
        <label className="pv-field pv-field-wide">
          <span className="pv-field-label">Title</span>
          <input
            type="text"
            className="pv-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </label>

        <label className="pv-field pv-field-wide">
          <span className="pv-field-label">Excerpt</span>
          <textarea
            className="pv-input pv-textarea"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            disabled={saving}
            placeholder="Short summary for cards + meta description"
          />
        </label>

        <label className="pv-field">
          <span className="pv-field-label">Cover tint</span>
          <select
            className="pv-input pv-select"
            value={coverTint}
            onChange={(e) => setCoverTint(e.target.value)}
            disabled={saving}
          >
            {TINT_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="pv-hero-editor">
        <div className="pv-hero-label">Hero image</div>
        <div className="pv-hero-preview">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/article/${article.slug}/opengraph-image`} alt="auto-generated hero" />
          )}
          {!heroUrl ? <span className="pv-hero-overlay">AUTO-GENERATED</span> : null}
        </div>
        <div className="pv-hero-controls">
          <input
            type="url"
            className="pv-input"
            placeholder="Paste image URL (https://…)"
            value={heroUrl}
            onChange={(e) => setHeroUrl(e.target.value)}
            disabled={saving || uploading}
          />
          <label className={`pv-upload-btn ${uploading ? "pv-upload-btn-disabled" : ""}`}>
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              hidden
              disabled={saving || uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {heroUrl ? (
            <button type="button" className="pv-btn pv-btn-ghost" onClick={clearHero} disabled={saving}>
              Clear
            </button>
          ) : null}
        </div>
        <div className="pv-hint">
          Paste any image URL or upload (JPG/PNG/WebP/AVIF/GIF, max 8 MB). 1200×630 looks best.
          Uploads require BLOB_READ_WRITE_TOKEN on Vercel; URL paste works without it.
        </div>
      </div>

      <div className="pv-actions">
        <Link
          href={`/article/${article.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="pv-btn pv-btn-ghost"
        >
          View live ↗
        </Link>
        <button
          type="button"
          className="pv-btn pv-btn-primary"
          onClick={handleSave}
          disabled={!dirty || saving || uploading}
        >
          {saving ? "Saving…" : dirty ? "Save to Notion" : "No changes"}
        </button>
      </div>

      {msg ? (
        <div className={`pv-msg pv-msg-${msg.kind}`}>{msg.text}</div>
      ) : null}
    </div>
  );
}

function BarList({
  rows,
}: {
  rows: Array<{ rank: number; title: React.ReactNode; metaRight: string; fill: number }>;
}) {
  return (
    <div className="pv-barlist">
      {rows.map((r, i) => {
        const pct = Math.max(2, Math.min(100, r.fill * 100));
        return (
          <div className="pv-barlist-row" key={i}>
            <span className="pv-barlist-rank">{r.rank}</span>
            <div className="pv-barlist-body">
              <div className="pv-barlist-title-row">
                <div className="pv-barlist-title">{r.title}</div>
                <div className="pv-barlist-meta">{r.metaRight}</div>
              </div>
              <div className="pv-barlist-track">
                <div className="pv-barlist-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
