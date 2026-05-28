// Apple touch icon — 180×180 PNG used when a visitor adds the site to
// their iOS / iPadOS home screen, and by macOS Safari's pinned-tab
// favicon. Same tree mark as the browser favicon, rendered at the larger
// canvas with slightly more breathing room around the silhouette so iOS's
// auto-rounded-corner mask doesn't clip the canopy circle.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#030508",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width="140"
          height="140"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* branches */}
          <line x1="16" y1="29" x2="16" y2="14" stroke="#00f3ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
          <line x1="16" y1="20" x2="9" y2="13" stroke="#00f3ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.58" />
          <line x1="16" y1="20" x2="23" y2="13" stroke="#00f3ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.58" />
          <line x1="16" y1="14" x2="11" y2="8" stroke="#00f3ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.48" />
          <line x1="16" y1="14" x2="21" y2="8" stroke="#00f3ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.48" />
          <line x1="11" y1="8" x2="8" y2="4" stroke="#00f3ff" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <line x1="21" y1="8" x2="24" y2="4" stroke="#00f3ff" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          {/* node leaves */}
          <circle cx="16" cy="14" r="1.7" fill="#00f3ff" />
          <circle cx="16" cy="20" r="1.5" fill="#00f3ff" opacity="0.95" />
          <circle cx="9" cy="13" r="1.6" fill="#00f3ff" opacity="0.95" />
          <circle cx="23" cy="13" r="1.6" fill="#00f3ff" opacity="0.95" />
          <circle cx="11" cy="8" r="1.4" fill="#00f3ff" opacity="0.88" />
          <circle cx="21" cy="8" r="1.4" fill="#00f3ff" opacity="0.88" />
          <circle cx="8" cy="4" r="1.2" fill="#00f3ff" opacity="0.78" />
          <circle cx="24" cy="4" r="1.2" fill="#00f3ff" opacity="0.78" />
          {/* canopy crown */}
          <circle cx="16" cy="3.5" r="2.0" fill="#00f3ff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
