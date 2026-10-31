// Free "smart" enrichment: read a page's own metadata (title, description, OG, app-store hints)
// and run the local classifier. No model, no key, no bill.
import { classify, cleanUrl, detectKind, hostOf, suggestTags, tidyName } from "./taxonomy.mjs";
import type { Kind } from "./types";

export interface Meta {
  url: string;
  host: string;
  name: string;
  description: string;
  kind: Kind;
  branch: string;
  sub: string;
  confidence: number;
  tags: string[];
}

const pick = (html: string, re: RegExp) => {
  const m = html.match(re);
  return m ? decode(m[1]).replace(/\s+/g, " ").trim() : "";
};
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#x27;/g, "'");
const metaTag = (html: string, key: string) =>
  pick(html, new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i")) ||
  pick(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`, "i"));

/** Refuse private-network targets so the endpoint can't be used to probe internal hosts. */
function isPublicHost(host: string) {
  return !/^(localhost|0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\[|::1|.*\.local$|.*\.internal$)/i.test(host) && host.includes(".");
}

export async function readMeta(raw: string): Promise<Meta | null> {
  const url = cleanUrl(raw);
  const host = hostOf(url);
  if (!url || !isPublicHost(host)) return null;
  let html = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; AITreeLibrary/3.0; +https://aitreelibrary.com/about)", accept: "text/html" },
    });
    clearTimeout(t);
    if (res.ok && (res.headers.get("content-type") || "").includes("html")) {
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      while (reader && html.length < 200_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (html.includes("</head>")) break;
      }
      reader?.cancel().catch(() => {});
    }
  } catch {
    /* unreachable sites still get a URL-based guess */
  }
  const title = metaTag(html, "og:title") || pick(html, /<title[^>]*>([^<]*)<\/title>/i);
  const site = metaTag(html, "og:site_name");
  const description = (metaTag(html, "description") || metaTag(html, "og:description")).slice(0, 280);
  const name = tidyName(site && title && !title.toLowerCase().includes(site.toLowerCase()) ? site : title, url);
  const kind = detectKind(url, `${title} ${description}`) as Kind;
  const c = classify({ name, url, description });
  return { url, host, name, description, kind, branch: c.branch, sub: c.sub, confidence: c.confidence, tags: suggestTags({ name, description, url }) };
}
