// Per-category page: aitreelibrary.com/category/[slug]

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findCategoryBySlug,
  entriesInTopLevelCategory,
  subcategoriesOf,
  getAllCategorySlugs,
} from "../../../lib/library";
import CategoryPageBody from "../../components/CategoryPageBody";
import { CategoryJsonLd, CategoryBreadcrumb } from "../../components/JsonLd";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) return { title: "Not found — AI Tree Library" };

  const entries = await entriesInTopLevelCategory(slug);
  const description =
    (category.description ||
      `Curated ${category.name.toLowerCase()} tools and resources in the AI Tree Library — ${entries.length} hand-picked entries.`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);

  return {
    title: `${category.name} — AI Tree Library`,
    description,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} — curated tools`,
      description,
      url: `/category/${category.slug}`,
      siteName: "AI Tree Library",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: `${category.name} — AI Tree Library`, description },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();

  const [subcategories, entries] = await Promise.all([
    subcategoriesOf(slug),
    entriesInTopLevelCategory(slug),
  ]);

  return (
    <>
      <CategoryJsonLd category={category} entries={entries} />
      <CategoryBreadcrumb category={category} />
      <CategoryPageBody category={category} subcategories={subcategories} entries={entries} />
    </>
  );
}
