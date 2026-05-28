// Favicon — auto-generated PNG via Next.js's ImageResponse so browsers
// that ignore SVG favicons (older Edge/Safari, Android home screens via
// "Add to Home Screen") still get the AI Tree Library tree mark instead
// of falling back to the default Vercel triangle.
//
// Renders the same node-tree silhouette as the brand mark in the
// top-left of the live site — cyan branches + glowing canopy on a deep
// navy background, rounded corners so it sits well in browser tabs and
// taskbars regardless of theme.

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "20%",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* branches */}
          <line x1="16" y1="29" x2="16" y2="14" stroke="#00f3ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          <line x1="16" y1="20" x2="9" y2="13" stroke="#00f3ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
          <line x1="16" y1="20" x2="23" y2="13" stroke="#00f3ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
          <line x1="16" y1="14" x2="11" y2="8" stroke="#00f3ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
          <line x1="16" y1="14" x2="21" y2="8" stroke="#00f3ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
          {/* node leaves */}
          <circle cx="16" cy="14" r="1.7" fill="#00f3ff" />
          <circle cx="16" cy="20" r="1.5" fill="#00f3ff" opacity="0.95" />
          <circle cx="9" cy="13" r="1.6" fill="#00f3ff" opacity="0.95" />
          <circle cx="23" cy="13" r="1.6" fill="#00f3ff" opacity="0.95" />
          <circle cx="11" cy="8" r="1.4" fill="#00f3ff" opacity="0.88" />
          <circle cx="21" cy="8" r="1.4" fill="#00f3ff" opacity="0.88" />
          {/* canopy crown */}
          <circle cx="16" cy="3.5" r="2.0" fill="#00f3ff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
