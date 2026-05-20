/**
 * Lightweight fixed-window rate limiter backed by SQLite.
 * Adequate for educational deployments and single-node setups.
 */
import { getDb } from "./db";

export interface RateLimitOptions {
  bucket: string;
  key: string;
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const db = getDb();
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;

  const row = db
    .prepare(
      "SELECT count, window_start FROM rate_limits WHERE bucket = ? AND key = ?",
    )
    .get(opts.bucket, opts.key) as
    | { count: number; window_start: number }
    | undefined;

  if (!row || now - row.window_start > windowMs) {
    db.prepare(
      `INSERT INTO rate_limits (bucket, key, count, window_start)
       VALUES (?, ?, 1, ?)
       ON CONFLICT (bucket, key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
    ).run(opts.bucket, opts.key, now);
    return {
      allowed: true,
      remaining: opts.limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (row.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: row.window_start + windowMs,
    };
  }

  db.prepare(
    "UPDATE rate_limits SET count = count + 1 WHERE bucket = ? AND key = ?",
  ).run(opts.bucket, opts.key);

  return {
    allowed: true,
    remaining: opts.limit - row.count - 1,
    resetAt: row.window_start + windowMs,
  };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr;
  return "0.0.0.0";
}
