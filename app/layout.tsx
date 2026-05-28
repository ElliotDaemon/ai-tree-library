import type { Metadata } from "next";
import { Geist, Geist_Mono, Josefin_Sans, Spectral } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Josefin Sans = the wordmark font on elliotdaemon.com — geometric thin
// sans with triangular A and perfect-circle O. Used for the credit mark.
const josefinSans = Josefin_Sans({
  variable: "--font-wordmark",
  weight: ["300"],
  subsets: ["latin"],
});

// Spectral = the editorial serif used on tool/category/rarity/tag pages.
// Chosen for: low-contrast strokes that read well at body size, generous
// x-height for legibility, three weights covering display + body + italic.
// Same vibe as Stratechery / The Atlantic — measured, serious, considered.
const spectral = Spectral({
  variable: "--font-serif",
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Tree Library — A 3D constellation of AI tools, design inspo & creative resources",
  description:
    "A hand-curated web library rendered as a navigable 3D constellation. Explore AI tools, design inspiration, and creative resources floating in dark space.",
  metadataBase: new URL("https://aitreelibrary.com"),
  openGraph: {
    // The opengraph-image is set automatically by Next.js from app/opengraph-image.tsx
    title: "AI Tree Library",
    description: "A 3D constellation of curated AI tools, design inspo, and creative resources.",
    url: "https://aitreelibrary.com",
    siteName: "AI Tree Library",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Tree Library",
    description: "A 3D constellation of curated AI tools, design inspo, and creative resources.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${josefinSans.variable} ${spectral.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
