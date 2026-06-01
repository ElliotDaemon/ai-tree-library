// Inline tool-card embed for use within article bodies. Rendered when an
// article references a Library entry — either via Notion's link_to_page
// block or via the ::tool[slug]:: convention in a paragraph.
//
// Sits as a block element interrupting the prose flow. Card carries the
// tool's name, short description, rarity icon, and a deep link into the
// dedicated tool page so the reader can dive into more detail without
// losing place in the article.

import Link from "next/link";
import type { LibraryEntry } from "../../lib/library";

interface Props {
  slug: string;
  name: string;
  description: string;
  /** Optional — full entry for rarity icon. If absent, the card still works
   *  with just slug+name+description. */
  entry?: LibraryEntry | null;
}

const RARITY_ICON: Record<string, string> = {
  legendary: "👑",
  established: "⭐",
  rare: "💎",
  gem: "🌟",
};

function rarityIcon(rarity?: string): string {
  if (!rarity) return "";
  const r = rarity.toLowerCase();
  if (r.includes("legendary")) return RARITY_ICON.legendary;
  if (r.includes("gem")) return RARITY_ICON.gem;
  if (r.includes("rare")) return RARITY_ICON.rare;
  return RARITY_ICON.established;
}

export default function ToolCardInline({ slug, name, description, entry }: Props) {
  const icon = rarityIcon(entry?.rarity);
  return (
    <Link href={`/${slug}`} className="ar-toolcard">
      <div className="ar-toolcard-head">
        {icon ? <span className="ar-toolcard-rarity" aria-hidden>{icon}</span> : null}
        <span className="ar-toolcard-name">{name}</span>
        <span className="ar-toolcard-arrow">→</span>
      </div>
      {description ? <p className="ar-toolcard-desc">{description}</p> : null}
    </Link>
  );
}
