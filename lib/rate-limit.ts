// Minimal in-memory rate limiter — good enough for a single-admin login
// endpoint on a small-traffic site. Keyed by IP. Survives within a
// serverless instance for its lifetime (typically minutes to hours) and
// resets across cold-starts, which is fine here: the goal is to slow
// down credential-stuffing attempts, not to be a perfect distributed
// limiter.
//
// For higher-volume / multi-region requirements, swap this for Vercel KV
// (or any external store) — same interface.

interface Bucket {
  /** Number of recorded hits in the current window. */
  count: number;
  /** Epoch ms when the window started. */
  windowStart: number;
  /** Epoch ms until which the IP is hard-locked (after blowing the limit). */
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

// Periodic GC so we don't leak memory on a long-lived instance. Runs
// on every check call but only does work occasionally.
let lastGc = 0;
function gc(now: number) {
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [key, b] of buckets) {
    // Drop entries that are both out-of-window and not locked
    if (now - b.windowStart > 30 * 60_000 && b.lockedUntil < now) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitOptions {
  /** Max attempts allowed per windowMs. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
  /** Lock duration once max is exceeded. */
  lockMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** ms until the lock lifts (only set when allowed=false). */
  retryAfterMs: number;
  /** Remaining attempts in this window before lockdown. */
  remaining: number;
}

/** Record an attempt and return whether it's allowed. */
export function hitRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  gc(now);

  const existing = buckets.get(key);

  // Hard-locked?
  if (existing && existing.lockedUntil > now) {
    return { allowed: false, retryAfterMs: existing.lockedUntil - now, remaining: 0 };
  }

  // Reset or initialise the window
  let bucket: Bucket;
  if (!existing || now - existing.windowStart > opts.windowMs) {
    bucket = { count: 1, windowStart: now, lockedUntil: 0 };
  } else {
    bucket = { ...existing, count: existing.count + 1 };
  }

  if (bucket.count > opts.max) {
    bucket.lockedUntil = now + opts.lockMs;
    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs: opts.lockMs, remaining: 0 };
  }

  buckets.set(key, bucket);
  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, opts.max - bucket.count),
  };
}

/** Resets the bucket for a key — call this after a successful auth so
 *  legitimate users don't get locked out by typos. */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
