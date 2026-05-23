// /portal/login — username + password gate for the analytics portal.
//
// Server component. Renders a liquid-glass form that POSTs to
// /api/portal/login. The form uses the autocomplete attributes that
// password managers (Proton Pass, 1Password, Bitwarden, browser keychain)
// look for, so credentials get saved and offered on subsequent visits.
//
// If a valid session cookie is already present, redirect straight through
// to the dashboard (or to the original target via ?from=).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  getAdminUser,
  isAdminConfigured,
  verifySession,
} from "@/lib/portal-auth";

export const metadata: Metadata = {
  title: "Portal Login — AI Tree Library",
  description: "Sign in to the AI Tree Library admin portal.",
  robots: { index: false, follow: false },
};

// Always render fresh — never cache the login page
export const dynamic = "force-dynamic";

type SP = Promise<{ from?: string; error?: string }>;

function safeReturn(from: string | undefined): string {
  if (!from) return "/portal";
  // Only allow same-origin paths — no protocol/host slip-through
  if (!from.startsWith("/") || from.startsWith("//")) return "/portal";
  return from;
}

export default async function PortalLoginPage({ searchParams }: { searchParams: SP }) {
  const { from, error } = await searchParams;
  const target = safeReturn(from);

  // Already logged in? Skip the form.
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (await verifySession(session)) {
    redirect(target);
  }

  const configured = isAdminConfigured();
  const defaultUser = getAdminUser();

  return (
    <main className="pl-page">
      <style>{LOGIN_CSS}</style>
      <form className="pl-card" method="POST" action="/api/portal/login" autoComplete="on">
        <input type="hidden" name="from" value={target} />
        <div className="pl-brand">
          <span className="pl-lock">🔒</span>
          <h1 className="pl-title">Portal Login</h1>
          <p className="pl-sub">AI Tree Library admin</p>
        </div>

        {!configured ? (
          <p className="pl-warn">
            <code>ADMIN_PASSWORD</code> env var is not set on this deployment. The portal cannot
            be unlocked until it is.
          </p>
        ) : null}

        {error === "1" ? <p className="pl-error">Invalid username or password.</p> : null}

        <label className="pl-field">
          <span>Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={defaultUser}
            required
            disabled={!configured}
          />
        </label>

        <label className="pl-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            disabled={!configured}
          />
        </label>

        <button className="pl-button" type="submit" disabled={!configured}>
          Log in
        </button>

        <p className="pl-footer">
          <a href="/">← Back to the constellation</a>
        </p>
      </form>
    </main>
  );
}

// Self-contained CSS so the login screen renders identically even before
// global styles load. Mirrors the liquid-glass tokens used elsewhere.
const LOGIN_CSS = `
.pl-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background:
    radial-gradient(ellipse at top, rgba(0, 243, 255, 0.06), transparent 60%),
    radial-gradient(ellipse at bottom, rgba(255, 105, 180, 0.04), transparent 60%),
    #030508;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
.pl-card {
  width: 100%;
  max-width: 22rem;
  padding: 2.4rem 2.2rem 2rem;
  border: 1px solid rgba(0, 243, 255, 0.22);
  border-radius: 16px;
  background: rgba(7, 14, 28, 0.62);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow:
    0 14px 60px rgba(0, 0, 0, 0.55),
    0 0 40px rgba(0, 243, 255, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.pl-brand { text-align: center; }
.pl-lock {
  display: block;
  font-size: 1.6rem;
  margin-bottom: 0.4rem;
  filter: drop-shadow(0 0 12px rgba(0, 243, 255, 0.4));
}
.pl-title {
  font-size: 1rem;
  letter-spacing: 0.3em;
  font-weight: 200;
  text-transform: uppercase;
  margin: 0 0 0.3rem;
  color: #00f3ff;
  text-shadow: 0 0 14px rgba(0, 243, 255, 0.35);
}
.pl-sub {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #6b7c98;
  margin: 0;
}
.pl-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.pl-field span {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #8b9bb4;
  font-weight: 500;
}
.pl-field input {
  appearance: none;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(0, 243, 255, 0.18);
  border-radius: 8px;
  padding: 0.7rem 0.85rem;
  color: #fff;
  font-size: 0.95rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.pl-field input:focus {
  border-color: rgba(0, 243, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(0, 243, 255, 0.12);
}
.pl-field input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pl-button {
  margin-top: 0.4rem;
  background: linear-gradient(135deg, rgba(0, 243, 255, 0.85), rgba(150, 90, 255, 0.85));
  color: #030508;
  border: none;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.78rem;
  letter-spacing: 0.3em;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.12s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  box-shadow: 0 6px 24px rgba(0, 243, 255, 0.22);
}
.pl-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 28px rgba(0, 243, 255, 0.3);
}
.pl-button:active:not(:disabled) {
  transform: translateY(0);
}
.pl-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pl-error {
  margin: 0;
  padding: 0.55rem 0.7rem;
  background: rgba(255, 90, 120, 0.12);
  border: 1px solid rgba(255, 90, 120, 0.4);
  color: #ff8aa0;
  border-radius: 8px;
  font-size: 0.82rem;
  text-align: center;
}
.pl-warn {
  margin: 0;
  padding: 0.6rem 0.75rem;
  background: rgba(255, 200, 100, 0.08);
  border: 1px solid rgba(255, 200, 100, 0.3);
  color: #f3c97a;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.5;
}
.pl-warn code {
  color: #ffd98a;
  background: rgba(255, 200, 100, 0.14);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.92em;
}
.pl-footer {
  text-align: center;
  margin: 0.6rem 0 0;
  font-size: 0.75rem;
  color: #6b7c98;
}
.pl-footer a {
  color: #8db4d0;
  text-decoration: none;
  border-bottom: 1px dashed rgba(141, 180, 208, 0.3);
  padding-bottom: 1px;
}
.pl-footer a:hover {
  color: #00f3ff;
  border-color: rgba(0, 243, 255, 0.5);
}
`;
