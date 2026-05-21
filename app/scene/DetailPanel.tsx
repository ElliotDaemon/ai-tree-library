// Side panel shown when you click a node. Displays tool/website info + open link.

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
  return (
    <div
      className="glass-panel fixed top-1/2 right-6 -translate-y-1/2 z-20 w-80 p-5"
      style={{ borderColor: category?.color ?? "rgba(255,255,255,0.08)" }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 text-white/40 hover:text-white text-sm"
        aria-label="Close"
      >
        ✕
      </button>

      <div className="flex items-start gap-3 mb-3">
        {entry.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.logoUrl}
            alt=""
            className="w-10 h-10 rounded-md bg-white/5"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white truncate">{entry.name}</h2>
          {category ? (
            <div className="text-xs mt-0.5" style={{ color: category.color }}>
              {category.name}
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-white/70 leading-relaxed mb-4">{entry.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {entry.featured ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Featured
          </span>
        ) : null}
        {entry.gem ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            ✨ Gem
          </span>
        ) : null}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
          {entry.pricing}
        </span>
        {entry.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10"
          >
            {tag}
          </span>
        ))}
      </div>

      {entry.source ? (
        <div className="text-[10px] text-white/40 mb-3">Submitted by {entry.source}</div>
      ) : null}

      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center px-4 py-2 rounded-md text-sm font-medium text-white border border-white/15 hover:bg-white/5 transition-colors"
      >
        Open {entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
      </a>
    </div>
  );
}
