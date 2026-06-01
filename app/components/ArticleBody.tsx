// Renders an article's serialized block tree to JSX. Walks the array
// from scripts/fetch-articles.mjs and emits semantic HTML — <p>, <h2>,
// <ul>, <table>, <aside>, <figure>, etc. — styled by the .ar-* classes
// in globals.css.
//
// Each block type has a dedicated render branch. Rich text segments
// preserve bold / italic / code / link annotations from Notion.

import type { ArticleBlock, RichSegment } from "../../lib/articles";
import type { LibraryEntry } from "../../lib/library";
import ToolCardInline from "./ToolCardInline";

interface Props {
  blocks: ArticleBlock[];
  entryBySlug?: Map<string, LibraryEntry>;
}

export default function ArticleBody({ blocks, entryBySlug }: Props) {
  return (
    <div className="ar-body">
      {blocks.map((b, i) => renderBlock(b, i, entryBySlug))}
    </div>
  );
}

// ---------- Rich text segment renderer ----------

function renderSegments(segments: RichSegment[] | undefined): React.ReactNode {
  if (!segments || segments.length === 0) return null;
  return segments.map((s, i) => {
    let node: React.ReactNode = s.text;
    if (s.code) node = <code key={`c-${i}`}>{node}</code>;
    if (s.italic) node = <em key={`i-${i}`}>{node}</em>;
    if (s.bold) node = <strong key={`b-${i}`}>{node}</strong>;
    if (s.link) {
      const isExternal = /^https?:\/\//.test(s.link);
      node = (
        <a
          key={`l-${i}`}
          href={s.link}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {node}
        </a>
      );
    }
    return <span key={i}>{node}</span>;
  });
}

// Back-compat: if old data has `text: string` instead of segments
function textOrSegments(b: { text?: string; segments?: RichSegment[] }): React.ReactNode {
  if (b.segments && b.segments.length > 0) return renderSegments(b.segments);
  if (b.text) return b.text;
  return null;
}

// ---------- Block renderer ----------

function renderBlock(b: ArticleBlock, i: number, entryBySlug?: Map<string, LibraryEntry>): React.ReactNode {
  switch (b.type) {
    case "p":
      return <p key={i}>{textOrSegments(b as never)}</p>;

    case "h": {
      // h1 is reserved for the article title — promote any body h1 to h2.
      const level = b.level === 1 ? 2 : b.level;
      const Tag = (level === 2 ? "h2" : "h3") as "h2" | "h3";
      return <Tag key={i}>{textOrSegments(b as never)}</Tag>;
    }

    case "ul":
      return (
        <ul key={i}>
          {b.items.map((segs, j) => (
            <li key={j}>{renderSegments(segs)}</li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol key={i}>
          {b.items.map((segs, j) => (
            <li key={j}>{renderSegments(segs)}</li>
          ))}
        </ol>
      );

    case "quote":
      return <blockquote key={i}>{textOrSegments(b as never)}</blockquote>;

    case "callout":
      return (
        <aside key={i} className="ar-callout" data-emoji={b.emoji}>
          <span className="ar-callout-icon" aria-hidden>{b.emoji}</span>
          <div className="ar-callout-body">{renderSegments(b.segments)}</div>
        </aside>
      );

    case "code":
      return (
        <pre key={i} className={`ar-code ar-code-${b.language || "plain"}`}>
          <code>{b.text}</code>
        </pre>
      );

    case "img":
      return (
        <figure key={i} className="ar-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.alt || ""} loading="lazy" />
          {b.caption && b.caption.length > 0 ? (
            <figcaption>{renderSegments(b.caption)}</figcaption>
          ) : null}
        </figure>
      );

    case "table":
      return (
        <div key={i} className="ar-table-wrap">
          <table className="ar-table">
            {b.headers ? (
              <thead>
                <tr>
                  {b.headers.map((cell, j) => (
                    <th key={j}>{renderSegments(cell)}</th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderSegments(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "hr":
      return <hr key={i} />;

    case "tool":
      return (
        <ToolCardInline
          key={i}
          slug={b.slug}
          name={b.name}
          description={b.description}
          pricing={b.pricing}
          rarity={b.rarity}
          entry={entryBySlug?.get(b.slug) ?? null}
        />
      );

    default:
      return null;
  }
}
