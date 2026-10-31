// One-off: re-file every link into taxonomy v2 (Design, Games & 3D, Hardware & Gear, a real Music
// Business, and the catch-alls split up). Explicit placements from a review of all live and queued
// links; anything left in a sub-branch that no longer exists is placed by the classifier.
//   node scripts/migrations/2026-10-31-taxonomy-v2.mjs [--dry]
import { classify, findSub, hostOf } from "../../lib/taxonomy.mjs";
import { readData, writeData } from "../data-io.mjs";

// [match on name or host, "branch/sub"]; first match wins
const PLACE = [
  // ---------- Design ----------
  [/^(figma ai|stitch|aidesigner|sleek\.design|dessn|aura$|uizard|galileo)/i, "design/ui-ux-design"],
  [/^(kittl|canva ai|adobe express|lovart|login \| logo diffusion|logo diffusion|freelance logo design|zonalogo|crib of art|shop all – crib of art)/i, "design/graphic-brand"],
  [/^(beautiful\.ai|gamma$|decktopus|chatslide|pageon|tome$|slidesai|plus ai|pitch$|napkin ai|venngage|infograph|chronicle)/i, "design/presentations"],
  [/^(free fonts|fontjoy)/i, "design/typography"],
  [/^(streamline|pixelbuddha)/i, "design/icons-illustration"],
  [/^(all free mockups|unblast|graphic pear|envato)/i, "design/mockups-templates"],
  [/^(grainient|everytool4u color|irorecipe)/i, "design/color"],
  [/^(unicorn\.studio|smooothy|liquid glass design)/i, "design/motion-interactive"],
  [/^(mobbin|awwwards|laws of ux|toools\.design|deslove|pinterest|cosmos$|active theory|dora ai)/i, "design/design-inspiration"],
  [/^(favicon generator|qrcode monkey|spotifybanner|endless tools)/i, "design/design-utilities"],
  [/^architizer/i, "design/architecture-interior"],
  [/^(debonair media|particlefx studio)/i, "design/design-studios"],
  [/^(krea|leonardo\.ai|flora fauna ai|florafauna)/i, "image-art/image-generation"],
  // ---------- Image & Photo ----------
  [/^(free ai video & image upsc|ai image upscaler|letsenhance|remini|mendphoto|magnific)/i, "image-art/upscaling"],
  [/^(photoroom|clipdrop|pic copilot|productshot ai)/i, "image-art/product-photos"],
  [/^(unsplash|dynamic wallpaper club)/i, "image-art/stock-assets"],
  [/^(create$)/i, "image-art/image-generation"],
  // ---------- Video ----------
  [/^(jeanphil ai|bulin 47 ai|raindance ai|hypemigo|crazy frog|zombieai|rapframe|dime dime baby|burning bridges studio)/i, "video-animation/trend-video"],
  [/^(opus\.pro|crayo|capcut)/i, "video-animation/short-form"],
  [/^(after effects plugins|superluminal|remotion|renderforest|mkclip|thank you - sign up \| moti|motion array)/i, "video-animation/motion-vfx"],
  [/^(ltx studio|focal$)/i, "video-animation/film-storytelling"],
  [/^(hour one|elai\.io|colossyan)/i, "video-animation/ai-avatars"],
  // ---------- Games & 3D ----------
  [/^(rosebud)/i, "3d-gaming/game-development"],
  [/^(scenario$|spriteframe|normalmapai|dungeon alchemist|skybox)/i, "3d-gaming/game-assets"],
  [/^inworld/i, "3d-gaming/npc-ai"],
  [/^plask/i, "3d-gaming/mocap-animation"],
  [/^(slipways|geoguessr|retrogames|my abandonware)/i, "3d-gaming/play"],
  // ---------- Hardware & Gear ----------
  [/^(rtings)/i, "hardware-gear/reviews-buying"],
  [/^(equipboard|my new microphone|wrdtunes)/i, "hardware-gear/studio-gear"],
  [/^(can you run it|10 incredibly useful programs)/i, "hardware-gear/pc-hardware"],
  // ---------- Audio & Music ----------
  [/^(wavtool|software for music product|splice beat maker)/i, "audio-music/daws-production"],
  [/^(make slowed\+reverb)/i, "audio-music/audio-enhancement"],
  [/^(brain\.fm)/i, "healthcare-wellness/focus-sleep"],
  [/^(headspace)/i, "healthcare-wellness/focus-sleep"],
  [/^(native instruments|arturia|eastwest sounds|spectrasonics)/i, "audio-music/plugins-instruments"],
  // ---------- Music Business ----------
  [/^(too lost|toolost\.com)/i, "music-business/distribution"],
  [/^(feature\.fm|burstimo members|undefined \| blackstar|roi-driven music marketing|welcome to amw|just featured|groover|recordlabel\.ai)/i, "music-business/music-marketing"],
  [/^(apolone|spotify playlist bot check|playlisthub)/i, "music-business/playlists-growth"],
  [/^(spotify for artists|youtube for artists|profile \| tidal artist|bandzoogle)/i, "music-business/artist-platforms"],
  [/^(soundcharts|muso\.ai|stvdio|makromusic|youtube music charts)/i, "music-business/industry-data"],
  [/^(home - riaa|get isrc codes|isrc finder|bmi \| bmi|the harry fox agency|home \| mechanical licensing|https:\/\/www\.soundexchange|tuneregistry|ifpi|trqk|the leading provider of music|sample clearance)/i, "music-business/publishing-rights"],
  [/^(11:11 records|offstream music group|empire$)/i, "music-business/labels"],
  [/^(soundbetter|musiversal|fiverr)/i, "music-business/music-services"],
  [/^(top 10 music|top music marketing agency|music promotion agency|the art of publicity|growth hackers|soundcamps|pitch-us|hubscore|ispytunes|10 best pr|lost boy entertainment|otter pr|top 7 influencer|top 10 music influencer|top 20 creator tools|omari mc)/i, "music-business/music-guides"],
  [/^(united talent agency|stack by rostr)/i, "music-business/booking-management"],
  // ---------- Writing ----------
  [/^(deepl|mangatranslate)/i, "writing-content/translation"],
  [/^(undetectable ai|originality\.ai|rephrasy)/i, "writing-content/ai-detection"],
  [/^(medium:|symphonic blog|inevitability research|ceo times|san$)/i, "writing-content/blogs-publications"],
  // ---------- Research & Knowledge ----------
  [/^(future tools|toolfolio|ai toolbase|top 36 crypto tools|influencermarketinghub)/i, "research-knowledge/tool-directories"],
  [/^(paradigm ai|asklibrary|thea$|scispace|semantic scholar|consensus|elicit|geospy|search$)/i, "research-knowledge/research-tools"],
  [/^(tana$)/i, "research-knowledge/knowledge-management"],
  // ---------- AI Assistants ----------
  [/^(google ai studio|xai$|openrouter|mistral ai)/i, "ai-assistants-agents/models-apis"],
  [/^(pi$|i have no friends)/i, "ai-assistants-agents/companions"],
  [/^(sider|memoryplugin|kerlig|superwhisper)/i, "ai-assistants-agents/browser-assistants"],
  [/^(nano banana)/i, "image-art/image-editing"],
  // ---------- Code ----------
  [/^(21st\.dev)/i, "code-development/ui-components"],
  [/^(testsprite|qodo)/i, "code-development/testing-qa"],
  [/^(apify|browse ai|bitquery)/i, "code-development/scraping-data"],
  [/^(supabase|sanity\.io)/i, "dev-infrastructure/databases-backend"],
  [/^(hostinger)/i, "dev-infrastructure/hosting-deploy"],
  // ---------- Productivity ----------
  [/^(reclaim ai|zencal|meeting topics)/i, "productivity-automation/calendar-scheduling"],
  [/^(figjam ai|miro$|coda$|scribe ai|grid$|rows$|notion ai)/i, "productivity-automation/docs-whiteboards"],
  [/^(tally$|jotform)/i, "productivity-automation/forms-surveys"],
  [/^(teal$|web3 career)/i, "productivity-automation/careers-jobs"],
  [/^(slack$)/i, "productivity-automation/email-communication"],
  // ---------- Business ----------
  [/^(airslate signnow|best lawyers|docusign)/i, "business-marketing/legal-contracts"],
  [/^(popular pays|inbeat agency|aha$|sociallypowerful)/i, "business-marketing/influencer-marketing"],
  [/^(clutch\.co|designrush|lyfemarketing)/i, "business-marketing/agency-directories"],
  [/^(stripe|square$|online business banking)/i, "finance-trading/payments-banking"],
  [/^(power bi|looker|tableau ai|thoughtspot)/i, "data-analytics/bi-dashboards"],
  [/^(sixième son|us landing)/i, "business-marketing/agencies-studios"],
  [/^(egnyte|contentcore|axero solutions)/i, "security-privacy/storage-cloud"],
  [/^(icedrive|smash$)/i, "security-privacy/storage-cloud"],
  [/^(thething by privateai|ai metadata cleaner|duck\.ai)/i, "security-privacy/privacy-tools"],
  // ---------- Crypto ----------
  [/^(exchange \| pancakeswap|swap \| jupiter|dex screener|pump$|dexlab|gmgn)/i, "blockchain-web3/trading-dex"],
  [/^(crypto trading data aggreg|crypto portfolio tracker|bubblemaps|tweetscout|twitterscore)/i, "blockchain-web3/on-chain-analytics"],
  [/^(best nft marketplaces)/i, "blockchain-web3/nfts"],
  // ---------- Entertainment & Fashion ----------
  [/^(backstage$|acting plan|talent consult la|onassemble|acting magazine)/i, "entertainment-media/talent-casting"],
  [/^(tagvenue|peerspace|eventflare|ticketswap)/i, "entertainment-media/events-venues"],
  [/^(vitrina)/i, "entertainment-media/film-tv"],
  [/^(goth n' rock)/i, "fashion-style/designer-brands"],
  [/^(thesupermade)/i, "fashion-style/streetwear"],
  [/^(hard jewelry)/i, "fashion-style/jewelry-accessories"],
  [/^(karla otto|purple$|top 25 fashion pr)/i, "fashion-style/fashion-pr"],
  [/^(orcajump store)/i, "fashion-style/fashion-marketplaces"],
  // ---------- Education ----------
  [/^(duolingo)/i, "education-learning/language-learning"],
  [/^(brisk teaching)/i, "education-learning/ai-tutoring"],
  // ---------- Utilities ----------
  [/^(spotidown)/i, "utilities/downloaders"],
  [/^(namecheckr)/i, "dev-infrastructure/domains"],
  // ---------- previously unplaced ----------
  [/^(ai cofounder)/i, "ai-assistants-agents/ai-agents"],
  [/^(april zhu)/i, "design/design-utilities"],
  [/^(shop$)/i, "business-marketing/ecommerce-platforms"],
  [/^(triton|ewv$|goodwater)/i, "finance-trading/venture-capital"],
  [/^(europeandatajournalism)/i, "data-analytics/bi-dashboards"],
  [/^(nocodefounders)/i, "research-knowledge/tool-directories"],
  [/^(app$)/i, "writing-content/long-form-content"],
  [/^(client portal|interdependence)/i, "business-marketing/agencies-studios"],
  [/^(cradle$)/i, "productivity-automation/project-management"],
  [/^(slate digital)/i, "audio-music/plugins-instruments"],
];

const dry = process.argv.includes("--dry");
const { library, queue } = await readData();
const moves = [];
const place = (e) => {
  const host = hostOf(e.url);
  const rule = PLACE.find(([re]) => re.test(e.name.trim()) || re.test(host));
  let to = rule?.[1];
  if (!to && !findSub(e.branch, e.sub)) {
    const c = classify({ name: e.name, url: e.url, description: e.description });
    to = c.sub ? `${c.branch}/${c.sub}` : "";
  }
  if (!to) return;
  const [branch, sub] = to.split("/");
  if (!findSub(branch, sub)) throw new Error(`bad target ${to} for ${e.name}`);
  if (branch === e.branch && sub === e.sub) return;
  moves.push(`${(e.branch || "—") + "/" + (e.sub || "—")} → ${to}   ${e.name}`);
  e.branch = branch; e.sub = sub;
};
library.forEach(place);
queue.forEach(place);
const orphans = [...library, ...queue].filter((e) => !findSub(e.branch, e.sub));
console.log(moves.join("\n"));
console.log(`\n${moves.length} moved · ${orphans.length} still without a valid branch:`, orphans.map((e) => e.name).join(", "));
if (!dry) await writeData({ library, queue });
