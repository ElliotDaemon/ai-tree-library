import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "About — AI Tree Library",
  description: "A living 3D constellation of curated AI tools, design inspiration & creative resources, hand-picked by Elliot Daemon.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="legal-page">
      <header className="legal-topbar">
        <Link href="/" className="legal-back">← Back to constellation</Link>
      </header>

      <article>
        <h1>About</h1>

        <p>
          <strong>AI Tree Library</strong> is a hand-curated 3D constellation of AI tools, design
          inspiration, and creative resources. Every glowing node in the constellation is a real
          link — discovered, vetted, and tagged before it earns its place.
        </p>

        <h2>Why this exists</h2>
        <p>
          AI moves too fast for static lists. The cool tool you found today is buried under a
          hundred newer ones tomorrow. So instead of a list that scrolls, we made a tree you can
          fly through — categories branch outward, hidden gems sparkle, and you discover things
          by wandering rather than searching.
        </p>
        <p>
          Underneath the visual: <strong>303+</strong> entries across <strong>19</strong> top-level
          categories and <strong>~50</strong> subcategories, with four rarity tiers (Legendary,
          Established, Rare, Hidden Gem). Anyone can submit a tool through the public form. Every
          submission is reviewed by hand.
        </p>

        <h2>How it's built</h2>
        <p>
          The library is stored in Notion. A nightly build pulls it, computes the 3D constellation
          layout, and ships it to Vercel's edge as a static site. The 3D scene is built with
          React Three Fiber. The font on the wordmark is{" "}
          <a href="https://fonts.google.com/specimen/Josefin+Sans" target="_blank" rel="noopener noreferrer">
            Josefin Sans
          </a>{" "}
          — the same one used on{" "}
          <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">
            elliotdaemon.com
          </a>.
        </p>

        <h2>Who's behind it</h2>
        <p>
          Designed and built by{" "}
          <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">
            Elliot Daemon
          </a>{" "}
          — independent creative technologist, label owner (11:11 RECORDS), and operator of{" "}
          <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">
            ELLIOT DAEMON®
          </a>. The library started as a personal bookmark folder and became the constellation.
        </p>

        <h2>Add a tool</h2>
        <p>
          Tap the <strong>+ Submit</strong> button in the floating control blob, or paste a URL
          into the form. Approved submissions show up in the constellation within a day.
        </p>

        <h2>Get in touch</h2>
        <p>
          For correspondence:{" "}
          <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">elliotdaemon.com</a>{" "}
          ·{" "}
          <a href="https://github.com/ElliotDaemon/ai-tree-library" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </article>

      <Footer />
    </main>
  );
}
