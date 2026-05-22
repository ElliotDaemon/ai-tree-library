// /portal — admin dashboard. Gated by middleware.ts via ADMIN_TOKEN.
// Server component, cached 5 min. Refresh button reloads.

import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardData } from "../../lib/portal-data";

export const metadata: Metadata = {
  title: "Portal — AI Tree Library",
  description: "Admin dashboard for AI Tree Library.",
  robots: { index: false, follow: false },
};

export const revalidate = 300; // 5 min cache

function fmtNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1) + "k";
  if (n < 1_000_000) return (n / 1000).toFixed(0) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function shortHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export default async function PortalPage() {
  const d = await getDashboardData();

  return (
    <main className="po-page">
      <header className="po-header">
        <div className="po-brand">
          <span className="po-brand-dot" />
          <span className="po-brand-name">AI TREE LIBRARY · PORTAL</span>
        </div>
        <div className="po-header-right">
          <span className="po-updated">Updated {ageLabel((Date.now() - new Date(d.generatedAt).getTime()) / 3_600_000)}</span>
          <Link href="/" className="po-link-home">← Site</Link>
        </div>
      </header>

      {/* Top stats */}
      <section className="po-stat-grid">
        <StatCard label="Ready" big value={fmtNum(d.statusCounts.ready)} />
        <StatCard label="Pending review" big value={fmtNum(d.statusCounts.submitted + d.statusCounts.needsReview)} accent={d.statusCounts.submitted + d.statusCounts.needsReview > 0 ? "warn" : undefined} />
        <StatCard label="Hidden" value={fmtNum(d.statusCounts.hidden)} />
        <StatCard label="Total library" value={fmtNum(d.statusCounts.total)} />
        {d.visitors ? (
          <>
            <StatCard label="Today" value={fmtNum(d.visitors.day)} sub="visitors" />
            <StatCard label="7 days" value={fmtNum(d.visitors.week)} sub="visitors" />
            <StatCard label="28 days" big value={fmtNum(d.visitors.month)} sub="visitors" />
          </>
        ) : (
          <StatCard label="Visitors" value="—" sub={<a className="po-stat-link" href={d.vercelDashboardUrl} target="_blank" rel="noopener noreferrer">live on Vercel ↗</a>} />
        )}
      </section>

      {/* Top tools (by tool_view + link_click) */}
      {d.topToolEvents && d.topToolEvents.length > 0 ? (
        <section className="po-card">
          <h2 className="po-h2">🔥 Top tools (28d)</h2>
          <div className="po-bar-list">
            {d.topToolEvents.map((t, i) => (
              <BarRow
                key={t.slug}
                rank={i + 1}
                title={<Link href={`/${t.slug}`}>{t.name}</Link>}
                meta={`${t.views} views · ${t.clicks} clicks · ${Math.round(t.ctr * 100)}% CTR`}
                fill={t.views / (d.topToolEvents![0]?.views || 1)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Top categories */}
      {d.topCategoryEvents && d.topCategoryEvents.length > 0 ? (
        <section className="po-card">
          <h2 className="po-h2">📚 Top categories (28d)</h2>
          <div className="po-bar-list">
            {d.topCategoryEvents.map((c, i) => (
              <BarRow
                key={c.slug}
                rank={i + 1}
                title={<Link href={`/category/${c.slug}`}>{c.name}</Link>}
                meta={`${c.views} views`}
                fill={c.views / (d.topCategoryEvents![0]?.views || 1)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Top routes — when Vercel API returns pages */}
      {d.topRoutes && d.topRoutes.length > 0 ? (
        <section className="po-card">
          <h2 className="po-h2">📄 Top pages (28d)</h2>
          <div className="po-bar-list">
            {d.topRoutes.map((r, i) => (
              <BarRow
                key={r.route}
                rank={i + 1}
                title={<a href={r.route}>{r.route}</a>}
                meta={`${r.views} views`}
                fill={r.views / (d.topRoutes![0]?.views || 1)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Search */}
      {d.topSearches && d.topSearches.length > 0 ? (
        <section className="po-card">
          <h2 className="po-h2">🔍 Recent searches</h2>
          <div className="po-tags">
            {d.topSearches.map((q) => (
              <span key={q} className="po-search-tag">{q}</span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Pending submissions */}
      <section className="po-card">
        <h2 className="po-h2">
          📨 Pending submissions ({d.pendingSubmissions.length})
          <a className="po-h2-link" href="https://www.notion.so/" target="_blank" rel="noopener noreferrer">review in Notion ↗</a>
        </h2>
        {d.pendingSubmissions.length === 0 ? (
          <p className="po-empty">No pending submissions.</p>
        ) : (
          <ul className="po-list">
            {d.pendingSubmissions.map((s) => (
              <li key={s.id} className="po-row">
                <div className="po-row-main">
                  <span className="po-row-name">{s.name}</span>
                  <a className="po-row-host" href={s.url} target="_blank" rel="noopener noreferrer">{shortHost(s.url)} ↗</a>
                </div>
                <div className="po-row-meta">
                  <span>{ageLabel(s.ageHours)}</span>
                  <span className="po-sep">·</span>
                  <span>{s.source}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent additions */}
      <section className="po-card">
        <h2 className="po-h2">✨ Most recent ready</h2>
        {d.recentReady.length === 0 ? (
          <p className="po-empty">No recent entries.</p>
        ) : (
          <ul className="po-list">
            {d.recentReady.map((r) => (
              <li key={r.id} className="po-row">
                <div className="po-row-main">
                  <span className="po-row-name">{r.name}</span>
                  {r.rarity ? <span className="po-row-rarity">{r.rarity}</span> : null}
                </div>
                <div className="po-row-meta">
                  <span>{ageLabel(r.ageHours)}</span>
                  <span className="po-sep">·</span>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">{shortHost(r.url)} ↗</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Health */}
      <section className="po-card po-card-thin">
        <h2 className="po-h2">⚙ System</h2>
        <div className="po-health">
          <span>Notion API: <strong className={d.notionOk ? "po-ok" : "po-bad"}>{d.notionOk ? "OK" : "DOWN"}</strong></span>
          <span>Vercel Analytics API: <strong className={d.vercelOk ? "po-ok" : "po-warn"}>{d.vercelOk ? "OK" : "see env vars below"}</strong></span>
        </div>
        {!d.vercelOk ? (
          <p className="po-env-note">
            Live analytics here require <code>VERCEL_TOKEN</code>, <code>VERCEL_PROJECT_ID</code>, and (if team-scoped) <code>VERCEL_TEAM_ID</code> in Vercel env vars. Until then:{" "}
            <a href={d.vercelDashboardUrl} target="_blank" rel="noopener noreferrer">view live analytics on Vercel ↗</a>
          </p>
        ) : null}
        {d.errors.length > 0 ? (
          <ul className="po-errors">
            {d.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  big,
  sub,
  accent,
}: {
  label: string;
  value: string;
  big?: boolean;
  sub?: React.ReactNode;
  accent?: "warn";
}) {
  return (
    <div className={`po-stat ${big ? "po-stat-big" : ""} ${accent ? `po-stat-${accent}` : ""}`}>
      <div className="po-stat-value">{value}</div>
      <div className="po-stat-label">{label}</div>
      {sub ? <div className="po-stat-sub">{sub}</div> : null}
    </div>
  );
}

function BarRow({ rank, title, meta, fill }: { rank: number; title: React.ReactNode; meta: string; fill: number }) {
  const pct = Math.max(2, Math.min(100, fill * 100));
  return (
    <div className="po-bar-row">
      <span className="po-bar-rank">{rank}.</span>
      <div className="po-bar-body">
        <div className="po-bar-title">{title}</div>
        <div className="po-bar-track">
          <div className="po-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="po-bar-meta">{meta}</div>
      </div>
    </div>
  );
}
