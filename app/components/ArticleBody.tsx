// Renders an article's serialized block tree to JSX. Walks the array
// from scripts/fetch-articles.mjs and emits semantic HTML — <p>, <h2>,
// <ul>, etc. — styled by the .ar-* classes in globals.css.
//
// Tool blocks render as ToolCardInline embeds, which deep-link into the
// referenced Library entry's dedicated page.

import type { ArticleBlock } from "../../lib/articles";
import type { LibraryEntry } from "../../lib/library";
import ToolCardInline from "./ToolCardInline";

interface Props {
  blocks: ArticleBlock[];
  /** Optional map for hydrating tool-card rarity icons. */
  entryBySlug?: Map<string, LibraryEntry>;
}

export default function ArticleBody({ blocks, entryBySlug }: Props) {
  return (
    <div className="ar-body">
      {blocks.map((b, i) => renderBlock(b, i, entryBySlug))}
    </div>
  );
}

function renderBlock(b: ArticleBlock, i: number, entryBySlug?: Map<string, LibraryEntry>): React.ReactNode {
  switch (b.type) {
    case "p":
      return <p key={i}>{b.text}</p>;
    case "h": {
      // h1 is reserved for article title — promote any body h1 to h2 to
      // keep the document outline correct.
      const level = b.level === 1 ? 2 : b.level;
      const Tag = (level === 2 ? "h2" : "h3") as "h2" | "h3";
      return <Tag key={i}>{b.text}</Tag>;
    }
    case "ul":
      return (
        <ul key={i}>
          {b.items.map((it, j) => <li key={j}>{it}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol key={i}>
          {b.items.map((it, j) => <li key={j}>{it}</li>)}
        </ol>
      );
    case "quote":
      return <blockquote key={i}>{b.text}</blockquote>;
    case "hr":
      return <hr key={i} />;
    case "tool":
      return (
        <ToolCardInline
          key={i}
          slug={b.slug}
          name={b.name}
          description={b.description}
          entry={entryBySlug?.get(b.slug) ?? null}
        />
      );
    default:
      return null;
  }
}
