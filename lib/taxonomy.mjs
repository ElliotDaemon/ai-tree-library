// AI Tree Library — taxonomy, URL normalisation and the zero-cost classifier.
// Plain ESM so build scripts (node) and the app (TS, allowJs) share one source.
// Adding a branch or sub-branch here is all it takes: colours, layout and routes derive from it.

/** @typedef {{ id: string, name: string, words: RegExp }} Sub */
/** @typedef {{ id: string, name: string, blurb: string, subs: Sub[] }} Branch */

const w = (s) => new RegExp(`\\b(?:${s})`, "i");

/** @type {Branch[]} */
export const BRANCHES = [
  { id: "ai-assistants-agents", name: "AI Assistants & Agents", blurb: "Chatbots, agents, models and the assistants that live in your browser.", subs: [
    { id: "ai-chatbots", name: "AI Chatbots", words: w("chatbot|chat ?gpt|claude|gemini|grok|deepseek|le chat|kimi|ai assistant|perplexity|poe\\b") },
    { id: "ai-agents", name: "AI Agents", words: w("agents?\\b|agentic|autonomous|manus|operator|deepagent|multi-step|ai employees") },
    { id: "models-apis", name: "Models & APIs", words: w("open[- ]weight|frontier (ai|model)|model api|ai studio|openrouter|inference|llm api|xai\\b|foundation model") },
    { id: "companions", name: "Companions & Characters", words: w("companion|character chat|ai friend|roleplay|personal ai") },
    { id: "browser-assistants", name: "Browser & Desktop Assistants", words: w("sidebar|browser assistant|chrome extension|menu ?bar|mac app|dictation|memory plugin|every app") },
    { id: "voice-assistants", name: "Voice Assistants", words: w("voice assistant|siri|alexa|google assistant|voice agent") },
  ]},
  { id: "code-development", name: "Code & Development", blurb: "Editors, copilots, app builders and the tools developers live in.", subs: [
    { id: "ai-code-editors", name: "AI Code Editors", words: w("code editor|\\bide\\b|cursor|windsurf|zed\\b|vs ?code") },
    { id: "ai-app-builders", name: "AI App Builders", words: w("app builder|build (?:an? )?(?:full[- ]stack )?apps?|mobile apps? using ai|lovable|bolt\\b|v0\\b|rork|deepsite|vibe[- ]?cod|prompt to app") },
    { id: "coding-assistants", name: "Coding Assistants", words: w("coding (assistant|agent)|copilot|code review|code completion|pair programm|software engineer") },
    { id: "ui-components", name: "UI Components & Design-to-Code", words: w("ui components?|component library|design to code|tailwind|shadcn|react components") },
    { id: "testing-qa", name: "Testing & QA", words: w("testing|test generation|\\bqa\\b|code integrity|unit tests") },
    { id: "scraping-data", name: "Scraping & Data APIs", words: w("scrap|crawl|web data|data extraction|blockchain data api|graphql api") },
    { id: "dev-tools-apis", name: "Dev Tools & APIs", words: w("\\bapi\\b|sdk|developer|devtool|internal tools|headless|cms\\b|open[- ]source library") },
  ]},
  { id: "design", name: "Design", blurb: "Interfaces, brands, type, colour, motion and the inspiration behind them.", subs: [
    { id: "ui-ux-design", name: "UI & Product Design", words: w("ui design|ux|user interface|product design|figma|wireframe|prototype|app design|designer for ui|interface") },
    { id: "graphic-brand", name: "Graphic & Brand Design", words: w("graphic design|brand(ing)?\\b|logo|poster|flyer|social graphics|canva|adobe express|kittl|t-?shirt design|visual identity") },
    { id: "presentations", name: "Presentations & Diagrams", words: w("presentation|slides?\\b|slide ?deck|pitch deck|decks?\\b|diagram|infographic|visuali[sz]e (ideas|text)") },
    { id: "typography", name: "Typography & Fonts", words: w("fonts?\\b|typeface|typography|font pairing") },
    { id: "icons-illustration", name: "Icons & Illustration", words: w("icons?\\b|illustrations?|vector graphics|emoji|stickers") },
    { id: "mockups-templates", name: "Mockups & Templates", words: w("mockups?|templates?|psd|design assets|ui kits?|graphic resources") },
    { id: "color", name: "Colour & Gradients", words: w("colou?r|palette|gradient|swatch|contrast") },
    { id: "motion-interactive", name: "Motion & Interactive", words: w("interactive|webgl|motion design|animated website|3d web|scroll animation|shader|liquid glass|slider") },
    { id: "design-inspiration", name: "Design Inspiration", words: w("inspiration|showcase|gallery|awwwards|designer community|curated|pinterest|laws of ux|moodboard|screenshots from real apps") },
    { id: "design-utilities", name: "Design Utilities", words: w("favicon|qr ?code|banner maker|image resizer|svg|design tools? for") },
    { id: "architecture-interior", name: "Architecture & Interior", words: w("architect|interior|floor ?plan|building design") },
    { id: "design-studios", name: "Studios & Agencies", words: w("design studio|creative studio|digital agency|branding agency|logo design service|creative agency") },
  ]},
  { id: "image-art", name: "Image & Photo", blurb: "Generate, edit, restore and source images.", subs: [
    { id: "image-generation", name: "Image Generation", words: w("image generat|text[- ]to[- ]image|midjourney|stable diffusion|flux|dall[- ]?e|ai art|art generator") },
    { id: "image-editing", name: "Image Editing", words: w("inpaint|object remov|generative fill|edit images?|image editor|retouch") },
    { id: "upscaling", name: "Upscaling & Restoration", words: w("upscal|enlarg|enhanc|restor|sharpen|super[- ]resolution|old photos") },
    { id: "product-photos", name: "Background & Product Photos", words: w("background remov|remove background|product photo|ecommerce images|packshot|cut ?out") },
    { id: "photo-editing", name: "Photo Editing", words: w("photo edit|lightroom|photo filter|exif|raw photo") },
    { id: "stock-assets", name: "Stock Photos & Wallpapers", words: w("stock|free photos|wallpapers?|royalty[- ]free images") },
  ]},
  { id: "video-animation", name: "Video & Animation", blurb: "Generate, edit, clip and animate.", subs: [
    { id: "video-generation", name: "Video Generation", words: w("video generat|text[- ]to[- ]video|image[- ]to[- ]video|ai video|generative video|video model") },
    { id: "video-editing", name: "Video Editing", words: w("video edit|editor for video|subtitles|captions|edit videos?") },
    { id: "short-form", name: "Short-form & Clipping", words: w("short[- ]form|clips?\\b|reels|tiktok videos|repurpos|viral") },
    { id: "motion-vfx", name: "Motion Graphics & VFX", words: w("after effects|motion graphics|vfx|plugins? for (premiere|after)|video templates|programmatic video|render") },
    { id: "film-storytelling", name: "Film & Storytelling", words: w("storyboard|film(making)?|tv shows|movies? (with|using) ai|screenplay|story to video") },
    { id: "ai-avatars", name: "AI Avatars & Presenters", words: w("avatar|talking head|digital human|presenter|lip ?sync|spokesperson") },
    { id: "trend-video", name: "Trend & Meme Video", words: w("meme|trend|party (clip|meme)|portrait[- ]to[- ]video|one (photo|portrait)|love story|freestyle") },
  ]},
  { id: "audio-music", name: "Audio & Music", blurb: "Make, produce, mix and shape sound.", subs: [
    { id: "music-generation", name: "Music Generation", words: w("music generat|ai music|song generat|suno|udio|text[- ]to[- ]music|royalty[- ]free music generator|compose music with ai") },
    { id: "daws-production", name: "DAWs & Production", words: w("\\bdaw\\b|music production software|beat ?maker|in[- ]browser studio|record(ing)? studio software|bandlab") },
    { id: "mixing-mastering", name: "Mixing & Mastering", words: w("mixing|mastering|loudness|\\beq\\b") },
    { id: "plugins-instruments", name: "Plugins & Instruments", words: w("plugins?|vst|\\bau\\b|aax|synth|instrument|kontakt|reverb plugin") },
    { id: "sound-design-samples", name: "Samples & Sound Design", words: w("samples?\\b|sample packs?|loops?\\b|sound design|presets|sound effects|sfx|drum kits?") },
    { id: "composition-midi", name: "Composition & MIDI", words: w("midi|chord|composition|melody|piano|notation") },
    { id: "drums-beats", name: "Drums & Beats", words: w("drum|beats?\\b") },
    { id: "vocal-processing", name: "Vocals & Voice Synthesis", words: w("vocal|autotune|pitch correct|singing synth|vocaloid") },
    { id: "stem-separation", name: "Stem Separation", words: w("stems?\\b|vocal remov|isolat|separat") },
    { id: "voice-speech", name: "Voice & Speech", words: w("text[- ]to[- ]speech|tts\\b|voice clon|speech|elevenlabs|narrat|transcrib|dictat") },
    { id: "audio-enhancement", name: "Audio Enhancement", words: w("noise|denois|audio enhanc|podcast|clean ?voice|room tone") },
    { id: "lyrics-songwriting", name: "Lyrics & Songwriting", words: w("lyric|songwrit|rhyme") },
  ]},
  { id: "music-business", name: "Music Business", blurb: "Release, promote, protect and grow a music career.", subs: [
    { id: "distribution", name: "Distribution", words: w("distribut|distrokid|tunecore|cd ?baby|amuse|ditto|release your music|too lost|symphonic") },
    { id: "music-marketing", name: "Marketing & Fan Growth", words: w("music marketing|fan(s| growth| links)|smart links?|pre-?save|feature\\.fm|grow your (fan|audience)|campaign for artists") },
    { id: "playlists-growth", name: "Playlists & Streaming Growth", words: w("playlist|spotify growth|streams|soundcloud promo|curators") },
    { id: "pr-promotion", name: "PR & Press", words: w("music pr|public relations|\\bpr\\b|publicity|press|exposure|promotion agency") },
    { id: "artist-platforms", name: "Artist Platforms", words: w("for artists|artist (home|profile|hub|dashboard)|spotify for artists|youtube for artists|bandzoogle|link in bio") },
    { id: "industry-data", name: "Industry Data & Charts", words: w("charts?\\b|music analytics|market intelligence|credits|streaming data|chartmetric|soundcharts|muso") },
    { id: "booking-management", name: "Booking & Management", words: w("booking|touring|talent agency|artist management|wasserman|united talent|roster") },
    { id: "publishing-rights", name: "Rights, Royalties & Codes", words: w("publishing|royalt|sample clearance|licens|copyright|isrc|ascap|bmi\\b|soundexchange|mechanical|riaa|ifpi|rights management") },
    { id: "labels", name: "Labels & Collectives", words: w("record label|music group|label services|independent label|collective") },
    { id: "music-services", name: "Session Musicians & Services", words: w("session musicians?|hire (vetted )?producers|mixing engineers|freelance musicians|musicians for hire") },
    { id: "music-guides", name: "Guides & Directories", words: w("top \\d+|best .* (agencies|companies|services)|guide to|how to promote|\\d+ (best|top)") },
  ]},
  { id: "writing-content", name: "Writing & Content", blurb: "Write, translate, check and publish.", subs: [
    { id: "copywriting", name: "Copywriting", words: w("copywrit|ad copy|marketing copy|product descriptions") },
    { id: "writing-assistants", name: "Writing Assistants", words: w("writing assistant|grammar|rewrite|paraphras|style checker|proofread") },
    { id: "long-form-content", name: "Long-form & Fiction", words: w("long[- ]form|novel|fiction|story ?writing|book") },
    { id: "translation", name: "Translation", words: w("translat|localis|localiz|languages") },
    { id: "ai-detection", name: "AI Detection & Humanising", words: w("ai detect|undetectable|humani[sz]|plagiarism|originality") },
    { id: "blogs-publications", name: "Blogs & Publications", words: w("blog|newsletter|substack|magazine|publication|medium\\b") },
  ]},
  { id: "research-knowledge", name: "Research & Knowledge", blurb: "Search, read, remember and find more tools.", subs: [
    { id: "ai-search", name: "AI Search", words: w("search engine|ai search|answer engine|perplexity|ask anything") },
    { id: "research-tools", name: "Research & Academic", words: w("research|papers?|academic|citation|scientific|literature|geolocat|osint") },
    { id: "knowledge-management", name: "Notes & Knowledge", words: w("notes?\\b|knowledge|second brain|bookmark|wiki|read later|save and organi|chat with (your )?(pdf|docs)") },
    { id: "tool-directories", name: "Tool Directories", words: w("directory|discover (and compare )?(ai )?tools|tools list|find the (exact|best) ai|curated list of tools") },
  ]},
  { id: "productivity-automation", name: "Productivity & Automation", blurb: "Automate work, run meetings, manage projects.", subs: [
    { id: "automation", name: "Automation", words: w("automat|workflow|zapier|n8n|make\\.com|integrations?") },
    { id: "meeting-ai", name: "Meeting AI", words: w("meeting|note ?taker|transcri|call recorder") },
    { id: "calendar-scheduling", name: "Calendar & Scheduling", words: w("calendar|schedul|booking page|time blocking|meeting topics") },
    { id: "email-communication", name: "Email & Communication", words: w("email|inbox|mail\\b|messag|team chat|slack") },
    { id: "project-management", name: "Project Management", words: w("project management|tasks?\\b|kanban|roadmap|work ?os") },
    { id: "docs-whiteboards", name: "Docs, Sheets & Whiteboards", words: w("whiteboard|spreadsheet|docs?\\b|documentation|wiki|sop|step-by-step guides") },
    { id: "forms-surveys", name: "Forms & Surveys", words: w("forms?\\b|surveys?|questionnaire") },
    { id: "careers-jobs", name: "Careers & Jobs", words: w("job (board|search|tracker)|resume|career|hiring|recruit") },
  ]},
  { id: "business-marketing", name: "Business & Marketing", blurb: "Market, sell, support and run a company.", subs: [
    { id: "marketing-ai", name: "Marketing", words: w("marketing|ads?\\b|campaign|conversion|popups?|lead capture") },
    { id: "influencer-marketing", name: "Influencer & Creator Marketing", words: w("influencer|creator (marketing|economy|partnerships)|ugc|brand deals") },
    { id: "social-media-management", name: "Social Media Management", words: w("social media|scheduling posts|twitter|tiktok|instagram|engagement|bot platform|threads") },
    { id: "seo-tools", name: "SEO", words: w("seo|keyword|backlink|serp|rank tracker") },
    { id: "email-marketing-automation", name: "Email & Lifecycle", words: w("email marketing|klaviyo|mailchimp|drip|lifecycle|newsletters? platform") },
    { id: "analytics", name: "Product & Web Analytics", words: w("analytics|heatmaps?|session replay|traffic|insights|a/b test") },
    { id: "sales-ai", name: "Sales", words: w("sales|crm|lead gen|outreach|prospect|revenue") },
    { id: "customer-support", name: "Customer Support", words: w("customer support|help ?desk|support chat|live chat|ticketing") },
    { id: "ecommerce-platforms", name: "Ecommerce", words: w("ecommerce|e-commerce|shopify|store builder|online store|shipping|inventory|loyalty|referral") },
    { id: "legal-contracts", name: "Legal & Contracts", words: w("legal|lawyers?|contracts?|e-?sign|signature|attorney") },
    { id: "agencies-studios", name: "Agencies", words: w("agency|agencies|consultancy") },
    { id: "agency-directories", name: "Agency Directories", words: w("find (the )?(best )?agenc|agency directory|b2b (ratings|reviews)|clutch|designrush") },
  ]},
  { id: "no-code-builders", name: "No-Code & Builders", blurb: "Sites, apps and internal tools without code.", subs: [
    { id: "website-builders", name: "Website Builders", words: w("website builder|build websites?|webflow|framer|wix|wordpress|landing page|no[- ]code website") },
    { id: "app-builders", name: "App Builders", words: w("no[- ]code app|app maker|internal tools|mobile app builder") },
    { id: "workflow-tools", name: "Databases & Workflows", words: w("visual builder|flow builder|node[- ]based|flowise|database|airtable|coda") },
  ]},
  { id: "dev-infrastructure", name: "Dev & Infrastructure", blurb: "Hosting, domains, databases and the free stack.", subs: [
    { id: "hosting-deploy", name: "Hosting & Deploy", words: w("hosting|deploy|vercel|netlify|hostinger|server|cloud platform|vps") },
    { id: "domains", name: "Domains", words: w("domains?|registrar|namecheap|godaddy|dns|name availability") },
    { id: "databases-backend", name: "Databases & Backend", words: w("database|postgres|supabase|firebase|backend|auth\\b|cms") },
    { id: "free-for-devs", name: "Free for Devs", words: w("free[- ]for[- ]dev|free tier|free services") },
  ]},
  { id: "data-analytics", name: "Data & Analytics", blurb: "Analyse, query and visualise data.", subs: [
    { id: "data-analysis", name: "AI Data Analysis", words: w("data analys|analy[sz]e (your )?data|ai data|spreadsheet ai") },
    { id: "bi-dashboards", name: "BI & Dashboards", words: w("business intelligence|\\bbi\\b|dashboards?|tableau|looker|power bi") },
    { id: "data-tools", name: "Notebooks & Data Tools", words: w("notebook|dataset|etl|csv|sql|data tool") },
  ]},
  { id: "finance-trading", name: "Finance & Money", blurb: "Payments, banking, investing and capital.", subs: [
    { id: "payments-banking", name: "Payments & Banking", words: w("payments?|banking|bank\\b|checkout|point of sale|invoice") },
    { id: "personal-finance", name: "Personal Finance", words: w("budget|personal finance|money app|spending") },
    { id: "fintech-ai", name: "Investing & Trading", words: w("trading|stocks|invest(ing|ment) app|portfolio track|brokerage|market data") },
    { id: "venture-capital", name: "Venture & Funding", words: w("venture|capital\\b|\\bvc\\b|investors?|fund(ing|raise)|angel invest|financing|credit (card|score|line|repair)|loans?\\b") },
  ]},
  { id: "blockchain-web3", name: "Crypto & Web3", blurb: "Trade, track and build on-chain.", subs: [
    { id: "trading-dex", name: "Exchanges & DEXs", words: w("dex\\b|swap|exchange|trade (solana|tokens)|memecoin|gmgn|launchpad|pump\\.fun|jupiter") },
    { id: "on-chain-analytics", name: "On-chain Data & Portfolios", words: w("on[- ]chain|holders|bubblemaps|crypto twitter|tweetscout|twitterscore|whale|portfolio tracker|coinmarketcap|screener|aggregat") },
    { id: "nfts", name: "NFTs & Marketplaces", words: w("nft|collectibles|opensea|magic eden") },
    { id: "web3-ai", name: "Web3 & AI", words: w("web3|blockchain|crypto|token|solana|ethereum|wallet|whitepaper|smart contract") },
  ]},
  { id: "education-learning", name: "Education & Learning", blurb: "Courses, tutors and tools for teaching.", subs: [
    { id: "learning-platforms", name: "Courses & Platforms", words: w("course|learn|tutorial|academy|class|masterclass") },
    { id: "ai-tutoring", name: "AI Tutors & Teaching Tools", words: w("tutor|homework|study|teachers?|teaching|classroom") },
    { id: "language-learning", name: "Languages", words: w("language learning|learn (a )?languages?|duolingo") },
  ]},
  { id: "healthcare-wellness", name: "Health & Wellbeing", blurb: "Mind, body and focus.", subs: [
    { id: "mental-health", name: "Mental Health", words: w("mental|therapy|cbt|mood|anxiety") },
    { id: "focus-sleep", name: "Focus, Sleep & Meditation", words: w("focus|sleep|meditat|brain\\.fm|calm|mindful") },
    { id: "health-tools", name: "Health Tools", words: w("health|fitness|medical|symptom|nutrition") },
  ]},
  { id: "3d-gaming", name: "Games & 3D", blurb: "Build games, make 3D, and play.", subs: [
    { id: "3d-generation", name: "3D Generation & Modeling", words: w("3d (model|generat|asset|mesh)|mesh|text[- ]to[- ]3d|image[- ]to[- ]3d|gaussian|nerf|spline") },
    { id: "game-development", name: "Game Engines & Builders", words: w("game (engine|builder|maker|dev)|make (a )?games?|unity|unreal|godot|rosebud|build games") },
    { id: "game-assets", name: "Game Assets & Worlds", words: w("game assets?|sprites?|sprite sheet|textures?|normal maps?|pbr|skybox|battle ?maps?|tilesets?|level design|world ?build") },
    { id: "npc-ai", name: "Characters & NPC AI", words: w("npc|game characters?|character engine|interactive characters") },
    { id: "mocap-animation", name: "Animation & Motion Capture", words: w("motion capture|mocap|character animation|rigging|animate 3d") },
    { id: "play", name: "Play", words: w("\\bgame\\b|games\\b|play (online|in your browser)|puzzle|strategy game|retro games|abandonware|geoguessr|itch\\.io") },
  ]},
  { id: "hardware-gear", name: "Hardware & Gear", blurb: "Reviews, studio gear and the machines we make things on.", subs: [
    { id: "reviews-buying", name: "Reviews & Buying Guides", words: w("reviews?|buying guide|best (tvs|monitors|laptops|headphones)|ratings") },
    { id: "studio-gear", name: "Studio & Audio Gear", words: w("microphones?|studio monitors?|headphones|audio interface|gear (used|of)|equipboard|synthesizers? hardware") },
    { id: "pc-hardware", name: "PC & Gaming Hardware", words: w("pc (requirements|build)|can (you|i) run|gpu|graphics card|system requirements|must-have pc programs") },
  ]},
  { id: "security-privacy", name: "Security & Privacy", blurb: "Stay private, stay safe, keep your files.", subs: [
    { id: "security-tools", name: "Security", words: w("security|threat|vulnerab|code scanning|cyber") },
    { id: "privacy-tools", name: "Privacy", words: w("privacy|private ai|metadata (clean|remov)|anonymous|tracker blocking|encrypted chat") },
    { id: "storage-cloud", name: "Storage & File Sharing", words: w("cloud storage|storage|backup|file shar|content governance|drive\\b|transfer files") },
  ]},
  { id: "utilities", name: "Utilities", blurb: "Converters, downloaders and everyday helpers.", subs: [
    { id: "file-converters", name: "File Converters", words: w("convert|converter|pdf|compress|resize") },
    { id: "downloaders", name: "Downloaders", words: w("download(er)?|to mp3|save videos?") },
    { id: "everyday-tools", name: "Everyday Tools", words: w("generator|calculator|checker|availability|name search|utility|tools? for|timer|password generator") },
  ]},
  { id: "creative-fun", name: "Creative & Fun", blurb: "Experiments, toys and creative play.", subs: [
    { id: "creative-tools", name: "Creative Playgrounds", words: w("creative|playground|draw|doodle|canvas|remix") },
    { id: "ai-experiments", name: "AI Experiments", words: w("experiment|labs?\\b|withgoogle|toy|fun\\b") },
  ]},
  { id: "entertainment-media", name: "Entertainment & Culture", blurb: "Media, talent, events and culture.", subs: [
    { id: "culture-media", name: "Press & Media", words: w("magazine|culture|news|media (company|outlet)|newsroom|press coverage") },
    { id: "talent-casting", name: "Talent & Casting", words: w("casting|actors?|acting|talent (agenc|management)|auditions") },
    { id: "events-venues", name: "Events, Venues & Tickets", words: w("events?\\b|venues?|tickets?|spaces? for (hire|rent)|location rental|festival") },
    { id: "film-tv", name: "Film & TV Industry", words: w("film industry|tv industry|distribution deals|production companies|entertainment industry") },
    { id: "streaming", name: "Streaming", words: w("stream(ing)?|movies|tv shows|watch") },
  ]},
  { id: "fashion-style", name: "Fashion & Style", blurb: "Labels, streetwear, jewellery and the fashion business.", subs: [
    { id: "streetwear", name: "Streetwear", words: w("streetwear|graphic tees|hoodie|skate") },
    { id: "designer-brands", name: "Designer & Alt Labels", words: w("designer brand|luxury|couture|fashion house|alt[- ]fashion|clothing|apparel|gothic") },
    { id: "jewelry-accessories", name: "Jewellery & Accessories", words: w("jewel|rings|chains|accessories|eyewear") },
    { id: "fashion-marketplaces", name: "Marketplaces & Resale", words: w("marketplace|resale|grailed|ssense|farfetch|stockx|goat\\b|etsy") },
    { id: "fashion-pr", name: "Fashion PR & Agencies", words: w("fashion (pr|marketing|agenc)|showroom|karla otto|purple pr") },
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
