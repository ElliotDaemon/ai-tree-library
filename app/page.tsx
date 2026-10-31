import Explorer from "@/components/Explorer";
import { Footer, Top } from "@/components/Chrome";
import { branchStats, loadLibrary, SITE, toRow } from "@/lib/library";

export default async function Home() {
  const [lib, stats] = await Promise.all([loadLibrary(), branchStats()]);
  // Small libraries ship whole in the HTML; large ones ship the first screen and fetch the index.
  const initial = (lib.length <= 400 ? lib : lib.slice(0, 48)).map(toRow);
  const branches = stats.map((b) => ({ id: b.id, name: b.name, color: b.color, count: b.count, subs: b.subs }));
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "AI Tree Library",
            url: SITE,
            potentialAction: { "@type": "SearchAction", target: `${SITE}/?q={query}`, "query-input": "required name=query" },
          }),
        }}
      />
      <Top count={lib.length} />
      <Explorer branches={branches} initial={initial} total={lib.length} />
      <Footer />
    </>
  );
}
