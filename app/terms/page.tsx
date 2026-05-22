import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Terms — AI Tree Library",
  description: "Terms of use for the AI Tree Library.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <header className="legal-topbar">
        <Link href="/" className="legal-back">← Back to constellation</Link>
      </header>

      <article>
        <h1>Terms of Use</h1>
        <p className="legal-updated">Last updated: 22 May 2026</p>

        <p>
          AI Tree Library (<a href="https://aitreelibrary.com">aitreelibrary.com</a>) is a curated
          directory operated by Elliot Daemon. By using the site you agree to the following.
        </p>

        <h2>The library is a curation</h2>
        <p>
          Each entry is selected on the basis of its perceived usefulness. Inclusion is not an
          endorsement. We make no warranty as to the accuracy, safety, or current availability of
          any linked product, service, or website.
        </p>

        <h2>External links</h2>
        <p>
          Clicking a tool takes you off-site. We have no control over external sites and accept
          no responsibility for their content, privacy practices, or business conduct. Use third-
          party tools at your own discretion.
        </p>

        <h2>Submissions</h2>
        <p>
          When you submit a tool through the public form, you confirm that the link does not
          contain malware, illegal content, or material that infringes someone else's rights. We
          reserve the right to reject, edit, or remove any submission for any reason. Approved
          submissions may credit you by the handle you provided.
        </p>

        <h2>Intellectual property</h2>
        <p>
          The AI Tree Library brand, design, and original written content are © Elliot Daemon.
          Linked products and brands belong to their respective owners. ELLIOT DAEMON® is a
          registered trademark.
        </p>

        <h2>No warranty</h2>
        <p>
          The site is provided "as is" without warranties of any kind. To the maximum extent
          permitted by law, we disclaim liability for any damages arising from your use of the
          site or any linked third party.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated from time to time. The current version is always at this
          URL.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">
            elliotdaemon.com
          </a>
        </p>
      </article>

      <Footer />
    </main>
  );
}
