import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://aitreelibrary.com"),
  title: { default: "AI Tree Library — the open library of the useful internet", template: "%s — AI Tree Library" },
  description:
    "Grown in the open. Shared with everyone. An open-source library of websites, AI tools, apps, widgets and extensions that anyone can add to, use, fork and build on.",
  openGraph: { siteName: "AI Tree Library", type: "website", url: "https://aitreelibrary.com" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0e" },
    { media: "(prefers-color-scheme: light)", color: "#d9d9db" },
  ],
};

// Theme before paint: saved choice, else the system's.
const themeScript = `try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
