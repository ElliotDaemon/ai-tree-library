// Minimal liquid-glass footer used on tool/category/legal/about pages.
// NOT on the home (home stays full-bleed scene).

import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="ne-footer">
      <div className="ne-footer-inner">
        <div className="ne-footer-copy">
          © {year} <a href="https://elliotdaemon.com" target="_blank" rel="noopener noreferrer">Elliot Daemon</a>
          {" · "}AI Tree Library <span className="ne-footer-r">®</span>
        </div>
        <nav className="ne-footer-nav" aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="https://github.com/ElliotDaemon/ai-tree-library" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
