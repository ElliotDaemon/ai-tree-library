import Link from "next/link";
import { GitIcon, Mark, PlusIcon } from "./Icons";
import ThemeToggle from "./ThemeToggle";

export const REPO = "https://github.com/ElliotDaemon/ai-tree-library";

export function Top({ count }: { count?: number }) {
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="AI Tree Library home">
          <Mark /> <span>AI Tree Library</span>
        </Link>
        <span className="spacer" />
        {count !== undefined && <span className="count mono">{count.toLocaleString("en")} links</span>}
        <Link href="/about" className="pill ghost hide-sm">About</Link>
        <a href={REPO} className="pill icon-btn" aria-label="Source on GitHub" target="_blank" rel="noreferrer"><GitIcon size={16} /></a>
        <ThemeToggle />
        <Link href="/submit" className="pill accent"><PlusIcon size={15} /> Submit</Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot-site">
      <div className="wrap">
        <span>Open source · <a href="/api/library.json">Open data (CC0)</a> · <a href={REPO} target="_blank" rel="noreferrer">GitHub</a></span>
        <Link href="/about">How it works</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <span className="spacer" />
        <a href="https://1111official.com" target="_blank" rel="noreferrer" aria-label="An 11:11 project" title="An 11:11 project">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/1111.png" alt="11:11" className="mark-1111" />
        </a>
      </div>
    </footer>
  );
}
