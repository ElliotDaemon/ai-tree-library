import type { NextConfig } from "next";

// Security headers applied site-wide.
//   - HSTS: enforce HTTPS for 2 years incl. subdomains, eligible for preload list
//   - X-Content-Type-Options: prevent MIME sniffing
//   - X-Frame-Options: deny iframing (clickjacking defense). Public OG image
//     embedding still works because that's done via <img>, not <iframe>.
//   - Referrer-Policy: keep full referrer on same-origin nav (helps our own
//     analytics), strip down on cross-origin navigations to just origin
//   - Permissions-Policy: explicitly turn off device-access features we don't
//     use. Geolocation/microphone/camera/payment all disabled.
//   - X-DNS-Prefetch-Control: opt-in DNS prefetch for faster external links
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Belt-and-suspenders noindex for the admin area — robots.ts also
// disallows these paths, but this header reaches crawlers that
// ignore robots.txt.
const portalHeaders = [
  ...securityHeaders,
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/portal/:path*", headers: portalHeaders },
      { source: "/api/portal/:path*", headers: portalHeaders },
    ];
  },
};

export default nextConfig;
