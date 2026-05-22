// Visit-link button used on tool pages. Wraps a regular anchor with click
// tracking via lib/track.ts.

"use client";

import { trackLinkClick } from "../../lib/track";

export default function VisitButton({
  url,
  name,
  slug,
  source = "tool_page",
  children,
}: {
  url: string;
  name: string;
  slug?: string;
  source?: "tool_page" | "data_panel" | "list" | "category_card";
  children: React.ReactNode;
}) {
  return (
    <a
      href={url}
      className="tp-visit"
      target="_blank"
      rel="noopener noreferrer nofollow"
      data-tool-slug={slug ?? ""}
      data-tool-name={name}
      onClick={() => trackLinkClick({ name, slug, destination: url, source })}
    >
      {children}
    </a>
  );
}
