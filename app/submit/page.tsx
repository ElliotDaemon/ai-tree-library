import type { Metadata } from "next";
import { Footer, REPO, Top } from "@/components/Chrome";
import SubmitForm from "@/components/SubmitForm";
import { BRANCHES } from "@/lib/taxonomy.mjs";

export const metadata: Metadata = { title: "Submit a link", description: "Add a website, AI tool, app, widget or extension to the open library. Every submission is reviewed by a person.", alternates: { canonical: "/submit" } };

export default function SubmitPage() {
  const branches = BRANCHES.map((b) => ({ id: b.id, name: b.name, subs: b.subs.map((s) => ({ id: s.id, name: s.name })) }));
  return (
    <>
      <Top />
      <main className="wrap page">
        <div className="prose" style={{ textAlign: "center", margin: "0 auto 28px" }}>
          <div className="eyebrow">Contribute</div>
          <h1>Add something useful</h1>
          <p>Paste a link. The page describes itself, you check the details, a person reviews it. No account, no tracking. Prefer git? Open a pull request on <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>.</p>
        </div>
        <SubmitForm branches={branches} />
      </main>
      <Footer />
    </>
  );
}
