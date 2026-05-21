// Side panel shown when you click an entry node. Cyan-glass aesthetic
// matching the Neural Arbor design.

"use client";

interface Entry {
  id: string;
  name: string;
  url: string;
  type: string;
  description: string;
  pricing: string;
  featured: boolean;
  gem: boolean;
  logoUrl: string;
  source: string;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Props {
  entry: Entry;
  category: Category | null;
  onClose: () => void;
}

export default function DetailPanel({ entry, category, onClose }: Props) {
  const accent = category?.color ?? "rgba(0, 243, 255, 0.55)";

  return (
    <div
      className="ne-detail"
      style={{
        borderColor: accent,
        boxShadow: `0 8px 40px ${hexA(accent, 0.18)}, inset 0 0 16px ${hexA(accent, 0.04)}`,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="ne-detail-close"
        aria-label="Close"
      >
        ✕
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {entry.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.logoUrl}
            alt=""
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              flexShrink: 0,
            }}
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontSize: "1.05rem",
              fontWeight: 600,
              color: "#fff",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.name}
          </h2>
          {category ? (
            <div
              style={{
                fontSize: "0.72rem",
                marginTop: "0.25rem",
                color: accent,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {category.name}
            </div>
          ) : null}
        </div>
      </div>

      <p
        style={{
          fontSize: "0.85rem",
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.5,
          marginBottom: "1rem",
        }}
      >
        {entry.description}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {entry.featured ? (
          <span className="ne-pill ne-pill-featured">Featured</span>
        ) : null}
        {entry.gem ? (
          <span className="ne-pill ne-pill-gem">✨ Gem</span>
        ) : null}
        <span className="ne-pill">{entry.pricing}</span>
        {entry.tags.map((tag) => (
          <span key={tag} className="ne-pill">{tag}</span>
        ))}
      </div>

      {entry.source ? (
        <div
          style={{
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.4)",
            marginBottom: "0.75rem",
            letterSpacing: "0.05em",
          }}
        >
          Submitted by {entry.source}
        </div>
      ) : null}

      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          width: "100%",
          textAlign: "center",
          padding: "0.6rem 1rem",
          borderRadius: 4,
          fontSize: "0.85rem",
          fontWeight: 500,
          color: "#fff",
          border: `1px solid ${accent}`,
          background: "transparent",
          textDecoration: "none",
          letterSpacing: "0.05em",
          transition: "background-color 120ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = hexA(accent, 0.08))}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        Open {entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
      </a>
    </div>
  );
}

// Add hex alpha (0..1) to a #RRGGBB or rgba()/named color (best-effort).
function hexA(color: string, alpha: number): string {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const h = color.length === 4
      ? "#" + color.slice(1).split("").map((c) => c + c).join("")
      : color;
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color; // fallback (e.g. already rgba)
}
