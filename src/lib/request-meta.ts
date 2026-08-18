import { createHash } from "node:crypto";

/**
 * Coarse, non-identifying context for a search.
 *
 * What is deliberately NOT kept:
 *   - the IP address. It is read to derive a country and a rotating visitor
 *     token, then discarded; it is never returned from here or written down.
 *   - the raw User-Agent string, which is a fingerprint in its own right. Only
 *     broad device / OS / browser families survive.
 *   - city-level location. Country and the wider region are as fine as it gets.
 *
 * The visitor token is a salted hash whose salt changes every day, so the same
 * person is countable within a day and uncorrelatable across days. That is the
 * cookieless approach used by privacy-first analytics, and it means no consent
 * banner and nothing personal at rest.
 */
export interface RequestMeta {
  country: string | null;
  region: string | null;
  deviceType: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  os: string | null;
  browser: string | null;
  /** Daily-rotating pseudonymous token. Not reversible, not stable past midnight. */
  visitorHash: string | null;
}

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${process.env.ANALYTICS_SALT ?? "jinacheck"}:${day}`)
    .digest("hex");
}

/** Broad buckets only. Version numbers would narrow the crowd too far. */
function classifyUserAgent(ua: string): Pick<RequestMeta, "deviceType" | "os" | "browser"> {
  const s = ua.toLowerCase();
  if (!s) return { deviceType: "unknown", os: null, browser: null };

  if (/bot|crawler|spider|preview|curl|wget|headless|lighthouse/.test(s)) {
    return { deviceType: "bot", os: null, browser: null };
  }

  const deviceType = /ipad|tablet/.test(s)
    ? "tablet"
    : /mobi|android|iphone/.test(s)
      ? "mobile"
      : "desktop";

  const os = /android/.test(s)
    ? "Android"
    : /iphone|ipad|ios/.test(s)
      ? "iOS"
      : /windows/.test(s)
        ? "Windows"
        : /mac os|macintosh/.test(s)
          ? "macOS"
          : /linux/.test(s)
            ? "Linux"
            : null;

  const browser = /edg\//.test(s)
    ? "Edge"
    : /opr\/|opera/.test(s)
      ? "Opera"
      : /chrome|crios/.test(s)
        ? "Chrome"
        : /firefox|fxios/.test(s)
          ? "Firefox"
          : /safari/.test(s)
            ? "Safari"
            : null;

  return { deviceType, os, browser };
}

/**
 * Build the record from request headers.
 *
 * Country comes from whatever the host already worked out (Vercel, Cloudflare
 * and Netlify all publish a geo header), so no lookup service is called and the
 * visitor is never asked for permission.
 */
export function readRequestMeta(request: Request): RequestMeta {
  const h = request.headers;
  const ua = h.get("user-agent") ?? "";

  const country =
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country-code") ?? null;
  const region =
    h.get("x-vercel-ip-country-region") ?? h.get("cf-region-code") ?? null;

  // Transient: used as hash input on the next line, then out of scope.
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();

  const visitorHash = ip
    ? createHash("sha256").update(`${dailySalt()}:${ip}:${ua}`).digest("hex").slice(0, 32)
    : null;

  return {
    country: country?.toUpperCase().slice(0, 2) ?? null,
    region: region?.slice(0, 8) ?? null,
    ...classifyUserAgent(ua),
    visitorHash,
  };
}
