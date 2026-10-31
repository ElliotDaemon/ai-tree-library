import type { Metadata } from "next";
import Link from "next/link";
import { Footer, REPO, Top } from "@/components/Chrome";

export const metadata: Metadata = { title: "How it works", description: "AI Tree Library is an open-source, community-built library of useful links. How it is built, reviewed and shared.", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <>
      <Top />
      <main className="wrap page">
        <article className="prose">
          <div className="eyebrow">About</div>
          <h1>Grown in the open. Shared with everyone.</h1>
          <p>AI Tree Library collects the parts of the internet worth knowing: websites, AI tools, iOS and Android apps, widgets and browser extensions. Anyone can plant a link, anyone can take the whole tree: the code is open source and every entry is free data. A curator keeps it clean, so what grows here stays worth sharing.</p>
          <h2>How it works</h2>
          <p>The whole library is three JSON files in a public <a href={REPO} target="_blank" rel="noreferrer">GitHub repository</a>. The site is built from them and served as static pages, so it costs nothing to run and nothing can take it down. There is no paid API and no AI bill: new links are described from their own page metadata and sorted into branches by a small open classifier.</p>
          <h2>Contribute</h2>
          <p><Link href="/submit">Submit a link</Link> from the site, or open a pull request that adds a line to <code>data/queue.json</code>. Either way it lands in the review queue.</p>
          <h2>Use the data</h2>
          <p>Everything is open under CC0. Fetch <a href="/api/library.json">/api/library.json</a> for the full dataset or <a href="/api/index.json">/api/index.json</a> for a compact index. AI agents can read <a href="/llms.txt">/llms.txt</a>.</p>
          <h2>The tree</h2>
          <p>The field on the home page draws every link as a point. Branches are packed outward on a golden-angle spiral and links grow inside them as a sunflower does, so the picture stays balanced however large the library gets.</p>
          <p style={{ marginTop: 40 }} className="muted">An 11:11 project.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
