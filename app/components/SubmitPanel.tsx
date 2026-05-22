// Modal submission form. Liquid-glass card over a backdrop.
// POSTs to /api/submit. Renders Cloudflare Turnstile widget if
// NEXT_PUBLIC_TURNSTILE_SITE_KEY env var is set; otherwise submits without
// a bot challenge (rate limited by Notion dedupe + manual review).

"use client";

import { useEffect, useRef, useState } from "react";
import { trackSubmissionSent } from "../../lib/track";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; message: string; host: string; classified: boolean }
  | { kind: "error"; message: string; existing?: boolean };

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function SubmitPanel({ open, onClose }: Props) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [submitter, setSubmitter] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);

  // Load Turnstile script + render widget when modal opens
  useEffect(() => {
    if (!open || !TURNSTILE_KEY) return;
    const scriptId = "turnstile-script";
    let cancelled = false;

    const mount = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current) return;
      // Avoid double-render
      if (turnstileWidgetRef.current) {
        try {
          window.turnstile.reset(turnstileWidgetRef.current);
        } catch { /* ignore */ }
        setTurnstileToken(null);
        return;
      }
      try {
        const widgetId = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_KEY,
          theme: "dark",
          appearance: "interaction-only",
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
        });
        turnstileWidgetRef.current = widgetId;
      } catch (e) {
        console.warn("Turnstile render failed:", e);
      }
    };

    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      s.async = true;
      s.defer = true;
      window.onTurnstileLoad = mount;
      document.head.appendChild(s);
    } else {
      // Already loaded
      mount();
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetRef.current && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetRef.current); } catch { /* ignore */ }
        turnstileWidgetRef.current = null;
      }
    };
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const reset = () => {
    setUrl("");
    setName("");
    setNote("");
    setSubmitter("");
    setEmail("");
    setStatus({ kind: "idle" });
    setTurnstileToken(null);
    if (turnstileWidgetRef.current && window.turnstile) {
      try { window.turnstile.reset(turnstileWidgetRef.current); } catch { /* ignore */ }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setStatus({ kind: "error", message: "URL is required." });
      return;
    }
    if (TURNSTILE_KEY && !turnstileToken) {
      setStatus({ kind: "error", message: "Please complete the bot check." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
          note: note.trim() || undefined,
          submitter: submitter.trim() || undefined,
          email: email.trim() || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; message?: string; host?: string; classified?: boolean; existing?: boolean };
      if (data.ok) {
        trackSubmissionSent({ host: data.host ?? "unknown" });
        setStatus({ kind: "ok", message: data.message ?? "Thanks!", host: data.host ?? "", classified: !!data.classified });
      } else {
        setStatus({ kind: "error", message: data.error ?? "Something went wrong.", existing: data.existing });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error. Please try again." });
    }
  };

  return (
    <div className="ne-submit-backdrop" onClick={onClose}>
      <div className="ne-submit-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ne-submit-close" onClick={onClose} aria-label="Close">×</button>

        {status.kind === "ok" ? (
          <div className="ne-submit-success">
            <div className="ne-submit-success-icon">✓</div>
            <h2 className="ne-submit-title">Submission received</h2>
            <p className="ne-submit-msg">
              <strong>{status.host}</strong> {status.classified ? "has been auto-classified and added to the review queue." : "is in the review queue."}
              {" "}We review every submission by hand before it appears in the constellation.
            </p>
            <button className="ne-submit-btn" onClick={reset}>Submit another</button>
          </div>
        ) : (
          <>
            <h2 className="ne-submit-title">Submit a tool</h2>
            <p className="ne-submit-lede">
              Found a cool AI tool, design site, or creative resource? Drop it in. We&apos;ll classify it and review it by hand before it joins the constellation.
            </p>

            <form onSubmit={onSubmit} className="ne-submit-form">
              <label className="ne-submit-field">
                <span className="ne-submit-label">URL <em>*</em></span>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="ne-submit-input"
                  autoFocus
                />
              </label>

              <label className="ne-submit-field">
                <span className="ne-submit-label">Name <em>(optional)</em></span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-fetched from the page if blank"
                  className="ne-submit-input"
                  maxLength={120}
                />
              </label>

              <label className="ne-submit-field">
                <span className="ne-submit-label">Why this is cool <em>(optional, ~200 chars)</em></span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What makes this worth bookmarking?"
                  className="ne-submit-input ne-submit-textarea"
                  maxLength={300}
                  rows={3}
                />
              </label>

              <div className="ne-submit-row">
                <label className="ne-submit-field ne-submit-field-half">
                  <span className="ne-submit-label">Your handle <em>(optional, gets credit)</em></span>
                  <input
                    type="text"
                    value={submitter}
                    onChange={(e) => setSubmitter(e.target.value)}
                    placeholder="@yourname"
                    className="ne-submit-input"
                    maxLength={60}
                  />
                </label>
                <label className="ne-submit-field ne-submit-field-half">
                  <span className="ne-submit-label">Email <em>(optional, private)</em></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@…"
                    className="ne-submit-input"
                    maxLength={200}
                  />
                </label>
              </div>

              {TURNSTILE_KEY ? <div ref={turnstileContainerRef} className="ne-submit-turnstile" /> : null}

              {status.kind === "error" ? (
                <div className="ne-submit-error">{status.message}</div>
              ) : null}

              <button
                type="submit"
                className="ne-submit-btn"
                disabled={status.kind === "submitting" || (Boolean(TURNSTILE_KEY) && !turnstileToken)}
              >
                {status.kind === "submitting" ? "Submitting…" : "Submit for review"}
              </button>

              <p className="ne-submit-disclaim">
                Email is used only for follow-up. We never display it. By submitting, you agree
                that the link doesn&apos;t contain malware or illegal content. See <a href="/terms">terms</a>.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
