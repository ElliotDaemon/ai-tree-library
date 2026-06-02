// Home — full-bleed 3D scene with floating UI overlays.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import ClientShell from "./ClientShell";

interface LibraryFile {
  generatedAt: string;
  stats: {
    categories: number;
    topLevel: number;
    entries: number;
    featured: number;
    gems: number;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    parentName: string;
    isTopLevel: boolean;
    displayOrder: number;
    v1ToolCount: number;
  }>;
  entries: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    description: string;
    categoryId: string | null;
    tags: string[];
    pricing: string;
    featured: boolean;
    gem: boolean;
    logoUrl: string;
    screenshotUrl: string;
    source: string;
  }>;
  layout: {
    nodes: Array<{
      id: string;
      kind: "category" | "subcategory" | "entry" | "filler";
      name?: string;
      color: [number, number, number];
      rawColor?: string | null;
      featured?: boolean;
      gem?: boolean;
      parentId?: string | null;
      position: [number, number, number];
      size: number;
    }>;
    links: Array<{ source: string; target: string; kind: string }>;
  };
}

async function loadLibrary(): Promise<LibraryFile | null> {
  try {
    const raw = await fs.readFile(join(process.cwd(), "public", "library.json"), "utf8");
    return JSON.parse(raw) as LibraryFile;
  } catch {
    return null;
  }
}

const SITE = "https://aitreelibrary.com";

export default async function Home() {
  const library = await loadLibrary();
  return (
    <>
      {/* Homepage JSON-LD: WebSite identity (so Google can show a
          site-search box in results), Organization (publisher entity
          referenced by every article/tool page), Person (the curator)
          — all linked via @id so the knowledge graph stitches
          together cleanly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${SITE}/#website`,
                url: SITE,
                name: "AI Tree Library",
                alternateName: "AI Tree Library — 3D AI tools constellation",
                description:
                  "A hand-curated 3D constellation of AI tools, design inspiration, and creative resources.",
                inLanguage: "en",
                publisher: { "@id": `${SITE}/#organization` },
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${SITE}/library?q={search_term_string}`,
                  },
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "Organization",
                "@id": `${SITE}/#organization`,
                name: "AI Tree Library",
                url: SITE,
                logo: {
                  "@type": "ImageObject",
                  url: `${SITE}/apple-touch-icon.png`,
                  width: 180,
                  height: 180,
                },
                sameAs: ["https://elliotdaemon.com", "https://x.com/elliotdaemon"],
                founder: { "@id": "https://elliotdaemon.com/#person" },
              },
              {
                "@type": "Person",
                "@id": "https://elliotdaemon.com/#person",
                name: "Elliot Daemon",
                url: "https://elliotdaemon.com",
                sameAs: ["https://elliotdaemon.com", "https://x.com/elliotdaemon"],
                jobTitle: "Curator",
                worksFor: { "@id": `${SITE}/#organization` },
              },
              {
                "@type": "CollectionPage",
                "@id": `${SITE}/#collection`,
                url: SITE,
                name: "AI Tree Library",
                description: `Browse ${library?.stats?.entries ?? 500}+ curated AI tools, design resources, and creative tech, organized into a navigable 3D constellation.`,
                isPartOf: { "@id": `${SITE}/#website` },
                primaryImageOfPage: {
                  "@type": "ImageObject",
                  url: `${SITE}/opengraph-image`,
                },
              },
            ],
          }),
        }}
      />
      <main className="ne-scene">
        <ClientShell library={library} />
      </main>
    </>
  );
}
