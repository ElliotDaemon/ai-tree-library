// Inline tool-card embed for use within article bodies. Rendered when an
// article references a Library entry — either via Notion's link_to_page
// block or via the ::tool[slug]:: convention in a paragraph.
//
// Richer than v1: shows rarity icon, pricing tag, and a visit-affordance
// arrow. The whole card is a Link to the dedicated /[slug] page so a
// reader can dive into the tool's full LongDescription before deciding
// whether to visit the external site.

import Link from "next/link";
import type { LibraryEntry } from "../../lib/library";

interface Props {
  slug: string;
  name: string;
  description: string;
  pricing?: string;
  rarity?: string;
  /** Optional — full entry for richer card chrome. */
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

export default function ToolCardInline({ slug, name, description, pricing, rarity, entry }: Props) {
  const icon = rarityIcon(rarity || entry?.rarity);
  const pricingLabel = pricing || entry?.pricing;
  return (
    <Link href={`/${slug}`} className="ar-toolcard">
      <div className="ar-toolcard-head">
        {icon ? <span className="ar-toolcard-rarity" aria-hidden>{icon}</span> : null}
        <span className="ar-toolcard-name">{name}</span>
        <span className="ar-toolcard-arrow">→</span>
      </div>
      {description ? <p className="ar-toolcard-desc">{description}</p> : null}
      <div className="ar-toolcard-meta">
        {pricingLabel && pricingLabel !== "Unknown" ? (
          <span className="ar-toolcard-pricing">{pricingLabel}</span>
        ) : null}
        <span className="ar-toolcard-visit">View on AI Tree Library →</span>
      </div>
    </Link>
  );
}
