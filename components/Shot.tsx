"use client";
// A site preview that never shows someone else's loading screen.
// The free capture service (WordPress mShots) answers with a small "Generating preview" placeholder
// until its screenshot is ready; a real capture comes back at the width we asked for. So: load quietly
// in the background, show our own glass skeleton meanwhile, retry with backoff, and if it never arrives
// (many sites block capture) say so quietly over the site's icon.
import { useEffect, useState } from "react";
import { shotUrl } from "@/lib/shot";


const WAITS = [0, 2500, 3500, 5000, 7000, 9000, 12000]; // ~40 s in total

export default function Shot({ url, host, color = "#3987e5", width = 1200, height = 750, className = "" }: {
  url: string; host: string; color?: string; width?: number; height?: number; className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  // Parents give each URL its own <Shot key=…>, so a fresh mount always starts at "loading".
  useEffect(() => {
    let alive = true, attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryOnce = () => {
      if (!alive) return;
      const probe = new Image();
      const u = `${shotUrl(url, width, height)}${attempt ? `&r=${attempt}` : ""}`;
      probe.onload = () => {
        if (!alive) return;
        if (probe.naturalWidth >= width * 0.9) { setSrc(u); setState("ready"); } // the real capture
        else next(); // the placeholder: wait and ask again
      };
      probe.onerror = next;
      probe.src = u;
    };
    const next = () => {
      attempt++;
      if (attempt >= WAITS.length) { if (alive) setState("failed"); return; }
      timer = setTimeout(tryOnce, WAITS[attempt]);
    };
    tryOnce();
    // in parallel: if the site shows bot checks, a capture would be of the check page, so never show it
    const ctrl = new AbortController();
    fetch(`/api/shot-check?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.blocked) { alive = false; clearTimeout(timer); setSrc(null); setState("failed"); } })
      .catch(() => {});
    return () => { alive = false; clearTimeout(timer); ctrl.abort(); };
  }, [url, width, height]);


  return (
    <div className={`shot-body ${state} ${className}`} style={{ "--c": color } as React.CSSProperties} aria-busy={state === "loading"}>
      {state !== "ready" && (
        <div className="shot-wait">
          <span className="fav-xl" aria-hidden>
            {host.slice(0, 1).toUpperCase()}
            <i style={{ backgroundImage: `url(https://icons.duckduckgo.com/ip3/${host}.ico)` }} />
          </span>
          {state === "failed" ? (
            <span className="mono">Preview unavailable<small>This site doesn&apos;t allow previews</small></span>
          ) : (
            <span className="mono">Capturing preview</span>
          )}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" decoding="async" />}
    </div>
  );
}
