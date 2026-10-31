import type { Metadata } from "next";
import { Footer, Top } from "@/components/Chrome";

export const metadata: Metadata = { title: "Terms", description: "Terms for using AI Tree Library.", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <>
      <Top />
      <main className="wrap page">
        <article className="prose">
          <div className="eyebrow">Last updated 31 October 2026</div>
          <h1>Terms</h1>
          <p>AI Tree Library is a list of links to other people&apos;s work. The 11:11 team reviews each one, but doesn&apos;t run those sites and can&apos;t vouch for them. Use them at your own judgment.</p>
          <h2>The data</h2>
          <p>The library&apos;s data is released under CC0: use it for anything. The code is open source under its repository licence.</p>
          <h2>Submissions</h2>
          <p>By submitting a link you agree it can be published, edited or declined. Spam, malware, adult content and anything unlawful are declined.</p>
          <h2>Removal</h2>
          <p>If you own a listed site and want it changed or removed, open an issue on GitHub and the 11:11 team will handle it quickly.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
