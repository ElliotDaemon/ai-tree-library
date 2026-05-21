import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Tree Library — A 3D constellation of AI tools, design inspo, and creative resources",
  description:
    "A hand-curated web library rendered as a navigable 3D constellation. Explore AI tools, design inspiration, and creative resources floating in dark space.",
  metadataBase: new URL("https://aitreelibrary.com"),
  openGraph: {
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
