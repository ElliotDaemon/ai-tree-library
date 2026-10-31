// What never leaves your machine when importing: personal folders, accounts, dashboards, tokens.
// Shared by scripts/import-bookmarks.mjs and the portal's "Add links" (which runs on the server).
// Folders whose links are personal, not library material.
export const PRIVATE_FOLDER = /(official roster|\/projects$|proton|\/save$|\/wix$|\/x$|youtube|\/google$|11:11 inc|global & ip|\/ir$|\/re$|data recovery)/i;
// Hosts that are accounts, personal properties or platforms too generic to list.
export const PRIVATE_HOST = /(^|\.)((?<!(?:chromewebstore|play)\.)google\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|reddit\.com|notion\.so|notion\.site|proton\.me|wix\.com|editorx\.com|1111[a-z]*\.(com|org)|elliotdaemon\.com|alinacak\.com|sparkwrld\.com|aitreelibrary\.com|vercel\.app|localhost|amazon\.[a-z.]+|ebay\.[a-z.]+|paypal\.com|stripe\.com|dropbox\.com|wetransfer\.com|we\.tl|bit\.ly|linktr\.ee|t\.co|spotify\.com|(?<!apps\.)apple\.com|icloud\.com|microsoft\.com|live\.com|outlook\.com|gmail\.com|whatsapp\.com|discord\.(com|gg)|zoom\.us|calendly\.com|airtable\.com|canva\.com|slack\.com|twitch\.tv|docusign\.(com|net)|thinkific\.com|quora\.com|worldcat\.org|bookshop\.org|bankrate\.com|rollingstone\.com|ign\.com|xda-developers\.com|sahibinden\.com|disneyplus\.com|crunchyroll\.com|tvplus\.com\.tr)$/i;
// Paths that point inside an account rather than at a product.
export const PRIVATE_PATH = /^chrome|^https:\/\/(my|labels|admin|console)\.|\/~|\/(backstage|watchlist|password|bank|dashboard|admin|account|settings|billing|login|signin|sign-in|signup|sign-up|auth|edit|invoice|inbox|checkout|cart|my-|profile|projects?\/[a-z0-9-]{8,}|d\/[a-z0-9_-]{20,})|[?&](token|key|code|session|sig|auth)=/i;

/**
 * Decide what an imported link becomes.
 *   source "bookmarks": personal folders and account hosts are skipped, deep links collapse to the product's front door
 *   source "list":      the exact URL is kept (you pasted it on purpose); only account pages and tokens are refused
 * @returns {{ url: string } | { skip: string }}
 */
export function admit(url, { source = "list", folder = "", kind = "" } = {}) {
  let u;
  try { u = new URL(url); } catch { return { skip: "not a link" }; }
  if (PRIVATE_PATH.test(url)) return { skip: "account or private page" };
  if (source === "bookmarks") {
    if (PRIVATE_FOLDER.test(folder)) return { skip: "personal folder" };
    if (PRIVATE_HOST.test(u.hostname.replace(/^www\./, ""))) return { skip: "account or personal site" };
    const store = ["ios", "android", "extension", "desktop"].includes(kind);
    if (!store) return { url: u.pathname.split("/").filter(Boolean).length > 1 ? `${u.origin}/` : `${u.origin}${u.pathname}` };
  }
  return { url };
}
