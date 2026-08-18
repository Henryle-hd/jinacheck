import { neon } from "@neondatabase/serverless";

/**
 * Fixed-window rate limiting, counted in Postgres.
 *
 * In-memory counters are useless here: on Vercel each instance would keep its
 * own tally and the real limit would be "N times however many instances are
 * warm". Postgres is the only shared surface this app already has.
 *
 * Only searches that would actually reach BRELA are counted. Repeat and cached
 * queries cost nothing upstream, so throttling them would punish ordinary use
 * while doing nothing about the expense that matters.
 */

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

export interface Limit {
  /** Requests allowed inside the window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
}

/** Deliberately generous: a person checking names never approaches these. */
export const LIMITS = {
  perMinute: { max: 15, windowSec: 60 },
  perHour: { max: 120, windowSec: 3600 },
} as const;

const globalRl = globalThis as typeof globalThis & { __jinacheckRlSchema?: Promise<void> };

async function ensureSchema(): Promise<void> {
  if (!sql) return;
  globalRl.__jinacheckRlSchema ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        bucket       text PRIMARY KEY,
        hits         int NOT NULL DEFAULT 0,
        window_start timestamptz NOT NULL DEFAULT now()
      )
    `;
  })();
  return globalRl.__jinacheckRlSchema;
}

export interface RateResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Count one hit against `key` and say whether it may proceed.
 *
 * The window resets lazily: a row older than the window is reset to 1 rather
 * than swept by a background job, so there is nothing to schedule.
 *
 * Fails open. If the database is unreachable the search still runs, because a
 * limiter that takes the whole app down with it is worse than no limiter.
 */
export async function consume(key: string, limit: Limit): Promise<RateResult> {
  if (!sql) return { allowed: true, retryAfterSec: 0 };

  try {
    await ensureSchema();
    const bucket = `${key}:${limit.windowSec}`;
    const rows = (await sql`
      INSERT INTO rate_limits (bucket, hits, window_start)
      VALUES (${bucket}, 1, now())
      ON CONFLICT (bucket) DO UPDATE SET
        hits = CASE
          WHEN rate_limits.window_start < now() - make_interval(secs => ${limit.windowSec})
          THEN 1
          ELSE rate_limits.hits + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < now() - make_interval(secs => ${limit.windowSec})
          THEN now()
          ELSE rate_limits.window_start
        END
      RETURNING hits, extract(epoch FROM (window_start + make_interval(secs => ${limit.windowSec}) - now()))::int AS reset_in
    `) as Array<{ hits: number; reset_in: number }>;

    const row = rows[0];
    if (!row) return { allowed: true, retryAfterSec: 0 };
    return {
      allowed: row.hits <= limit.max,
      retryAfterSec: Math.max(1, row.reset_in ?? limit.windowSec),
    };
  } catch (err) {
    console.warn("[jinacheck] rate limit unavailable, allowing", err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Apply both windows. The tighter one wins. */
export async function checkRate(key: string): Promise<RateResult> {
  const minute = await consume(key, LIMITS.perMinute);
  if (!minute.allowed) return minute;
  return consume(key, LIMITS.perHour);
}
