import type { Metadata } from "next";
import { Footer, Top } from "@/components/Chrome";

export const metadata: Metadata = { title: "Privacy", description: "What AI Tree Library collects (very little) and why.", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <>
      <Top />
      <main className="wrap page">
        <article className="prose">
          <div className="eyebrow">Last updated 31 October 2026</div>
          <h1>Privacy</h1>
          <p>No accounts, no cookies for visitors, no selling of anything.</p>
          <h2>Analytics</h2>
          <p>Vercel Web Analytics counts anonymous page views without cookies. Speed Insights measures how fast pages load.</p>
          <h2>Submissions</h2>
          <p>When you submit a link we store the link, the details you typed and the optional credit handle in the public repository, because the review queue is public. Do not put anything private in a submission. We never ask for an email address.</p>
          <h2>Third parties</h2>
          <p>Site icons load from DuckDuckGo&apos;s icon service and page previews from WordPress.com&apos;s screenshot service. They see the address of the site being shown, not who you are beyond what any image request reveals.</p>
          <h2>Contact</h2>
          <p>Open an issue on GitHub and the 11:11 team will remove anything you ask.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
