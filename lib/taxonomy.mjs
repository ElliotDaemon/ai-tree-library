// AI Tree Library — taxonomy, URL normalisation and the zero-cost classifier.
// Plain ESM so build scripts (node) and the app (TS, allowJs) share one source.
// Adding a branch or sub-branch here is all it takes: colours, layout and routes derive from it.

/** @typedef {{ id: string, name: string, words: RegExp }} Sub */
/** @typedef {{ id: string, name: string, blurb: string, subs: Sub[] }} Branch */

const w = (s) => new RegExp(`\\b(?:${s})`, "i");

/** @type {Branch[]} */
export const BRANCHES = [
  { id: "ai-assistants-agents", name: "AI Assistants & Agents", blurb: "Chatbots, agents and voice assistants.", subs: [
    { id: "ai-chatbots", name: "AI Chatbots", words: w("chatbot|chat ?gpt|claude|gemini|grok|deepseek|mistral|kimi|llm|large language|assistant|companion|character chat|perplexity") },
    { id: "ai-agents", name: "AI Agents", words: w("agent|agentic|autonomous|manus|operator|deepagent|multi-step") },
    { id: "voice-assistants", name: "Voice Assistants", words: w("voice assistant|voice agent|realtime voice") },
  ]},
  { id: "code-development", name: "Code & Development", blurb: "Editors, copilots, app builders and dev tools.", subs: [
    { id: "ai-code-editors", name: "AI Code Editors", words: w("code editor|ide\\b|cursor|windsurf|zed\\b") },
    { id: "ai-app-builders", name: "AI App Builders", words: w("app builder|build (?:an? )?apps?|mobile app using ai|lovable|bolt\\b|v0\\b|rork|deepsite|vibe cod") },
    { id: "coding-assistants", name: "Coding Assistants", words: w("coding assistant|copilot|code review|code completion|pair programm") },
    { id: "dev-tools-apis", name: "Dev Tools & APIs", words: w("api\\b|sdk|developer|devtool|github|open[- ]source library|webgl|framework|component|markdown|json") },
  ]},
  { id: "image-art", name: "Image & Art", blurb: "Generation, editing, design and inspiration.", subs: [
    { id: "image-generation", name: "Image Generation", words: w("image generat|text[- ]to[- ]image|midjourney|stable diffusion|flux|ai art|portrait") },
    { id: "image-editing", name: "Image Editing", words: w("background remov|remove background|upscal|inpaint|object remov|retouch|restor") },
    { id: "ai-design-tools", name: "AI Design Tools", words: w("design tool|ui design|designer for|brand assets|logo maker|infographic|figma|stitch|canva|mockup generat") },
    { id: "design-inspiration", name: "Design Inspiration", words: w("inspiration|portfolio|showcase|gallery|awwwards|designer community|creative studio|digital agency|curated sites") },
    { id: "stock-assets", name: "Stock Assets", words: w("stock|mockups?|templates|icons?|fonts?|textures|wallpapers?|creative assets|logos? (?:png|svg)|free resources") },
    { id: "photo-editing", name: "Photo Editing", words: w("photo edit|lightroom|photo filter|metadata|exif") },
  ]},
  { id: "video-animation", name: "Video & Animation", blurb: "Generation, editing and avatars.", subs: [
    { id: "video-generation", name: "Video Generation", words: w("video generat|text[- ]to[- ]video|image[- ]to[- ]video|portrait[- ]to[- ]video|ai video|short[- ]video|video tool|music videos?|meme video|party clip|clip from|tv shows") },
    { id: "video-editing", name: "Video Editing", words: w("video edit|editor for video|subtitles|captions|showcase videos?|motion templates|video templates|renderforest") },
    { id: "ai-avatars", name: "AI Avatars", words: w("avatar|talking head|digital human|lip ?sync") },
  ]},
  { id: "audio-music", name: "Audio & Music", blurb: "Generation, production, plugins and sound.", subs: [
    { id: "music-generation", name: "Music Generation", words: w("music generat|ai music|song generat|suno|udio|text[- ]to[- ]music") },
    { id: "mixing-mastering", name: "Mixing & Mastering", words: w("mixing|mastering|loudness") },
    { id: "composition-midi", name: "Composition & MIDI", words: w("midi|chord|composition|melody|piano|notation") },
    { id: "drums-beats", name: "Drums & Beats", words: w("drum|beat ?maker|beats\\b") },
    { id: "vocal-processing", name: "Vocal Processing", words: w("vocal|autotune|pitch correct") },
    { id: "stem-separation", name: "Stem Separation", words: w("stem|vocal remov|isolat") },
    { id: "voice-speech", name: "Voice & Speech", words: w("text[- ]to[- ]speech|tts\\b|voice clon|speech|elevenlabs|narrat") },
    { id: "audio-enhancement", name: "Audio Enhancement", words: w("noise|denois|audio enhanc|podcast clean") },
    { id: "sound-design-samples", name: "Sound Design & Samples", words: w("samples?\\b|sample packs?|loops?\\b|sound design|kontakt|sound effects|sfx") },
    { id: "plugins-instruments", name: "Plugins & Instruments", words: w("plugins?|vst|\\bau\\b|aax|synth|instrument|audio software|daw\\b") },
    { id: "lyrics-songwriting", name: "Lyrics & Songwriting", words: w("lyric|songwrit|rhyme") },
  ]},
  { id: "music-business", name: "Music Business", blurb: "Distribution, PR, promotion, booking and rights.", subs: [
    { id: "distribution", name: "Distribution", words: w("distribut|distrokid|tunecore|cd ?baby|amuse|ditto|release your music") },
    { id: "pr-promotion", name: "PR & Promotion", words: w("music pr|public relations|\\bpr\\b|promotion|promo|publicity|press|exposure|marketing agency|music marketing") },
    { id: "playlists-growth", name: "Playlists & Growth", words: w("playlist|spotify growth|streams|soundcloud") },
    { id: "booking-management", name: "Booking & Management", words: w("booking|touring|talent agency|management|wasserman|caa\\b|wme\\b") },
    { id: "publishing-rights", name: "Publishing & Rights", words: w("publishing|royalt|sample clearance|licens|copyright|ascap|bmi\\b|sync licens") },
  ]},
  { id: "writing-content", name: "Writing & Content", blurb: "Copy, assistants and long-form.", subs: [
    { id: "copywriting", name: "Copywriting", words: w("copywrit|ad copy|marketing copy") },
    { id: "writing-assistants", name: "Writing Assistants", words: w("writing|grammar|rewrite|paraphras|writer") },
    { id: "long-form-content", name: "Long-form Content", words: w("blog|article|long[- ]form|newsletter|substack|content creation") },
  ]},
  { id: "research-knowledge", name: "Research & Knowledge", blurb: "Search, notes and research.", subs: [
    { id: "ai-search", name: "AI Search", words: w("search engine|ai search|answer engine|perplexity|find any") },
    { id: "knowledge-management", name: "Knowledge Management", words: w("notes?\\b|knowledge|second brain|bookmark|wiki|read later|save and organi") },
    { id: "research-tools", name: "Research Tools", words: w("research|papers?|academic|citation|geolocat|osint|reviews and ratings") },
  ]},
  { id: "productivity-automation", name: "Productivity & Automation", blurb: "Automations, meetings, mail and projects.", subs: [
    { id: "automation", name: "Automation", words: w("automat|workflow|zapier|n8n|make\\.com|integration") },
    { id: "meeting-ai", name: "Meeting AI", words: w("meeting|transcri|calendar|booking page|schedul") },
    { id: "email-communication", name: "Email & Communication", words: w("email|inbox|mail\\b|messag") },
    { id: "project-management", name: "Project Management", words: w("project management|tasks?\\b|kanban|roadmap|spreadsheet|docs\\b") },
  ]},
  { id: "business-marketing", name: "Business & Marketing", blurb: "Marketing, sales, social, SEO and commerce.", subs: [
    { id: "marketing-ai", name: "Marketing AI", words: w("marketing|ads?\\b|campaign|brand|influencer|creator economy") },
    { id: "analytics", name: "Analytics", words: w("analytics|metrics|traffic|insights") },
    { id: "sales-ai", name: "Sales AI", words: w("sales|crm|lead gen|outreach|prospect") },
    { id: "seo-tools", name: "SEO Tools", words: w("seo|keyword|backlink|serp") },
    { id: "ecommerce-platforms", name: "Ecommerce Platforms", words: w("ecommerce|e-commerce|shopify|store builder|product photo|dropship") },
    { id: "social-media-management", name: "Social Media Management", words: w("social media|scheduling|twitter|tiktok|instagram|engagement|bot platform") },
    { id: "email-marketing-automation", name: "Email & Marketing Automation", words: w("email marketing|klaviyo|mailchimp|drip") },
    { id: "customer-support", name: "Customer Support", words: w("customer support|helpdesk|support chat") },
    { id: "agencies-studios", name: "Agencies & Studios", words: w("agency|studio|branding agency|creative agency") },
  ]},
  { id: "no-code-builders", name: "No-Code & Builders", blurb: "Sites, apps and workflows without code.", subs: [
    { id: "website-builders", name: "Website Builders", words: w("website builder|build websites?|webflow|framer|wix|wordpress|landing page|no[- ]code website") },
    { id: "app-builders", name: "App Builders", words: w("no[- ]code app|app maker|internal tools") },
    { id: "workflow-tools", name: "Workflow Tools", words: w("visual builder|flow builder|node[- ]based|flowise") },
  ]},
  { id: "dev-infrastructure", name: "Dev & Infrastructure", blurb: "Hosting, domains, databases and the free stack.", subs: [
    { id: "hosting-deploy", name: "Hosting & Deploy", words: w("hosting|deploy|vercel|netlify|hostinger|server|cloud platform|vps") },
    { id: "domains", name: "Domains", words: w("domains?|registrar|namecheap|godaddy|dns") },
    { id: "databases-backend", name: "Databases & Backend", words: w("database|postgres|supabase|firebase|backend|auth\\b") },
    { id: "free-for-devs", name: "Free for Devs", words: w("free[- ]for[- ]dev|free tier|free services") },
  ]},
  { id: "data-analytics", name: "Data & Analytics", blurb: "Analysis and data tooling.", subs: [
    { id: "data-analysis", name: "Data Analysis", words: w("data analys|dashboard|visuali[sz]") },
    { id: "data-tools", name: "Data Tools", words: w("dataset|scrap|etl|csv|data tool") },
  ]},
  { id: "finance-trading", name: "Finance & Trading", blurb: "Fintech, money and capital.", subs: [
    { id: "fintech-ai", name: "FinTech AI", words: w("fintech|trading|stocks|invest(?:ing|ment) app|portfolio track") },
    { id: "personal-finance", name: "Personal Finance", words: w("budget|personal finance|banking|bank\\b|financing|loans?\\b|credit (?:card|score|line|repair)") },
    { id: "venture-capital", name: "Venture & Capital", words: w("venture|capital\\b|vc\\b|investors?|fund(?:ing|raise)|angel invest") },
  ]},
  { id: "blockchain-web3", name: "Blockchain & Web3", blurb: "On-chain tools, analytics and DEXs.", subs: [
    { id: "web3-ai", name: "Web3 AI", words: w("web3|blockchain|crypto|token|nft|solana|ethereum|wallet") },
    { id: "on-chain-analytics", name: "On-chain Analytics", words: w("on[- ]chain|holders|bubblemaps|crypto twitter|tweetscout|twitterscore|whale") },
    { id: "trading-dex", name: "Trading & DEX", words: w("dex\\b|swap|trade (?:solana|tokens)|memecoin|gmgn|launchpad|mint") },
  ]},
  { id: "education-learning", name: "Education & Learning", blurb: "Courses and tutors.", subs: [
    { id: "learning-platforms", name: "Learning Platforms", words: w("course|learn|tutorial|academy|class") },
    { id: "ai-tutoring", name: "AI Tutoring", words: w("tutor|homework|study") },
  ]},
  { id: "healthcare-wellness", name: "Healthcare & Wellness", blurb: "Health, focus and mind.", subs: [
    { id: "mental-health", name: "Mental Health", words: w("mental|meditat|focus music|brain\\.fm|sleep|calm") },
    { id: "health-tools", name: "Health Tools", words: w("health|fitness|medical|nutrition") },
  ]},
  { id: "3d-gaming", name: "3D & Gaming", blurb: "3D generation and game dev.", subs: [
    { id: "3d-generation", name: "3D Generation", words: w("3d|mesh|normal map|pbr|texture generat|gaussian|nerf") },
    { id: "game-development", name: "Game Development", words: w("game dev|game engine|sprite|unity|unreal|godot|itch\\.io|strategy game|\\bgame\\b") },
  ]},
  { id: "security-privacy", name: "Security & Privacy", blurb: "Privacy, security and storage you control.", subs: [
    { id: "security-tools", name: "Security Tools", words: w("security|privacy|encrypt|vpn|password|private ai|metadata clean") },
    { id: "storage-cloud", name: "Storage & Cloud", words: w("cloud storage|storage|backup|file shar|content governance|drive\\b") },
  ]},
  { id: "utilities", name: "Utilities", blurb: "Converters, file tools and everyday helpers.", subs: [
    { id: "file-converters", name: "File Converters", words: w("convert|converter|pdf|compress|resize|to mp3|download") },
    { id: "everyday-tools", name: "Everyday Tools", words: w("color picker|palette|generator|calculator|checker|availability|name search|utility|tools? for") },
  ]},
  { id: "creative-fun", name: "Creative & Fun", blurb: "Experiments, toys and creative play.", subs: [
    { id: "creative-tools", name: "Creative Tools", words: w("creative|playground|draw|doodle|interactive") },
    { id: "ai-experiments", name: "AI Experiments", words: w("experiment|labs?\\b|withgoogle|toy|fun\\b|meme") },
  ]},
  { id: "entertainment-media", name: "Entertainment & Media", blurb: "Streaming, culture and media.", subs: [
    { id: "streaming", name: "Streaming", words: w("stream(?:ing)?|movies|tv shows|watch") },
    { id: "culture-media", name: "Culture & Media", words: w("magazine|culture|news|media|tickets?") },
  ]},
  { id: "fashion-style", name: "Fashion & Style", blurb: "Labels, streetwear and marketplaces.", subs: [
    { id: "streetwear", name: "Streetwear", words: w("streetwear|graphic tees|hoodie") },
    { id: "designer-brands", name: "Designer Brands", words: w("designer brand|luxury|jewel|couture|fashion house|alt[- ]fashion|clothing|apparel") },
    { id: "fashion-marketplaces", name: "Fashion Marketplaces", words: w("marketplace|resale|grailed|ssense|farfetch") },
  ]},
];

/** Branch kinds — what a link IS (independent of its branch). */
export const KINDS = [
  { id: "website", name: "Website" },
  { id: "tool", name: "Tool" },
  { id: "ios", name: "iOS app" },
  { id: "android", name: "Android app" },
  { id: "extension", name: "Extension" },
  { id: "widget", name: "Widget" },
  { id: "desktop", name: "Desktop app" },
  { id: "resource", name: "Resource" },
  { id: "inspiration", name: "Inspiration" },
];

/** 11:11 chart series, in order: adjacent pairs validated for colour-blind separation. Branches cycle through them. */
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#2f9e44", "#9085e9", "#e66767"];
export const branchColor = (branchId) => {
  const i = BRANCHES.findIndex((b) => b.id === branchId);
  return i < 0 ? "#9c9c9a" : SERIES[i % SERIES.length];
};

export const findBranch = (id) => BRANCHES.find((b) => b.id === id) || null;
export const findSub = (branchId, subId) => findBranch(branchId)?.subs.find((s) => s.id === subId) || null;

// ---------- slugs ----------

export const RESERVED = new Set([
  "_next", "api", "favicon.ico", "icon", "apple-icon", "manifest.json", "opengraph-image", "robots.txt", "sitemap.xml",
  "category", "branch", "kind", "submit", "portal", "admin", "about", "privacy", "terms", "search", "library", "index", "",
]);

export function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_/.]/g, "")
    .replace(/[\s_/.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** A unique, stable slug for an entry. `taken` is a Set of slugs already used. */
export function uniqueSlug(base, taken) {
  let s = slugify(base) || "site";
  if (RESERVED.has(s)) s = `${s}-site`;
  let out = s;
  for (let n = 2; taken.has(out); n++) out = `${s}-${n}`;
  taken.add(out);
  return out;
}

// ---------- URLs ----------

const TRACKING = /^(utm_|fbclid|gclid|gad_|gadid|gbraid|wbraid|hsa_|srsltid|ir[a-z]*id$|irgwc|irmpname|ref$|referrer$|ref_src|mc_|tw_|cta$|__clerk|_hs|igsh|si$|source$)/i;

/** Clean a URL for storage: https, no tracking params, no fragments, no trailing slash noise. */
export function cleanUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return "";
    u.protocol = "https:";
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k) || /^(g_|loggedin|tab$|back|social)/i.test(k)) u.searchParams.delete(k);
    if (u.search.length > 60) u.search = "";
    if (/\/(sign-?up|sign-?in|login|register|thank-you)(\/|$)/i.test(u.pathname)) { u.pathname = "/"; u.search = ""; }
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return "";
  }
}

/** Identity key for de-duplication: host without www + path without trailing slash (+ query for app stores). */
export function urlKey(raw) {
  try {
    const u = new URL(cleanUrl(raw));
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    const keepQuery = /(apps\.apple|play\.google|chromewebstore|addons\.mozilla)/.test(host) ? u.search : "";
    return `${host}${path}${keepQuery}`;
  } catch {
    return String(raw || "").toLowerCase();
  }
}

export function hostOf(raw) {
  try {
    return new URL(cleanUrl(raw)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** What a link is, from the URL alone. */
export function detectKind(url, text = "") {
  const h = hostOf(url);
  const t = `${url} ${text}`.toLowerCase();
  if (h === "apps.apple.com" || h === "itunes.apple.com") return /mac app|macos/.test(t) ? "desktop" : "ios";
  if (h === "play.google.com") return "android";
  if (h.endsWith("chromewebstore.google.com") || h === "chrome.google.com" || h === "addons.mozilla.org" || h === "microsoftedge.microsoft.com") return "extension";
  if (/\bwidgets?\b/.test(t)) return "widget";
  if (/\b(download for (mac|windows)|desktop app|menu ?bar app)\b/.test(t)) return "desktop";
  if (/\b(inspiration|showcase|gallery|portfolio)\b/.test(t)) return "inspiration";
  if (/\b(templates?|mockups?|icons|fonts|samples?|wallpapers?|guide|directory|job board|reviews)\b/.test(t)) return "resource";
  if (/\b(ai|generat|editor|convert|builder|maker|platform|app\b|tool)/.test(t)) return "tool";
  return "website";
}

/**
 * The classifier: no model, no API. Scores every sub-branch's vocabulary against the
 * name, host, description and any hint (a bookmark folder, a legacy category) and returns
 * the best branch + sub with a 0–1 confidence. Ties break toward the earlier branch.
 */
export function classify({ name = "", url = "", description = "", hint = "" }) {
  const host = hostOf(url);
  const text = `${name} ${host.replace(/\./g, " ")} ${host} ${description} ${hint}`;
  let best = null;
  for (const b of BRANCHES) {
    for (const s of b.subs) {
      const m = text.match(new RegExp(s.words.source, "gi"));
      if (!m) continue;
      const score = m.length + (new RegExp(s.words.source, "i").test(name) ? 1.5 : 0);
      if (!best || score > best.score) best = { branch: b.id, sub: s.id, score };
    }
  }
  if (!best) return { branch: "", sub: "", confidence: 0 };
  return { branch: best.branch, sub: best.sub, confidence: Math.min(1, best.score / 4) };
}

/** Light tag suggestions from vocabulary — used for search and related links. */
export function suggestTags({ name = "", description = "", url = "" }) {
  const t = `${name} ${description} ${url}`.toLowerCase();
  const tags = [];
  if (/\bai\b|artificial intelligence|gpt|llm|generat/.test(t)) tags.push("AI");
  if (/open[- ]source|github\.com/.test(t)) tags.push("Open Source");
  if (/\bfree\b|no sign[- ]?up|no account|no login/.test(t)) tags.push("Free");
  if (/in[- ]browser|browser[- ]based|client[- ]side|local only|nothing is uploaded/.test(t)) tags.push("Runs Locally");
  if (/design|ui\b|brand/.test(t)) tags.push("Design");
  if (/music|audio|sound/.test(t)) tags.push("Music");
  return tags;
}

/** A readable name from a page title: drop " | Brand", " - tagline" and the like, keep it short. */
export function tidyName(title, url) {
  let t = String(title || "").replace(/\s+/g, " ").trim();
  if (!t || /^untitled/i.test(t)) {
    const app = String(url).match(/\/app\/([^/]+)\/id\d/) || String(url).match(/[?&]id=[\w.]*\.(\w+)/) || String(url).match(/\/detail\/([^/]+)\//);
    if (app) return app[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 48);
    const h = hostOf(url).split(".")[0] || "";
    return h ? h[0].toUpperCase() + h.slice(1) : "Untitled";
  }
  const parts = t.split(/\s+[|·•—–-]\s+|:\s+/);
  const host = hostOf(url).split(".")[0];
  const named = parts.find((p) => host && p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(host.replace(/[^a-z0-9]/g, "")));
  t = named || parts[0];
  return t.length > 48 ? `${t.slice(0, 46).trim()}…` : t;
}
