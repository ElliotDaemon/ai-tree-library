// Portal authentication primitives.
//
// One-person admin gate using a username + password stored as env vars on
// Vercel (so a password manager like Proton Pass can save & autofill).
//
// Session model:
//   - On successful login, set an httpOnly cookie `ne_admin` whose value is
//     `<expiryEpochSec>.<HMAC-SHA256(ADMIN_PASSWORD, expiryEpochSec)>` in
//     base64url. Stateless — no session store, no DB row.
//   - Rotating ADMIN_PASSWORD instantly invalidates every issued cookie
//     because the HMAC secret changes. That's desirable for password rotation.
//   - Cookie max-age is 30 days. After that, log in again.
//
// Why HMAC and not "store the password as the cookie value":
//   - The cookie should not be a credential-equivalent value. If a cookie
//     leaks (browser extension, logs, etc.) the password itself shouldn't
//     leak with it. The HMAC scheme lets us verify the cookie without
//     storing the password anywhere recoverable.
//
// Edge-runtime compatible: uses Web Crypto (crypto.subtle), no `node:crypto`,
// no Buffer.

export const SESSION_COOKIE = "ne_admin";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

// ---------- env helpers ----------

export function getAdminUser(): string {
  return process.env.ADMIN_USER || "admin";
}

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword());
}

// ---------- base64url ----------

function b64urlEncode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- HMAC-SHA256 via Web Crypto ----------

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64urlEncode(sig);
}

// ---------- constant-time string compare ----------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- session sign / verify ----------

export async function signSession(): Promise<string> {
  const password = getAdminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD unset");
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const expStr = String(exp);
  const mac = await hmac(password, expStr);
  return `${expStr}.${mac}`;
}

export async function verifySession(value: string | undefined | null): Promise<boolean> {
  const password = getAdminPassword();
  if (!password || !value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot >= value.length - 1) return false;
  const expStr = value.slice(0, dot);
  const providedMac = value.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expectedMac = await hmac(password, expStr);
  return timingSafeEqual(expectedMac, providedMac);
}

// ---------- credential check ----------

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUser = getAdminUser();
  const expectedPass = getAdminPassword();
  if (!expectedPass) return false;
  const userOk = timingSafeEqual(username, expectedUser);
  const passOk = timingSafeEqual(password, expectedPass);
  // Always evaluate both to avoid timing leak on username-only mismatch
  return userOk && passOk;
}
