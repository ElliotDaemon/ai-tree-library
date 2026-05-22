// JSON-LD structured data helpers — schema.org markup so Google + LLM crawlers
// understand each page's semantic content.

import type { LibraryEntry, LibraryCategory } from "../../lib/library";
import { hostnameOf, rarityMeta } from "../../lib/library";

const SITE = "https://aitreelibrary.com";

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Next.js needs dangerouslySetInnerHTML for script content
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ToolJsonLd({
  entry,
  category,
  topLevel,
}: {
  entry: LibraryEntry;
  category: LibraryCategory | null;
  topLevel: LibraryCategory | null;
}) {
  const rarity = rarityMeta(entry.rarity);
  const description = entry.longDescription || entry.description || `${entry.name} — curated in the AI Tree Library.`;
  const data = {
    "@context": "https://schema.org",
    "@type": entry.type === "Tool" ? "SoftwareApplication" : "WebPage",
    "@id": `${SITE}/${entry.slug}`,
    name: entry.name,
    url: entry.url,
    description: description.slice(0, 5000),
    applicationCategory: topLevel?.name ?? "AI Tools",
    keywords: entry.tags.join(", "),
    image: entry.logoUrl || `${SITE}/${entry.slug}/opengraph-image`,
    isPartOf: {
      "@type": "WebSite",
      name: "AI Tree Library",
      url: SITE,
    },
    ...(entry.pricing && entry.pricing !== "Unknown"
      ? {
          offers: {
            "@type": "Offer",
            description: entry.pricing,
          },
        }
      : {}),
    ...(category
      ? {
          about: {
            "@type": "Thing",
            name: category.name,
          },
        }
      : {}),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Rarity", value: rarity.label },
      { "@type": "PropertyValue", name: "Type", value: entry.type },
      ...(entry.featured ? [{ "@type": "PropertyValue", name: "Featured", value: "true" }] : []),
      ...(entry.gem ? [{ "@type": "PropertyValue", name: "Gem", value: "true" }] : []),
    ],
  };
  return <JsonLd data={data} />;
}

export function ToolBreadcrumb({
  entry,
  topLevel,
}: {
  entry: LibraryEntry;
  topLevel: LibraryCategory | null;
}) {
  const items: Array<{ "@type": string; position: number; name: string; item: string }> = [
    { "@type": "ListItem", position: 1, name: "AI Tree Library", item: SITE },
  ];
  if (topLevel) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: topLevel.name,
      item: `${SITE}/category/${topLevel.slug}`,
    });
    items.push({ "@type": "ListItem", position: 3, name: entry.name, item: `${SITE}/${entry.slug}` });
  } else {
    items.push({ "@type": "ListItem", position: 2, name: entry.name, item: `${SITE}/${entry.slug}` });
  }
  return <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items }} />;
}

export function CategoryJsonLd({
  category,
  entries,
}: {
  category: LibraryCategory;
  entries: LibraryEntry[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/category/${category.slug}`,
    name: category.name,
    description:
      category.description ||
      `Curated ${category.name.toLowerCase()} tools and resources in the AI Tree Library.`,
    url: `${SITE}/category/${category.slug}`,
    isPartOf: { "@type": "WebSite", name: "AI Tree Library", url: SITE },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.slice(0, 50).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE}/${e.slug}`,
        name: e.name,
      })),
    },
  };
  return <JsonLd data={data} />;
}

export function CategoryBreadcrumb({ category }: { category: LibraryCategory }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "AI Tree Library", item: SITE },
          { "@type": "ListItem", position: 2, name: category.name, item: `${SITE}/category/${category.slug}` },
        ],
      }}
    />
  );
}

export function WebsiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "AI Tree Library",
        url: SITE,
        description:
          "A 3D constellation of curated AI tools, design inspiration, and creative resources, navigable in real time.",
        publisher: {
          "@type": "Person",
          name: "Elliot Daemon",
          url: "https://elliotdaemon.com",
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

void hostnameOf;
