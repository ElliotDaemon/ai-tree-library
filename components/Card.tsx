import Link from "next/link";
import type { Row } from "@/lib/types";

export const KIND_LABEL: Record<string, string> = {
  website: "Website", tool: "Tool", ios: "iOS", android: "Android", extension: "Extension",
  widget: "Widget", desktop: "Desktop", resource: "Resource", inspiration: "Inspiration",
};

export function Favicon({ host, name }: { host: string; name: string }) {
  return (
    // The letter sits underneath; the icon paints over it when it loads, and nothing breaks when it doesn't.
    <span className="fav" aria-hidden>
      {name.slice(0, 1).toUpperCase()}
      {host && <i style={{ backgroundImage: `url(https://icons.duckduckgo.com/ip3/${host}.ico)` }} />}
    </span>
  );
}

export default function Card({ row, color, subName }: { row: Row; color: string; subName: string }) {
  return (
    <Link href={`/${row.i}`} className="card" style={{ "--c": color } as React.CSSProperties}>
      <div className="head">
        <Favicon host={row.h} name={row.n} />
        <div style={{ minWidth: 0 }}>
          <h3>{row.n}</h3>
          <div className="host">{row.h}</div>
        </div>
      </div>
      <p>{row.d || " "}</p>
      <div className="foot">
        <span className="swatch" style={{ "--c": color } as React.CSSProperties} />
        <span className="sub">{subName}</span>
        {row.g ? <span className="tag gem">Gem</span> : null}
        <span className="tag">{KIND_LABEL[row.k] || row.k}</span>
      </div>
    </Link>
  );
}
