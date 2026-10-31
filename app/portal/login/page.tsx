import type { Metadata } from "next";
import { Mark } from "@/components/Icons";
import "../portal.css";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string; retry?: string; from?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error, retry, from } = await searchParams;
  const msg = error === "locked" ? `Too many attempts. Try again in ${retry || 15} minutes.` : error ? "That didn't match." : "";
  return (
    <main className="login">
      <form className="sheet" method="post" action="/api/portal/login">
        <div className="brand" style={{ marginBottom: 26 }}><Mark /> <span>AI Tree Library · Portal</span></div>
        <input type="hidden" name="from" value={from || "/portal"} />
        <label className="field"><span>Username</span><input className="input" name="username" autoComplete="username" required autoFocus /></label>
        <label className="field"><span>Password</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        {msg && <p className="note err" style={{ margin: "0 0 12px" }}>{msg}</p>}
        <button className="pill accent lg" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>Enter</button>
      </form>
    </main>
  );
}
