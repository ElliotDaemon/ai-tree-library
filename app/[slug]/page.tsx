// Per-tool page: aitreelibrary.com/[slug]
// Catches every root-level slug. Reserved slugs (privacy, terms, etc.) fall
// through to notFound() so the real routes win.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findEntryBySlug,
  findCategoryById,
  topLevelOf,
  relatedEntries,
  getAllEntrySlugs,
  hostnameOf,
} from "../../lib/library";
import { isReserved } from "../../lib/slug";
import ToolPageBody from "../components/ToolPageBody";
import { ToolJsonLd, ToolBreadcrumb } from "../components/JsonLd";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllEntrySlugs();
  return slugs.map((slug) => ({ slug }));
}

// Allow on-demand rendering for newly-added tools between deploys
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isReserved(slug)) return {};
  const entry = await findEntryBySlug(slug);
  if (!entry) return { title: "Not found — AI Tree Library" };

  const description = (entry.longDescription || entry.description || `${entry.name} — curated in the AI Tree Library.`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return {
    title: `${entry.name} — AI Tree Library`,
    description,
    alternates: { canonical: `/${entry.slug}` },
    openGraph: {
      title: entry.name,
      description,
      url: `/${entry.slug}`,
      siteName: "AI Tree Library",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${entry.name} — AI Tree Library`,
      description,
    },
  };
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  if (isReserved(slug)) notFound();

  const entry = await findEntryBySlug(slug);
  if (!entry) notFound();

  const category = entry.categoryId ? await findCategoryById(entry.categoryId) : null;
  const topLevel = category ? await topLevelOf(category) : null;
  const related = await relatedEntries(entry, 8);

  return (
    <>
      <ToolJsonLd entry={entry} category={category} topLevel={topLevel} />
      <ToolBreadcrumb entry={entry} topLevel={topLevel} />
      <ToolPageBody entry={entry} category={category} topLevel={topLevel} related={related} />
    </>
  );
}

// Keep a void reference so the import isn't tree-shaken away by linters
void hostnameOf;
