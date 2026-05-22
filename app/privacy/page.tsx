import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Privacy — AI Tree Library",
  description: "What data we collect, why, and how to opt out. AI Tree Library is privacy-friendly by design.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-topbar">
        <Link href="/" className="legal-back">← Back to constellation</Link>
      </header>

      <article>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: 22 May 2026</p>

        <p>
          AI Tree Library is a curated, mostly-static directory. We try to collect as little as
          possible while still being able to improve the site.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Aggregated analytics</strong> via Vercel Analytics — anonymized page views,
            referrers, country, device type. Cookieless. Cannot identify individual visitors.
          </li>
          <li>
            <strong>Performance metrics</strong> via Vercel Speed Insights — page load times,
            web vitals. Cookieless.
          </li>
          <li>
            <strong>Custom usage events</strong> — when you click a tool, run a search, or open a
            filter, we log the event (e.g. <code>tool_view: chatgpt</code>) so we can see which
            tools and categories get the most attention. No IP or personal identifier is attached.
          </li>
          <li>
            <strong>Public submissions</strong> — if you submit a tool via the form, we record
            the URL, optional name/handle, and optional email. The email is used only to follow
            up if needed and is never shown publicly.
          </li>
        </ul>

        <h2>What we DON'T collect</h2>
        <ul>
          <li>No tracking cookies.</li>
          <li>No third-party advertising trackers.</li>
          <li>No fingerprinting.</li>
          <li>No data sold to anyone.</li>
        </ul>

        <h2>Third parties</h2>
        <p>
          The site is hosted on <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a>.
          Content is managed through <a href="https://notion.so" target="_blank" rel="noopener noreferrer">Notion</a>.
          Submissions optionally pass through <a href="https://anthropic.com" target="_blank" rel="noopener noreferrer">Anthropic</a> for
          automatic classification. Each has its own privacy policy.
        </p>

        <h2>External links</h2>
        <p>
          Every entry in the library is an external website operated by a third party. We do not
          endorse them and have no control over their content or privacy practices.
        </p>

        <h2>Contact</h2>
        <p>
          Curated by <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">Elliot Daemon</a>.
          Questions or removal requests: open an issue at{" "}
          <a href="https://github.com/ElliotDaemon/ai-tree-library" target="_blank" rel="noopener noreferrer">
            github.com/ElliotDaemon/ai-tree-library
          </a>.
        </p>
      </article>

      <Footer />
    </main>
  );
}
