export type Kind = "website" | "tool" | "ios" | "android" | "extension" | "widget" | "desktop" | "resource" | "inspiration";

/** A published link. `id` is its permanent URL slug. */
export interface Entry {
  id: string;
  name: string;
  url: string;
  kind: Kind;
  branch: string;
  sub: string;
  description: string;
  tags: string[];
  pricing?: string;
  featured?: boolean;
  gem?: boolean;
  added: string;
  origin: string;
  submitter?: string;
}

/** Waiting for a decision in the portal. */
export interface QueueItem {
  id: string;
  url: string;
  name: string;
  description: string;
  kind: Kind;
  branch: string;
  sub: string;
  confidence?: number;
  tags: string[];
  pricing?: string;
  featured?: boolean;
  gem?: boolean;
  /** A slug to keep (legacy entries keep their old URL). */
  slug?: string;
  origin: "legacy" | "community" | "review" | "bookmarks" | string;
  submitter?: string;
  note?: string;
  submittedAt: string;
}

/** The compact row the browser gets (public/api/index.json). */
export interface Row {
  i: string; // id / slug
  n: string; // name
  h: string; // host
  u?: string; // url
  d: string; // description
  b: string; // branch
  s: string; // sub
  k: Kind;
  t: string[];
  f?: 1;
  g?: 1;
  a: string; // added (yyyy-mm-dd)
}
