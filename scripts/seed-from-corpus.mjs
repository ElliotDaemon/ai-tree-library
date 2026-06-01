// One-shot seed script — adds ~135 high-consensus tools to the Library DB
// from the editorial corpus research (see docs/article-corpus-synthesis.md).
//
// Idempotent: matches on URL, skips tools already in the library. For tools
// added by the earlier MCP batch with mis-assigned Category relations,
// PATCHES the Category to the correct subcategory.
//
// Usage:
//   NOTION_TOKEN=ntn_... npm run seed-corpus
//   (or trigger via .github/workflows/seed-tools.yml)

import { Client } from "@notionhq/client";

const LIBRARY_DS = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";
const CATEGORIES_DS = "0f31f74d-5899-4402-a863-5725927d96cd";

const token = process.env.NOTION_TOKEN;
if (!token) { console.error("[seed] NOTION_TOKEN missing"); process.exit(1); }
const notion = new Client({ auth: token });

// ---------- Step 1: fetch category map (name → id) ----------

console.log("[seed] Loading Categories...");
const catRows = [];
let cursor;
do {
  const res = await notion.databases.query({ database_id: CATEGORIES_DS, start_cursor: cursor, page_size: 100 });
  catRows.push(...res.results);
  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);

const catIdByName = new Map();
for (const r of catRows) {
  const name = (r.properties.Name?.title ?? []).map(t => t.plain_text).join("");
  if (name) catIdByName.set(name, r.id);
}
console.log(`[seed] ${catIdByName.size} categories loaded`);

function catId(name) {
  const id = catIdByName.get(name);
  if (!id) console.warn(`[seed] WARN: no category "${name}"`);
  return id;
}

// ---------- Step 2: fetch existing Library entries (by URL) ----------

console.log("[seed] Loading existing Library entries...");
const existing = new Map(); // url → { id, categoryRelationId }
cursor = undefined;
do {
  const res = await notion.databases.query({ database_id: LIBRARY_DS, start_cursor: cursor, page_size: 100 });
  for (const r of res.results) {
    const url = (r.properties.URL?.url ?? "").trim();
    const catRel = (r.properties.Category?.relation ?? [])[0]?.id ?? null;
    if (url) existing.set(normalizeUrl(url), { id: r.id, categoryRelationId: catRel });
  }
  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);
console.log(`[seed] ${existing.size} existing entries indexed by URL`);

function normalizeUrl(u) {
  try {
    const url = new URL(u.startsWith("http") ? u : `https://${u}`);
    return (url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "")).toLowerCase();
  } catch { return u.toLowerCase(); }
}

// ---------- Step 3: tools to seed ----------
// Format: [name, url, description, categoryName, type, pricing, rarity, featured, gem]

const tools = [
  // CODE / VIBE-CODING / APP BUILDERS
  ["Lovable", "https://lovable.dev", "Prompt-to-full-stack web app builder. Generates React + Supabase + Tailwind apps from natural language.", "AI App Builders", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Bolt.new", "https://bolt.new", "Browser-based instant app prototyper from StackBlitz. Spins up live full-stack apps in seconds.", "AI App Builders", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Replit", "https://replit.com", "Cloud IDE with AI Agent. Build, run, and ship apps entirely in the browser.", "AI App Builders", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Base44", "https://base44.com", "No-code AI app builder for non-technical founders. Generates full apps from a description.", "AI App Builders", "Tool", "Freemium", "⭐ Established", false, false],
  ["Devin", "https://devin.ai", "Autonomous AI software engineer from Cognition. Takes high-level tasks and drives them to completion.", "Coding Assistants", "Tool", "Subscription", "⭐ Established", false, false],
  ["Figma Make", "https://figma.com/make", "Figma's design-to-code prototype generator. Turns Figma frames into working code.", "AI App Builders", "Tool", "Subscription", "🌟 Hidden Gem", false, true],

  // CHAT / RESEARCH
  ["Paradigm AI", "https://paradigmai.com", "Spreadsheet + AI agents. Runs columns of agents in parallel to enrich and analyze data.", "Research Tools", "Tool", "Subscription", "💎 Rare", false, false],
  ["Humata", "https://humata.ai", "PDF and document Q&A with citations. Ask questions across long documents and get cited answers.", "Knowledge Management", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["Komo", "https://komo.ai", "Customizable AI research search. Build your own search agent tuned to specific topics.", "AI Search", "Tool", "Freemium", "🌟 Hidden Gem", false, true],

  // IMAGE
  ["Recraft", "https://recraft.ai", "AI image generator built for designers. Vector and SVG output, brand-consistent styles, true text rendering.", "Image Generation", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Ideogram", "https://ideogram.ai", "Best-in-class text-in-image generator. Reliably renders typography, logos, posters with accurate text.", "Image Generation", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Leonardo.ai", "https://leonardo.ai", "Feature-rich AI image platform with fine-tuned models, real-time canvas, and asset libraries.", "Image Generation", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Nano Banana", "https://gemini.google.com", "Google's Gemini image generation model. Strong prompt adherence and photorealism, integrated with Gemini chat.", "Image Generation", "Tool", "Freemium", "👑 Legendary", true, false],
  ["FLUX", "https://bfl.ai", "Pro-grade image model family from Black Forest Labs. Open-weights releases plus hosted API.", "Image Generation", "Tool", "Freemium", "⭐ Established", true, false],
  ["Krea", "https://krea.ai", "Real-time multi-modal AI canvas. Sketch, prompt, and iterate with image + video in one workspace.", "Image Generation", "Tool", "Freemium", "⭐ Established", true, false],
  ["Bing Image Creator", "https://bing.com/images/create", "Free DALL-E-powered image generator from Microsoft. Generous free tier, integrated with Bing search.", "Image Generation", "Tool", "Free", "⭐ Established", false, false],
  ["Freepik AI", "https://freepik.com", "Bundled multi-model AI image generator from the Freepik stock library. Tries multiple models in one subscription.", "Image Generation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Higgsfield", "https://higgsfield.ai", "Cinematic-style AI image and video generator. Strong on motion, lighting, and stylized aesthetics.", "Image Generation", "Tool", "Subscription", "⭐ Established", false, false],
  ["Magnific", "https://magnific.ai", "AI image upscaler with creative re-imagination. Enlarges and reinvents details rather than just sharpening.", "Photo Editing", "Tool", "Subscription", "💎 Rare", false, false],
  ["Reve", "https://preview.reve.art", "AI image model with exceptional prompt adherence. Follows complex instructions other models miss.", "Image Generation", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["Clipdrop", "https://clipdrop.co", "AI photo cleanup and enhancement suite from Stability AI. Background removal, relighting, upscaling.", "Photo Editing", "Tool", "Freemium", "⭐ Established", false, false],
  ["PhotoRoom", "https://photoroom.com", "AI background remover and ecommerce photo studio. Used by millions of indie sellers and brands.", "Photo Editing", "Tool", "Freemium", "⭐ Established", false, false],

  // VIDEO
  ["Google Veo", "https://labs.google/fx/tools/flow", "Google's high-fidelity AI video generator. Strong on cinematic motion and 4K output.", "Video Generation", "Tool", "Freemium", "⭐ Established", true, false],
  ["OpenAI Sora", "https://openai.com/sora", "OpenAI's narrative AI video generator. Longer-form coherence than most competitors.", "Video Generation", "Tool", "Subscription", "⭐ Established", false, false],
  ["OpusClip", "https://opus.pro", "AI long-to-short video clipper. Turns podcasts and webinars into viral social clips automatically.", "Video Editing", "Tool", "Freemium", "⭐ Established", false, false],
  ["Hailuo", "https://hailuoai.video", "MiniMax's AI video generator. Cheap and surprisingly high quality, popular for short-form content.", "Video Generation", "Tool", "Freemium", "💎 Rare", false, false],
  ["LTX Studio", "https://ltx.studio", "Shot-by-shot AI video storyboarding. Generate scenes, characters, and camera plans for filmmaking.", "Video Generation", "Tool", "Freemium", "💎 Rare", false, false],
  ["Kaiber", "https://kaiber.ai", "AI video generator with strong stylized output. Popular for music videos and animated content.", "Video Generation", "Tool", "Subscription", "💎 Rare", false, false],
  ["Pixverse", "https://pixverse.ai", "Short-form AI video platform optimized for social-network output.", "Video Generation", "Tool", "Freemium", "💎 Rare", false, false],
  ["Crayo", "https://crayo.ai", "AI short-form social video maker. Captions, scenes, and templates tuned for TikTok and Reels.", "Video Editing", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["LiveAvatar", "https://liveavatar.com", "Real-time interactive AI avatars. Speak through a photorealistic avatar for streaming or video calls.", "AI Avatars", "Tool", "Subscription", "🌟 Hidden Gem", false, true],

  // AUDIO
  ["Hume", "https://hume.ai", "Emotionally aware AI voice. Voice models that detect and express emotion, for interactive applications.", "Voice & Speech", "Tool", "Freemium", "🌟 Hidden Gem", false, true],

  // DESIGN
  ["Figma", "https://figma.com", "The standard for collaborative interface design. Real-time prototyping plus a growing AI plugin ecosystem.", "AI Design Tools", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Canva", "https://canva.com", "Templated design platform with deep AI integration. Magic Studio for image gen, design assistants, and brand kit.", "AI Design Tools", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Spline", "https://spline.design", "Browser-based 3D design tool. Build interactive 3D scenes with AI generation and physics.", "3D Generation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Framer", "https://framer.com", "Design-driven website builder. Visual editor with built-in publishing and rich AI assistance.", "Website Builders", "Tool", "Freemium", "⭐ Established", false, false],
  ["Mobbin", "https://mobbin.com", "UI screenshot research library. Browse real interfaces from thousands of mobile and web apps for inspiration.", "Design Inspiration", "Website", "Freemium", "⭐ Established", false, false],
  ["Laws of UX", "https://lawsofux.com", "UX heuristics reference. A free curated catalog of the laws and principles designers should know.", "Design Inspiration", "Website", "Free", "🌟 Hidden Gem", false, true],
  ["Streamline", "https://streamlinehq.com", "Massive icon and illustration system library. Consistent visual systems with thousands of unified assets.", "Stock Assets", "Resource", "Freemium", "⭐ Established", false, false],
  ["Unsplash", "https://unsplash.com", "Free high-quality stock photography. The standard for hero images on personal projects and prototypes.", "Stock Assets", "Resource", "Free", "👑 Legendary", true, false],
  ["Kittl", "https://kittl.com", "Vector design platform with AI. Browser-based illustrator alternative tuned for logos, t-shirts, and posters.", "AI Design Tools", "Tool", "Freemium", "⭐ Established", false, false],
  ["Fontjoy", "https://fontjoy.com", "AI font pairing tool. Generates harmonious typography combinations across hundreds of typefaces.", "Stock Assets", "Tool", "Free", "🌟 Hidden Gem", false, true],
  ["Grainient", "https://grainient.supply", "Animated gradient editor for designers. Generate seamless looping mesh gradients with grain.", "Stock Assets", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["Awwwards", "https://awwwards.com", "The premier web design awards site. Daily curated showcase of the most beautifully designed websites on the internet.", "Design Inspiration", "Inspiration", "Free", "👑 Legendary", true, false],
  ["Toools.design", "https://toools.design", "Massive curated directory of 2,200+ design resources, tools, and references. Searchable, filterable, free.", "Design Inspiration", "Resource", "Free", "⭐ Established", true, false],

  // 3D
  ["Luma AI", "https://lumalabs.ai", "AI 3D capture and modeling. NeRF-based reconstruction from phone footage; plus the Dream Machine video generator.", "3D Generation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Plask", "https://plask.ai", "AI motion capture from video. Extract character animation from any clip, no suit required.", "Game Development", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["Skybox by Blockade Labs", "https://skybox.blockadelabs.com", "AI-generated 360° skyboxes and environments. Drop your own backdrop into any 3D scene from a prompt.", "3D Generation", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["TRELLIS", "https://trellis3d.github.io", "Open-source image-to-3D model. Generate full 3D meshes from a single image, free and self-hostable.", "3D Generation", "Tool", "Free", "🌟 Hidden Gem", false, true],

  // PRODUCTIVITY
  ["Pitch", "https://pitch.com", "Modern collaborative presentation tool. Designed for teams, sleeker than Slides without enterprise lock-in.", "Automation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Plus AI", "https://plusdocs.com", "AI add-in for Google Slides and PowerPoint. Generate, edit, and refine presentations inside your existing tool.", "Automation", "Tool", "Freemium", "💎 Rare", false, false],
  ["SlidesAI", "https://slidesai.io", "Google Slides AI generator. Turn any text into a polished deck with one click.", "Automation", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["Asana", "https://asana.com", "Project and campaign management standard. Tasks, dependencies, and team workflows with growing AI features.", "Project Management", "Tool", "Freemium", "⭐ Established", true, false],
  ["ClickUp", "https://clickup.com", "All-in-one project management tool. Tasks, docs, goals, and time-tracking in one workspace.", "Project Management", "Tool", "Freemium", "⭐ Established", false, false],
  ["Monday.com", "https://monday.com", "Visual work OS. Spreadsheet-style project tracking with deep customization and automations.", "Project Management", "Tool", "Subscription", "⭐ Established", false, false],
  ["Slack", "https://slack.com", "Team messaging platform. The default for company chat, with bot, integration, and AI workflow ecosystem.", "Email & Communication", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Fireflies", "https://fireflies.ai", "AI meeting notes and intelligence. Records, transcribes, summarizes, and tracks action items across calls.", "Meeting AI", "Tool", "Freemium", "⭐ Established", false, false],
  ["Granola", "https://granola.ai", "AI meeting notes without the bot. Listens locally to your mac mic and writes structured notes.", "Meeting AI", "Tool", "Subscription", "⭐ Established", false, false],
  ["Reclaim", "https://reclaim.ai", "AI calendar and focus blocks. Auto-schedules tasks, habits, and meetings around your priorities.", "Automation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Motion", "https://usemotion.com", "AI task and calendar planner. Auto-builds your daily schedule around deadlines and priorities.", "Automation", "Tool", "Subscription", "⭐ Established", false, false],
  ["Teal", "https://tealhq.com", "AI career and resume tool. Tailors resumes, tracks job apps, and writes cover letters from your work history.", "Automation", "Tool", "Freemium", "🌟 Hidden Gem", false, true],

  // WRITING
  ["Writer", "https://writer.com", "Enterprise content platform. Brand voice modeling, governance, and team-scale AI writing.", "Writing Assistants", "Tool", "Subscription", "⭐ Established", false, false],
  ["Originality.ai", "https://originality.ai", "AI content + plagiarism detector. The most-cited tool for verifying AI-generated text in 2026.", "Writing Assistants", "Tool", "Subscription", "⭐ Established", false, false],
  ["ProWritingAid", "https://prowritingaid.com", "Long-form writing checker. Style, grammar, and structure analysis tuned for novelists and essayists.", "Writing Assistants", "Tool", "Freemium", "⭐ Established", false, false],
  ["Anyword", "https://anyword.com", "AI marketing copy generator with predictive performance scoring. Picks the variant most likely to convert.", "Copywriting", "Tool", "Subscription", "💎 Rare", false, false],
  ["Hemingway App", "https://hemingwayapp.com", "Readability editor. Surfaces overlong sentences, passive voice, and complex words; encourages tight writing.", "Writing Assistants", "Tool", "Free", "⭐ Established", false, false],
  ["DeepL", "https://deepl.com", "High-accuracy AI translator. Better quality than Google Translate for European and major Asian languages.", "Writing Assistants", "Tool", "Freemium", "⭐ Established", false, false],
  ["Undetectable AI", "https://undetectable.ai", "AI text humanizer. Rewrites AI output to bypass AI detection tools — controversial but widely used.", "Writing Assistants", "Tool", "Subscription", "🌟 Hidden Gem", false, true],

  // SEO
  ["Surfer SEO", "https://surferseo.com", "Content scoring tool. Grades drafts against the top-ranking pages for any keyword in real time.", "SEO Tools", "Tool", "Subscription", "👑 Legendary", true, false],
  ["Semrush", "https://semrush.com", "All-in-one SEO suite. Keyword research, backlink analysis, rank tracking, and content audits at enterprise scale.", "SEO Tools", "Tool", "Subscription", "👑 Legendary", true, false],
  ["Ahrefs", "https://ahrefs.com", "Backlink and keyword research platform. The standard for technical SEO and competitor analysis.", "SEO Tools", "Tool", "Subscription", "👑 Legendary", true, false],
  ["Clearscope", "https://clearscope.io", "Premium content grading platform. Used by enterprise content teams to optimize against search intent.", "SEO Tools", "Tool", "Subscription", "⭐ Established", false, false],
  ["Moz Pro", "https://moz.com/products/pro", "Backlinks and on-page SEO suite. Less broad than Ahrefs but stronger on Domain Authority methodology.", "SEO Tools", "Tool", "Subscription", "⭐ Established", false, false],
  ["Screaming Frog", "https://screamingfrog.co.uk", "Desktop SEO crawler. The standard tool for technical audits of large sites.", "SEO Tools", "Tool", "Freemium", "⭐ Established", false, false],
  ["SE Ranking", "https://seranking.com", "All-in-one rank tracker and SEO suite. Affordable alternative to Ahrefs and Semrush for small teams.", "SEO Tools", "Tool", "Subscription", "⭐ Established", false, false],
  ["Frase", "https://frase.io", "SERP research and AI content writer. Builds briefs from competing pages and drafts the article.", "SEO Tools", "Tool", "Subscription", "💎 Rare", false, false],
  ["MarketMuse", "https://marketmuse.com", "Topic modeling and content planning. Identifies content gaps via NLP analysis of a site's topic coverage.", "SEO Tools", "Tool", "Subscription", "💎 Rare", false, false],
  ["Scalenut", "https://scalenut.com", "SEO content automation. Brief, outline, draft, and cluster planning in one workflow.", "SEO Tools", "Tool", "Subscription", "💎 Rare", false, false],
  ["Morningscore", "https://morningscore.io", "Gamified all-in-one SEO. Beginner-friendly UI with rank tracking, backlinks, and audits.", "SEO Tools", "Tool", "Subscription", "🌟 Hidden Gem", false, true],
  ["Rankability", "https://rankability.com", "NLP-based content optimizer. Newer entrant focused on semantic SEO and entity coverage.", "SEO Tools", "Tool", "Subscription", "🌟 Hidden Gem", false, true],
  ["AccuRanker", "https://accuranker.com", "Large-scale rank tracker. Pure-play tracking tool used by SEO agencies for client reporting.", "SEO Tools", "Tool", "Subscription", "💎 Rare", false, false],
  ["Seobility", "https://seobility.net", "SEO audit and monitoring. Free tier covers small sites; paid for ongoing technical SEO health.", "SEO Tools", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["Yoast SEO", "https://yoast.com", "The WordPress SEO plugin. Most-installed SEO tool in existence, with AI features in recent versions.", "SEO Tools", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Rank Math", "https://rankmath.com", "WordPress SEO plugin. Yoast's main competitor; more features in the free tier.", "SEO Tools", "Tool", "Freemium", "⭐ Established", false, false],
  ["Schemantra", "https://schemantra.com", "Schema markup generator. Generates valid JSON-LD for any page type without writing code.", "SEO Tools", "Tool", "Freemium", "🌟 Hidden Gem", false, true],
  ["SEO.ai", "https://seo.ai", "AI content and SEO publishing platform. Generates articles optimized for ranking with one click.", "SEO Tools", "Tool", "Subscription", "💎 Rare", false, false],
  ["NeuronWriter", "https://neuronwriter.com", "Semantic SEO content optimizer. Affordable alternative to Clearscope for solo creators.", "SEO Tools", "Tool", "Subscription", "🌟 Hidden Gem", false, true],

  // MARKETING / EMAIL
  ["Mailchimp", "https://mailchimp.com", "Email marketing and automation. The most recognizable name in email, with full marketing platform features.", "Email & Marketing Automation", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Zapier", "https://zapier.com", "App-to-app workflow automation. The standard 'glue' between SaaS tools — thousands of integrations.", "Email & Marketing Automation", "Tool", "Freemium", "👑 Legendary", true, false],
  ["HubSpot", "https://hubspot.com", "CRM and marketing platform. Free CRM core plus growing AI marketing, sales, and service hubs.", "Marketing AI", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Klaviyo", "https://klaviyo.com", "Ecommerce email and SMS automation. The default for Shopify-scale brands needing behavioral campaigns.", "Email & Marketing Automation", "Tool", "Subscription", "⭐ Established", true, false],
  ["Omnisend", "https://omnisend.com", "Ecommerce multi-channel automation. Klaviyo's main competitor at lower price points.", "Email & Marketing Automation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Gumloop", "https://gumloop.com", "No-code AI agent builder. Visual workflow tool for chaining AI models into business automations.", "Email & Marketing Automation", "Tool", "Freemium", "⭐ Established", false, false],
  ["Brevo", "https://brevo.com", "All-in-one email, SMS, and CRM. European-focused alternative to Mailchimp and HubSpot.", "Email & Marketing Automation", "Tool", "Freemium", "⭐ Established", false, false],
  ["ActiveCampaign", "https://activecampaign.com", "AI-driven email and CRM workflows. Strong on complex lifecycle automation for SMB.", "Email & Marketing Automation", "Tool", "Subscription", "⭐ Established", false, false],
  ["Customer.io", "https://customer.io", "Multi-channel lifecycle automation. Developer-friendly tool with deep behavioral targeting.", "Email & Marketing Automation", "Tool", "Subscription", "⭐ Established", false, false],
  ["Reply.io", "https://reply.io", "AI sales email outreach. Sequences, follow-ups, and lead-quality scoring for SDR teams.", "Sales AI", "Tool", "Subscription", "💎 Rare", false, false],
  ["Tidio", "https://tidio.com", "Chatbot and live chat for small business. AI agent built in for first-line support automation.", "Customer Support", "Tool", "Freemium", "⭐ Established", false, false],
  ["Brand24", "https://brand24.com", "Brand mention monitoring. Tracks discussions about you across news, blogs, social, podcasts, and forums.", "Marketing AI", "Tool", "Subscription", "💎 Rare", false, false],
  ["Browse AI", "https://browse.ai", "No-code web scraper. Train a bot to extract structured data from any website on a schedule.", "Marketing AI", "Tool", "Freemium", "💎 Rare", false, false],
  ["OptinMonster", "https://optinmonster.com", "Lead capture and popup platform. Exit-intent campaigns, A/B testing, dynamic targeting.", "Marketing AI", "Tool", "Subscription", "⭐ Established", false, false],
  ["FeedHive", "https://feedhive.com", "Social content recycling and scheduling. Reuses your best posts across channels on AI-suggested cadences.", "Social Media Management", "Tool", "Freemium", "🌟 Hidden Gem", false, true],

  // SOCIAL
  ["Buffer", "https://buffer.com", "Simple multi-channel scheduler. The most user-friendly social tool, beloved by creators and small teams.", "Social Media Management", "Tool", "Freemium", "👑 Legendary", true, false],
  ["Hootsuite", "https://hootsuite.com", "Full-featured social suite. Old-guard enterprise social tool with comprehensive listening and inbox features.", "Social Media Management", "Tool", "Subscription", "👑 Legendary", true, false],
  ["Sprout Social", "https://sproutsocial.com", "Premium social media management and listening. Top choice for agencies and enterprise marketers.", "Social Media Management", "Tool", "Subscription", "👑 Legendary", true, false],
  ["Later", "https://later.com", "Visual planner and link-in-bio. Started as Instagram-first; now multi-channel with strong visual planning.", "Social Media Management", "Tool", "Freemium", "⭐ Established", false, false],
  ["Tailwind", "https://tailwindapp.com", "Pinterest-first scheduler. The dominant tool for Pinterest marketers; expanded to Instagram and Facebook.", "Social Media Management", "Tool", "Freemium", "⭐ Established", false, false],
  ["SocialPilot", "https://socialpilot.co", "Agency-focused social scheduler. Affordable client management for agencies with many small accounts.", "Social Media Management", "Tool", "Subscription", "⭐ Established", false, false],
  ["Vista Social", "https://vistasocial.com", "Affordable team social scheduler. Modern alternative to Hootsuite for small teams on a budget.", "Social Media Management", "Tool", "Freemium", "💎 Rare", false, false],
  ["Agorapulse", "https://agorapulse.com", "Social inbox-first platform. Strongest unified inbox in the category; popular with social customer-service teams.", "Social Media Management", "Tool", "Subscription", "⭐ Established", false, false],
  ["Metricool", "https://metricool.com", "Analytics-led scheduler. Comprehensive reporting and competitor benchmarking at small-team prices.", "Social Media Management", "Tool", "Freemium", "💎 Rare", false, false],
  ["Typefully", "https://typefully.com", "X (Twitter) and Threads writing tool. Built for thread-style writers, with scheduling and analytics.", "Social Media Management", "Tool", "Freemium", "💎 Rare", false, false],
  ["Manychat", "https://manychat.com", "DM automation for Instagram, Facebook Messenger, and TikTok. Drives sales and support via chat flows.", "Social Media Management", "Tool", "Freemium", "⭐ Established", false, false],
  ["Iconosquare", "https://iconosquare.com", "Visual-network analytics. Specializes in Instagram, TikTok, and YouTube performance dashboards.", "Social Media Management", "Tool", "Subscription", "💎 Rare", false, false],

  // ANALYTICS
  ["Hotjar", "https://hotjar.com", "Heatmaps and session replay. Watch real users move through your site to find UX problems.", "Analytics", "Tool", "Freemium", "⭐ Established", true, false],
  ["Optimizely", "https://optimizely.com", "A/B testing and experimentation platform. The enterprise standard for ecommerce and product experiments.", "Analytics", "Tool", "Subscription", "⭐ Established", false, false],
  ["Glew", "https://glew.io", "Multi-channel ecommerce analytics. Unified reporting across Shopify, Amazon, and other retail channels.", "Analytics", "Tool", "Subscription", "💎 Rare", false, false],
  ["Kissmetrics", "https://kissmetrics.io", "Person-based revenue analytics. Tracks the same user across devices and sessions for SaaS and ecom.", "Analytics", "Tool", "Subscription", "💎 Rare", false, false],
  ["Mixpanel", "https://mixpanel.com", "Event-based product analytics. The default tool for SaaS teams tracking feature usage and funnels.", "Analytics", "Tool", "Freemium", "⭐ Established", false, false],
  ["FullStory", "https://fullstory.com", "Digital experience analytics. Session replay, frustration signals, and conversion funnels.", "Analytics", "Tool", "Subscription", "💎 Rare", false, false],
  ["Contentsquare", "https://contentsquare.com", "Experience intelligence platform. Enterprise behavior analytics for ecommerce and SaaS.", "Analytics", "Tool", "Subscription", "💎 Rare", false, false],
  ["Tableau", "https://tableau.com", "Business intelligence and data visualization. The market-leading enterprise BI platform.", "Analytics", "Tool", "Subscription", "⭐ Established", false, false],
  ["Looker", "https://cloud.google.com/looker", "Google Cloud's BI platform. Modeling-layer-first approach popular with data engineering teams.", "Analytics", "Tool", "Subscription", "⭐ Established", false, false],
  ["Power BI", "https://powerbi.microsoft.com", "Microsoft's BI platform. Bundled with Microsoft 365; default for Excel-heavy organizations.", "Analytics", "Tool", "Subscription", "⭐ Established", false, false],
  ["Segment", "https://segment.com", "Customer data platform. Captures user events once and pipes them to every analytics and marketing tool.", "Analytics", "Tool", "Subscription", "⭐ Established", false, false],
  ["Algolia", "https://algolia.com", "Search and recommendation API. The default search infrastructure for ecommerce and content sites.", "Analytics", "Tool", "Freemium", "⭐ Established", false, false],

  // ECOMMERCE
  ["Shopify", "https://shopify.com", "Hosted ecommerce platform. The default choice for new ecommerce stores at any size.", "Ecommerce Platforms", "Tool", "Subscription", "👑 Legendary", true, false],
  ["WooCommerce", "https://woocommerce.com", "WordPress ecommerce plugin. The leading self-hosted ecommerce platform, powers ~25% of online stores.", "Ecommerce Platforms", "Tool", "Free", "👑 Legendary", true, false],
  ["BigCommerce", "https://bigcommerce.com", "Mid-market ecommerce platform. Shopify alternative for stores needing more flexibility and lower transaction fees.", "Ecommerce Platforms", "Tool", "Subscription", "⭐ Established", false, false],
  ["Wix", "https://wix.com", "Site builder with ecommerce. Strong drag-and-drop builder; ecommerce is solid but not specialized.", "Ecommerce Platforms", "Tool", "Freemium", "⭐ Established", false, false],
  ["Square", "https://squareup.com", "POS and online store combo. Built for omnichannel retail with built-in payments.", "Ecommerce Platforms", "Tool", "Freemium", "⭐ Established", false, false],
  ["Stripe", "https://stripe.com", "Payments infrastructure. The developer-first payment processor used by most modern startups.", "Ecommerce Platforms", "Tool", "Pay per use", "👑 Legendary", true, false],
  ["Cin7", "https://cin7.com", "Inventory and demand forecasting. Multi-channel inventory backbone for mid-market ecom brands.", "Ecommerce Platforms", "Tool", "Subscription", "💎 Rare", false, false],
  ["ShipStation", "https://shipstation.com", "Multi-channel shipping software. The default fulfillment tool for SMB ecommerce.", "Ecommerce Platforms", "Tool", "Subscription", "⭐ Established", false, false],
  ["Shippo", "https://goshippo.com", "Shipping label aggregator. Compare carriers, automate fulfillment, and integrate with any ecommerce platform.", "Ecommerce Platforms", "Tool", "Pay per use", "⭐ Established", false, false],
  ["ReferralCandy", "https://referralcandy.com", "Referral program platform for ecommerce. Customer-acquisition automation specifically for Shopify and BigCommerce.", "Ecommerce Platforms", "Tool", "Subscription", "💎 Rare", false, false],
  ["Smile.io", "https://smile.io", "Loyalty and rewards for Shopify. Points, referrals, and VIP tiers, easy to install in minutes.", "Ecommerce Platforms", "Tool", "Freemium", "⭐ Established", false, false],
  ["Gorgias", "https://gorgias.com", "Ecommerce helpdesk. Customer support tuned for Shopify with deep order context in every conversation.", "Customer Support", "Tool", "Subscription", "⭐ Established", false, false],
  ["Zendesk", "https://zendesk.com", "Enterprise customer support platform. The most-deployed helpdesk; deep integrations and AI agent options.", "Customer Support", "Tool", "Subscription", "👑 Legendary", true, false],
  ["Freshdesk", "https://freshdesk.com", "Ticketing and helpdesk for SMB. Cheaper alternative to Zendesk with solid core features.", "Customer Support", "Tool", "Freemium", "⭐ Established", false, false],
  ["LiveChat", "https://livechat.com", "Live chat support platform. Long-running standard for embedded site chat with strong agent UX.", "Customer Support", "Tool", "Subscription", "⭐ Established", false, false],
  ["Help Scout", "https://helpscout.com", "Email-driven customer support. Friendlier, lighter alternative to Zendesk for small teams.", "Customer Support", "Tool", "Subscription", "⭐ Established", false, false],
  ["Ground AI", "https://joinground.com", "AI ecommerce personalization. Dynamic on-site experiences powered by visitor signals; YC-backed.", "Ecommerce Platforms", "Tool", "Subscription", "💎 Rare", false, false],
];

console.log(`[seed] Total tools in queue: ${tools.length}`);

// ---------- Step 4: create or update ----------

let created = 0, fixed = 0, skipped = 0, errors = 0;

const rarityToTier = (r) => {
  if (r.includes("Legendary")) return "legendary";
  if (r.includes("Hidden Gem")) return "gem";
  if (r.includes("Rare")) return "rare";
  return "established";
};

for (const [name, url, description, categoryName, type, pricing, rarity, featured, gem] of tools) {
  const norm = normalizeUrl(url);
  const exist = existing.get(norm);
  const targetCatId = catId(categoryName);

  if (exist) {
    // Already exists. If category is mismatched (or missing), fix it. Otherwise skip.
    if (!exist.categoryRelationId || exist.categoryRelationId !== targetCatId) {
      if (!targetCatId) {
        console.warn(`  ✗ ${name}: no target category id (skipping fix)`);
        skipped++;
        continue;
      }
      try {
        await notion.pages.update({
          page_id: exist.id,
          properties: { Category: { relation: [{ id: targetCatId }] } },
        });
        console.log(`  ↻ ${name}: fixed Category → ${categoryName}`);
        fixed++;
      } catch (e) {
        console.warn(`  ✗ ${name}: fix failed — ${e?.message || e}`);
        errors++;
      }
    } else {
      skipped++;
    }
    continue;
  }

  // Create new
  if (!targetCatId) {
    console.warn(`  ✗ ${name}: no target category id (skipping)`);
    errors++;
    continue;
  }

  try {
    await notion.pages.create({
      parent: { database_id: LIBRARY_DS },
      properties: {
        Name: { title: [{ text: { content: name } }] },
        URL: { url },
        Description: { rich_text: [{ text: { content: description } }] },
        Type: { select: { name: type } },
        Pricing: { select: { name: pricing } },
        Status: { select: { name: "Ready" } },
        Rarity: { select: { name: rarity } },
        Category: { relation: [{ id: targetCatId }] },
        Featured: { checkbox: featured },
        Gem: { checkbox: gem },
        Source: { rich_text: [{ text: { content: "Editorial roundup" } }] },
      },
    });
    console.log(`  + ${name} → ${categoryName}`);
    created++;
    // Tiny pause to be polite to the API
    await new Promise((r) => setTimeout(r, 120));
  } catch (e) {
    console.warn(`  ✗ ${name}: create failed — ${e?.message || e}`);
    errors++;
  }
}

console.log(`\n[seed] Done.`);
console.log(`  Created: ${created}`);
console.log(`  Fixed:   ${fixed}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Errors:  ${errors}`);
process.exit(errors > 0 ? 1 : 0);
