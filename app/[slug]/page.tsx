import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Card, { Favicon, KIND_LABEL } from "@/components/Card";
import { Footer, Top } from "@/components/Chrome";
import { ArrowIcon } from "@/components/Icons";
import { findEntry, loadLibrary, related, SITE, toRow } from "@/lib/library";
import { branchColor, findBranch, findSub, hostOf } from "@/lib/taxonomy.mjs";

export const dynamicParams = false;
export async function generateStaticParams() {
  const lib = await loadLibrary();
  // An empty library still needs one param for a static build; it 404s.
  return lib.length ? lib.map((e) => ({ slug: e.id })) : [{ slug: "_empty" }];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await findEntry((await params).slug);
  if (!e) return {};
  const sub = findSub(e.branch, e.sub);
  const description = e.description || `${e.name} (${hostOf(e.url)}), in ${sub?.name ?? "the library"}.`;
  return { title: `${e.name} · ${sub?.name ?? ""}`.replace(/ · $/, ""), description, alternates: { canonical: `/${e.id}` }, openGraph: { title: e.name, description } };
}

export default async function EntryPage({ params }: Props) {
  const e = await findEntry((await params).slug);
  if (!e) notFound();
  const branch = findBranch(e.branch);
  const sub = findSub(e.branch, e.sub);
  const color = branchColor(e.branch);
  const host = hostOf(e.url);
  const rel = await related(e);
  const visit = `${e.url}${e.url.includes("?") ? "&" : "?"}ref=aitreelibrary`;
  return (
    <>
      <Top />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": ["ios", "android", "extension", "desktop", "tool"].includes(e.kind) ? "SoftwareApplication" : "WebSite",
            name: e.name, url: e.url, description: e.description, applicationCategory: sub?.name,
            mainEntityOfPage: `${SITE}/${e.id}`,
          }),
        }}
      />
      <main className="wrap page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Library</Link><span>/</span>
          {branch && <><Link href={`/category/${branch.id}`}>{branch.name}</Link><span>/</span></>}
          <span>{sub?.name}</span>
        </nav>
        <div className="hero-entry">
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Favicon host={host} name={e.name} />
              <span className="mono muted" style={{ fontSize: 13 }}>{host}</span>
            </div>
            <h1>{e.name}</h1>
            {e.description && <p className="desc">{e.description}</p>}
            <div className="actions">
              <a className="pill accent lg" href={visit} target="_blank" rel="noopener">Open {KIND_LABEL[e.kind]?.toLowerCase() === "website" ? "site" : KIND_LABEL[e.kind]} <ArrowIcon size={16} /></a>
              <Link className="pill lg" href={`/category/${e.branch}`}><span className="swatch" style={{ "--c": color } as React.CSSProperties} /> {branch?.name}</Link>
            </div>
            <dl className="facts">
              <div><dt>Kind</dt><dd>{KIND_LABEL[e.kind] || e.kind}</dd></div>
              <div><dt>Branch</dt><dd>{sub?.name}</dd></div>
              <div><dt>Pricing</dt><dd>{e.pricing || "—"}</dd></div>
              <div><dt>Added</dt><dd>{new Date(e.added).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
              {e.tags.length > 0 && <div style={{ gridColumn: "1 / -1" }}><dt>Tags</dt><dd className="chips">{e.tags.map((t) => <span key={t} className="tag">{t}</span>)}</dd></div>}
              {e.submitter && <div style={{ gridColumn: "1 / -1" }}><dt>Found by</dt><dd>@{e.submitter}</dd></div>}
            </dl>
          </div>
          <a className="shot" href={visit} target="_blank" rel="noopener" aria-label={`Preview of ${e.name}`}>
            <div className="chrome"><i /><i /><i /><span>{host}</span></div>
            {/* Free screenshot service; the frame stays elegant if it is slow. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://s0.wp.com/mshots/v1/${encodeURIComponent(e.url)}?w=1200&h=750`} alt="" loading="lazy" />
          </a>
        </div>
        {rel.length > 0 && (
          <section className="section">
            <div className="eyebrow">Nearby in the tree</div>
            <h2 style={{ marginBottom: 18 }}>Related</h2>
            <div className="grid">
              {rel.map((r) => <Card key={r.id} row={toRow(r)} color={branchColor(r.branch)} subName={findSub(r.branch, r.sub)?.name || ""} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
