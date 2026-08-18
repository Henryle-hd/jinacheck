import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Two cheap gates in front of the app's own search path.
 *
 * Neither is a wall. Anything a public browser client can call, a determined
 * person can replay, and pretending otherwise would be self-deception. What
 * these do is make casual reuse inconvenient: a cross-site page cannot call it
 * at all, and a script has to fetch the page and parse a token that expires,
 * rather than posting JSON at a fixed URL forever. Abuse is capped by the rate
 * limiter, which is the part that actually protects anything.
 */

const SECRET =
  process.env.APP_SECRET ?? process.env.ANALYTICS_SALT ?? "jinacheck-development-secret";

/** How long a minted token stays good. Long enough to leave a tab open. */
const TOKEN_TTL_MS = 1000 * 60 * 60 * 3;

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Mint a token to embed in the page. */
export function mintToken(): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  return `${expires}.${sign(String(expires))}`;
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;

  const expiry = Number(expires);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(signature);
  // Length check first: timingSafeEqual throws on a mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * True when the request came from a page on this site.
 *
 * `Sec-Fetch-Site` is set by the browser and cannot be spoofed from page
 * JavaScript, so it is the useful signal. Requests with no such header at all
 * are treated as same-origin, since non-browser callers simply omit it and the
 * rate limiter is what handles those.
 */
export function isSameOrigin(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = headers.get("origin");
  const host = headers.get("host");
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}
