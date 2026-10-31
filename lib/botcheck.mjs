// Is this response a bot check rather than the site? Pure, so it is easy to test.
const MARKERS = [
  /challenge-platform|cf-chl-|cf_chl_|__cf_chl/i,                 // Cloudflare managed challenge
  /<title>\s*(just a moment|attention required|access denied|pardon our interruption|verifying|security check|are you a robot)/i,
  /verify (that )?you are (a )?human|checking your browser|enable javascript and cookies to continue/i,
  /captcha-delivery\.com|geo\.captcha-delivery|datadome/i,         // DataDome
  /px-captcha|_pxCaptcha|perimeterx/i,                             // PerimeterX / HUMAN
  /_Incapsula_Resource|incapsula incident/i,                       // Imperva
  /reference\s*#\d+\.[0-9a-f]+/i,                                  // Akamai "Access Denied"
  /awswaf|aws-waf-token/i,                                         // AWS WAF
];

/** @returns {string} the reason it looks blocked, or "" when it looks like the real site */
export function botCheck(status, headers, body) {
  const head = String(body || "").slice(0, 60_000);
  if ((headers?.get?.("cf-mitigated") ?? headers?.["cf-mitigated"]) === "challenge") return "cloudflare";
  if (MARKERS.some((m) => m.test(head))) return "marker";
  if ([401, 403, 429, 503].includes(status) && head.length < 20_000) return `status ${status}`;
  if (/g-recaptcha|h-captcha|hcaptcha\.com|cf-turnstile/i.test(head) && head.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, "").trim().length < 1500) return "captcha";
  return "";
}
