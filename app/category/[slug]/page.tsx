import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/Card";
import { Footer, Top } from "@/components/Chrome";
import { loadLibrary, toRow } from "@/lib/library";
import { BRANCHES, branchColor, findBranch } from "@/lib/taxonomy.mjs";

export const dynamicParams = false;
export const generateStaticParams = () => BRANCHES.map((b) => ({ slug: b.id }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = findBranch((await params).slug);
  return b ? { title: b.name, description: `${b.name}: ${b.blurb} Curated by the 11:11 team, open to everyone.`, alternates: { canonical: `/category/${b.id}` } } : {};
}

export default async function BranchPage({ params }: Props) {
  const b = findBranch((await params).slug);
  if (!b) notFound();
  const color = branchColor(b.id);
  const items = (await loadLibrary()).filter((e) => e.branch === b.id);
  const groups = b.subs.map((s) => ({ ...s, items: items.filter((e) => e.sub === s.id) })).filter((g) => g.items.length);
  return (
    <>
      <Top />
      <main className="wrap page">
        <nav className="crumbs"><Link href="/">Library</Link><span>/</span><span>{b.name}</span></nav>
        <div className="prose" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="swatch" style={{ "--c": color } as React.CSSProperties} /> Branch · {items.length} links
          </div>
          <h1>{b.name}</h1>
          <p>{b.blurb}</p>
        </div>
        <div className="rail" style={{ margin: "8px -20px 10px" }}>
          {groups.map((g) => <a key={g.id} href={`#${g.id}`} className="pill sm">{g.name} <span className="n">{g.items.length}</span></a>)}
        </div>
        {groups.length === 0 && (
          <div className="empty glass" style={{ marginTop: 24 }}>
            <h2>Nothing here yet</h2>
            <p>This branch is waiting for its first link.</p>
            <p style={{ marginTop: 18 }}><Link className="pill accent" href="/submit">Submit one</Link></p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.id} id={g.id} className="section" style={{ paddingBottom: 0, scrollMarginTop: 80 }}>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>{g.name} <span className="muted mono" style={{ fontSize: 13 }}>{g.items.length}</span></h2>
            <div className="grid">{g.items.map((e) => <Card key={e.id} row={toRow(e)} color={color} subName={g.name} />)}</div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
