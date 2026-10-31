import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/portal", "/api/portal", "/api/submit", "/api/meta", "/api/shot-check"] }], sitemap: "https://aitreelibrary.com/sitemap.xml" };
}
